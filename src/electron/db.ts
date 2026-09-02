import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { CREATE_TABLES_SQL, CURRENT_SCHEMA_VERSION, DatabaseSettings } from './schema';
import { Customer, Order, OrderEvent, FabricItem, AccessoryItem, ThobeType, ColorItem, NotificationItem, Invoice, UserPreferences, CustomerCreditRecord } from '../types';
import { DEFAULT_MEASUREMENTS, DEFAULT_STYLE_DETAILS, normalizeMeasurements, normalizeStyleDetails } from '../services/shared/measurementDefaults';
import { MIGRATIONS } from './migrations';
import { BACKUP_SCHEMA_VERSION, DatabaseIntegrityService } from './services/databaseIntegrityService';
import { calculateReportProjection, formatReportStatus } from '../domain/reportMetrics';
import { NotificationRepository } from './repositories/notificationRepository';

const parseMeasurementsJson = (value?: string) => {
  try { return normalizeMeasurements(JSON.parse(value || '{}')); }
  catch { return normalizeMeasurements(); }
};

const parseStyleDetailsJson = (value?: string) => {
  try { return normalizeStyleDetails(JSON.parse(value || '{}')); }
  catch { return normalizeStyleDetails(); }
};

export class SahwaDatabaseManager {
  private db: Database.Database | null = null;
  private dbPath: string;
  private backupDir: string;
  private corruptDir: string;
  private legacyDbPath?: string;
  private legacyBackupDir?: string;
  private autoBackupTimer: NodeJS.Timeout | null = null;
  private closePromise: Promise<void> | null = null;
  private backupQueue: Promise<void> = Promise.resolve();

  constructor(customDir?: string, legacyDir?: string, customBackupDir?: string) {
    const baseDir = customDir || path.join(process.cwd(), 'data');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    this.dbPath = path.join(baseDir, 'sahwa_tailoring.db');
    this.backupDir = customBackupDir || path.join(baseDir, 'backups');
    this.corruptDir = path.join(baseDir, 'corrupt_backups');
    this.legacyDbPath = legacyDir ? path.join(legacyDir, 'sahwa_tailoring.db') : undefined;
    this.legacyBackupDir = legacyDir ? path.join(legacyDir, 'backups') : undefined;

    if (!fs.existsSync(this.backupDir)) fs.mkdirSync(this.backupDir, { recursive: true });
    if (!fs.existsSync(this.corruptDir)) fs.mkdirSync(this.corruptDir, { recursive: true });
  }

  private migrateLegacyStorageIfNeeded(): string | undefined {
    if (!this.legacyDbPath || path.resolve(this.legacyDbPath) === path.resolve(this.dbPath) || fs.existsSync(this.dbPath) || !fs.existsSync(this.legacyDbPath)) {
      return undefined;
    }

    const migrationTag = new Date().toISOString().replace(/[:.]/g, '-');
    const stagingPath = `${this.dbPath}.migration-${migrationTag}.tmp`;
    let legacyDb: Database.Database | null = null;

    try {
      legacyDb = new Database(this.legacyDbPath);
      legacyDb.pragma('wal_checkpoint(TRUNCATE)');
      legacyDb.close();
      legacyDb = null;

      fs.copyFileSync(this.legacyDbPath, stagingPath);
      const verificationDb = new Database(stagingPath, { readonly: true });
      const integrity = verificationDb.pragma('integrity_check') as Array<{ integrity_check: string }>;
      verificationDb.close();
      if (!integrity[0] || integrity[0].integrity_check !== 'ok') {
        throw new Error('فشل التحقق من سلامة قاعدة البيانات القديمة أثناء النقل');
      }

      fs.renameSync(stagingPath, this.dbPath);
      if (this.legacyBackupDir && fs.existsSync(this.legacyBackupDir)) {
        for (const fileName of fs.readdirSync(this.legacyBackupDir)) {
          const source = path.join(this.legacyBackupDir, fileName);
          const target = path.join(this.backupDir, fileName);
          if (fs.statSync(source).isFile() && !fs.existsSync(target)) fs.copyFileSync(source, target);
        }
      }
      return `تم نقل قاعدة البيانات القديمة بأمان إلى ${this.dbPath}. بقيت النسخة القديمة في مكانها ولم تُحذف.`;
    } catch (error) {
      try { legacyDb?.close(); } catch {}
      try { if (fs.existsSync(stagingPath)) fs.unlinkSync(stagingPath); } catch {}
      throw error;
    }
  }

  /**
   * Initializes SQLite Database with PRAGMA WAL, Foreign Keys & Integrity Verification
   */
  public initDatabase(): { success: boolean; corruptedRecoveryMessage?: string; error?: string } {
    let corruptedRecoveryMessage: string | undefined;

    try {
      corruptedRecoveryMessage = this.migrateLegacyStorageIfNeeded();
    } catch (error: any) {
      return { success: false, error: error?.message || 'تعذر نقل قاعدة البيانات القديمة إلى مجلد بيانات المستخدم' };
    }

    // Check if existing file needs integrity check
    if (fs.existsSync(this.dbPath)) {
      try {
        const checkDb = new Database(this.dbPath);
        checkDb.pragma('foreign_keys = ON');
        const integrityResult = checkDb.pragma('integrity_check') as Array<{ integrity_check: string }>;
        const isOk = integrityResult && integrityResult.length > 0 && integrityResult[0].integrity_check === 'ok';
        checkDb.close();

        if (!isOk) {
          // File is corrupted -> create timestamped copy, do NOT delete, start fresh
          const timeTag = new Date().toISOString().replace(/[:.]/g, '-');
          const corruptCopyPath = path.join(this.corruptDir, `sahwa_corrupt_${timeTag}.db`);
          fs.copyFileSync(this.dbPath, corruptCopyPath);
          fs.unlinkSync(this.dbPath);

          corruptedRecoveryMessage = `تنبيه: تم اكتشاف تلف في ملف قاعدة البيانات السابق. تم حفظ نسخة احتياطية من الملف التالف بمسار (${corruptCopyPath}) وتم بدء قاعدة بيانات سليمة جديدة.`;
        }
      } catch (err) {
        // Unreadable database -> copy and recreate
        const timeTag = new Date().toISOString().replace(/[:.]/g, '-');
        const corruptCopyPath = path.join(this.corruptDir, `sahwa_corrupt_${timeTag}.db`);
        if (fs.existsSync(this.dbPath)) {
          fs.copyFileSync(this.dbPath, corruptCopyPath);
          fs.unlinkSync(this.dbPath);
        }
        corruptedRecoveryMessage = `تنبيه: تعذر فتح قاعدة البيانات الحالية. تم إنشاء نسخة للطوارئ بمسار (${corruptCopyPath}) والبدء بملف جديد.`;
      }
    }

    try {
      this.db = new Database(this.dbPath);
      
      // Mandatory Pragmas for stability & relations
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('busy_timeout = 5000');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('temp_store = MEMORY');

      // Create Tables & Indexes
      this.db.exec(CREATE_TABLES_SQL);
      this.ensureCompatibilityMigrations();
      this.db.pragma('optimize');

      // Initialize default system settings
      this.initSystemSettings();

      // Seed default initial data if tables are empty
      this.seedInitialDataIfEmpty();

      // Take initial startup backup and start 1-hour periodic rolling backup
      this.backupDatabase('startup_auto').catch(err => {
        console.error('Error in startup backup:', err);
      });
      this.startPeriodicAutoBackup();

      return { success: true, corruptedRecoveryMessage };
    } catch (error: any) {
      console.error('Failed to initialize Sahwa Database:', error);
      return { success: false, error: error?.message || 'تعذر تشغيل قاعدة البيانات' };
    }
  }

  public getRawDb(): Database.Database {
    if (!this.db) {
      throw new Error('قاعدة البيانات غير مفعلة');
    }
    return this.db;
  }

  private ensureCompatibilityMigrations(): void {
    const db = this.getRawDb();
    const settingsColumns = db.pragma('table_info(system_settings)') as Array<{ name: string }>;
    if (settingsColumns.length === 0) throw new Error('تعذر التحقق من جدول إعدادات النظام');

    let storedVersion = Number((db.prepare('SELECT value FROM system_settings WHERE key = ?').get('schemaVersion') as { value?: string } | undefined)?.value || 0);
    for (const migration of MIGRATIONS) {
      if (migration.version <= storedVersion) continue;
      const applyMigration = db.transaction(() => {
        migration.up(db);
        db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)').run('schemaVersion', String(migration.version));
      });
      applyMigration();
      storedVersion = migration.version;
    }

    if (storedVersion < CURRENT_SCHEMA_VERSION) {
      db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)').run('schemaVersion', String(CURRENT_SCHEMA_VERSION));
    }
  }

  /**
   * System settings getter / setter
   */
  public getSettings(): DatabaseSettings {
    const db = this.getRawDb();
    const rows = db.prepare('SELECT key, value FROM system_settings').all() as Array<{ key: string; value: string }>;
    
    const settingsMap = new Map<string, string>();
    rows.forEach(r => settingsMap.set(r.key, r.value));

    return {
      fabricConsumptionRatePerGarment: parseFloat(settingsMap.get('fabricConsumptionRatePerGarment') || '3.5'),
      autoBackupIntervalHours: parseFloat(settingsMap.get('autoBackupIntervalHours') || '1'),
      maxBackupFiles: parseInt(settingsMap.get('maxBackupFiles') || '14', 10),
      lastBackupTimestamp: settingsMap.get('lastBackupTimestamp'),
      schemaVersion: parseInt(settingsMap.get('schemaVersion') || '1', 10)
    };
  }

  private static readonly INTERNAL_SETTING_KEYS = new Set([
    'schemaVersion',
    'lastBackupTimestamp',
    'dataCleared',
  ] as const);

  public updateSetting(key: keyof DatabaseSettings | 'dataCleared', value: string | number): void {
    if (SahwaDatabaseManager.INTERNAL_SETTING_KEYS.has(key as 'schemaVersion' | 'lastBackupTimestamp' | 'dataCleared')) {
      throw new Error('لا يمكن تعديل إعدادات النظام الداخلية من الواجهة.');
    }
    this.writeSetting(key, value);
    if (key === 'autoBackupIntervalHours') {
      this.startPeriodicAutoBackup();
    }
  }

  /** Internal writer used by backup/restore/migrations — bypasses the renderer-facing guard. */
  private writeSetting(key: string, value: string | number): void {
    const db = this.getRawDb();
    db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)').run(key, String(value));
  }

  public getUserPreferences(): UserPreferences {
    const db = this.getRawDb();
    const rows = db.prepare('SELECT key, value FROM system_settings WHERE key LIKE ?').all('ui.%') as Array<{ key: string; value: string }>;
    const values = new Map(rows.map((row) => [row.key, row.value]));
    const invoicePrintMode = values.get('ui.invoicePrintMode') === 'summary' ? 'summary' : 'detailed';

    return {
      activeTab: values.get('ui.activeTab') || 'dashboard',
      invoicePrintMode,
      shopName: values.get('ui.shopName') || undefined,
      managerName: values.get('ui.managerName') || 'حاتم محمد الدبعي',
      shopLogoUrl: values.get('ui.shopLogoUrl') || undefined,
      shopPhone: values.get('ui.shopPhone') || undefined,
      vatNumber: values.get('ui.vatNumber') || undefined,
      shopAddress: values.get('ui.shopAddress') || undefined
    };
  }

  public updateUserPreferences(preferences: Partial<UserPreferences>): boolean {
    const allowedKeys: Array<keyof UserPreferences> = [
      'activeTab', 'invoicePrintMode', 'shopName', 'managerName', 'shopLogoUrl', 'shopPhone', 'vatNumber', 'shopAddress'
    ];
    const db = this.getRawDb();
    const update = db.transaction(() => {
      const statement = db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');
      for (const key of allowedKeys) {
        const value = preferences[key];
        if (value !== undefined) statement.run(`ui.${key}`, String(value));
      }
    });
    update();
    return true;
  }

  /**
   * Compatibility facade for the legacy data:save path. Only stock-alert IDs are
   * synchronized; server-owned notifications (e.g. WhatsApp) are never overwritten
   * from renderer state.
   */
  public replaceNotifications(notifications: NotificationItem[]): boolean {
    new NotificationRepository(this.getRawDb()).syncStockAlerts(notifications);
    return true;
  }

  private initSystemSettings(): void {
    const db = this.getRawDb();
    const defaults: Array<[string, string]> = [
      ['fabricConsumptionRatePerGarment', '3.5'],
      ['autoBackupIntervalHours', '1'],
      ['maxBackupFiles', '14'],
      ['schemaVersion', String(CURRENT_SCHEMA_VERSION)]
    ];

    const stmt = db.prepare('INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)');
    const insertMany = db.transaction((items: Array<[string, string]>) => {
      for (const [k, v] of items) stmt.run(k, v);
    });
    insertMany(defaults);
  }

  /**
   * Rolling 14-backups Manager
   */
  public backupDatabase(reason: string = 'auto'): Promise<{ success: boolean; filePath?: string; error?: string }> {
    const backupRun = this.backupQueue.then(() => this.performBackup(reason));
    this.backupQueue = backupRun.then(() => undefined, () => undefined);
    return backupRun;
  }

  private async performBackup(reason: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const db = this.getRawDb();
      const settings = this.getSettings();
      const maxFiles = settings.maxBackupFiles || 14;

      const timeTag = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `sahwa_backup_${reason}_${timeTag}.db`;
      const targetPath = path.join(this.backupDir, fileName);

      // Perform SQLite online backup / safe copy
      await db.backup(targetPath);

      // Also create a JSON mirror backup for cross-platform export
      const jsonFileName = `sahwa_backup_${reason}_${timeTag}.json`;
      const jsonTargetPath = path.join(this.backupDir, jsonFileName);
      const exportedData = this.exportFullDataAsJson();
      fs.writeFileSync(jsonTargetPath, JSON.stringify(exportedData, null, 2), 'utf-8');

      // Update timestamp
      this.writeSetting('lastBackupTimestamp', new Date().toISOString());

      // Rotate older files keeping max 14 files per extension
      this.rotateBackups('.db', maxFiles);
      this.rotateBackups('.json', maxFiles);

      return { success: true, filePath: targetPath };
    } catch (err: any) {
      console.error('Backup error:', err);
      return { success: false, error: err?.message || 'فشل إنشاء النسخة الاحتياطية' };
    }
  }

  private rotateBackups(extension: string, maxFiles: number): void {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(f => f.endsWith(extension) && f.startsWith('sahwa_backup_'))
        .map(f => {
          const fullPath = path.join(this.backupDir, f);
          return { name: f, path: fullPath, stat: fs.statSync(fullPath) };
        })
        .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

      if (files.length > maxFiles) {
        const toDelete = files.slice(maxFiles);
        toDelete.forEach(file => {
          try { fs.unlinkSync(file.path); } catch (e) {}
        });
      }
    } catch (e) {
      console.error('Error rotating backups:', e);
    }
  }

  private startPeriodicAutoBackup(): void {
    if (this.autoBackupTimer) clearInterval(this.autoBackupTimer);

    // يحترم الإعداد المحفوظ autoBackupIntervalHours (افتراضيًا ساعة واحدة)
    const intervalHours = Number(this.getSettings().autoBackupIntervalHours);
    const intervalMs = Number.isFinite(intervalHours) && intervalHours > 0
      ? intervalHours * 60 * 60 * 1000
      : 60 * 60 * 1000;
    this.autoBackupTimer = setInterval(() => {
      this.backupDatabase('periodic_auto').catch(err => {
        console.error('Error in periodic auto backup:', err);
      });
    }, intervalMs);
  }

  /**
   * Clears operational data after creating a safe pre-clear backup.
   * Reference tables (dress types and colors) are intentionally preserved.
   */
  public async clearAllData(): Promise<boolean> {
    try {
      await this.backupDatabase('pre_clear');
      const db = this.getRawDb();
      const clearTx = db.transaction(() => {
        for (const table of [
          'order_events', 'order_material_usages', 'purchase_lines', 'cash_transactions',
          'expenses', 'purchases', 'inventory_movements', 'invoices', 'orders',
          'customer_credits', 'customer_measurement_history', 'customers', 'fabrics', 'accessories'
        ]) {
          db.prepare(`DELETE FROM ${table}`).run();
        }
        const archivedAt = new Date().toISOString();
        db.prepare('UPDATE notifications SET archived_at = ?, updated_at = ? WHERE archived_at IS NULL').run(archivedAt, archivedAt);
      });
      clearTx();
      this.writeSetting('dataCleared', 'true');
      return true;
    } catch (error) {
      console.error('Clear data error:', error);
      return false;
    }
  }

  /**
   * Safe JSON Import & Database Restore with Verification
   */
  public async restoreFromJson(jsonString: string): Promise<{ success: boolean; error?: string }> {
    try {
      const parsed = JSON.parse(jsonString);

      // 1. Structure, duplicate, foreign-key and business preflight validation
      const preflight = DatabaseIntegrityService.validateRestorePayload(parsed);
      if (!preflight.ok) {
        return { success: false, error: `النسخة الاحتياطية غير صالحة: ${preflight.issues.map((item) => `${item.code}(${item.recordId || item.field || item.table})`).join(', ')}` };
      }

      // 2. Pre-Restore Safety Rolling Backup
      const preRestoreBackup = await this.backupDatabase('pre_restore');
      if (!preRestoreBackup.success) {
        return { success: false, error: `تعذر إنشاء نسخة أمان قبل الاستعادة: ${preRestoreBackup.error || 'سبب غير معروف'}` };
      }

      // 3. Perform Transactional Wipe & Insert
      const db = this.getRawDb();
      const restoreTx = db.transaction(() => {
        // Clear existing tables. New ledgers are cleared first so restore remains atomic and FK-safe.
        db.prepare('DELETE FROM customer_credits').run();
        db.prepare('DELETE FROM order_events').run();
        db.prepare('DELETE FROM order_material_usages').run();
        db.prepare('DELETE FROM purchase_lines').run();
        db.prepare('DELETE FROM cash_transactions').run();
        db.prepare('DELETE FROM expenses').run();
        db.prepare('DELETE FROM purchases').run();
        db.prepare('DELETE FROM inventory_movements').run();
        db.prepare('DELETE FROM invoices').run();
        db.prepare('DELETE FROM orders').run();
        db.prepare('DELETE FROM customer_measurement_history').run();
        db.prepare('DELETE FROM customers').run();
        db.prepare('DELETE FROM fabrics').run();
        db.prepare('DELETE FROM accessories').run();
        db.prepare('DELETE FROM dress_types').run();
        db.prepare('DELETE FROM colors').run();
        db.prepare('DELETE FROM notifications').run();
        db.prepare("DELETE FROM visible_number_sequences").run();

        // Restore Customers
        const custStmt = db.prepare(`
          INSERT INTO customers (id, customer_number, name, phone, created_at, updated_at, measurements_json, style_details_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const c of (parsed.customers as Customer[])) {
          custStmt.run(
            c.id, c.customerNumber ?? null, c.name, c.phone, c.createdAt || new Date().toISOString(),
            null, JSON.stringify(normalizeMeasurements(c.measurements)), JSON.stringify(normalizeStyleDetails(c.styleDetails))
          );

          // History
          if (Array.isArray(c.measurementHistory)) {
            const histStmt = db.prepare(`
              INSERT INTO customer_measurement_history (id, customer_id, saved_at, note, measurements_json, style_details_json)
              VALUES (?, ?, ?, ?, ?, ?)
            `);
            for (const h of c.measurementHistory) {
              histStmt.run(h.id, c.id, h.savedAt, h.note || '', JSON.stringify(normalizeMeasurements(h.measurements)), JSON.stringify(normalizeStyleDetails(h.styleDetails)));
            }
          }
        }

        // Restore Fabrics
        const fabStmt = db.prepare(`
          INSERT INTO fabrics (id, name, color, color_hex, purchase_price, selling_price, quantity_meters, min_stock_meters, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const f of (parsed.fabrics as FabricItem[])) {
          fabStmt.run(
            f.id, f.name, f.color, f.colorHex || '#ffffff',
            f.purchasePrice || 0, f.sellingPrice || 0, f.quantityMeters || 0,
            f.minStockMeters || 10, f.createdAt || new Date().toISOString()
          );
        }

        // Restore Accessories
        const accStmt = db.prepare(`
          INSERT INTO accessories (id, name, category, quantity, min_stock, unit, purchase_price, selling_price, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const a of (parsed.accessories as AccessoryItem[])) {
                      accStmt.run(a.id, a.name, a.category, a.quantity || 0, a.minStock || 5, a.unit || 'حبة', a.purchasePrice || 0, a.sellingPrice || 0, a.createdAt || new Date().toISOString());

        }

        // Restore Dress Types
        const thbStmt = db.prepare(`
          INSERT INTO dress_types (id, name, default_price, description)
          VALUES (?, ?, ?, ?)
        `);
        for (const t of (parsed.thobeTypes as ThobeType[])) {
          thbStmt.run(t.id, t.name, t.defaultPrice || 0, t.description || '');
        }

        // Restore Colors
        const colStmt = db.prepare(`
          INSERT INTO colors (id, name, hex)
          VALUES (?, ?, ?)
        `);
        for (const cl of (parsed.colors as ColorItem[])) {
          colStmt.run(cl.id, cl.name, cl.hex);
        }

        // Restore Orders
        const ordStmt = db.prepare(`
          INSERT INTO orders (
            id, order_number, customer_id, customer_name, customer_phone,
            thobe_type_id, thobe_type_name, fabric_id, fabric_name, fabric_color,
            fabric_consumption_meters, fabric_buy_price_at_order, garment_count,
            order_date, delivery_date, status, total_amount, paid_amount, remaining_amount,
            cash_received, overpayment_amount, cancellation_writeoff_amount,
            is_custom_measurement, measurements_json, style_details_json, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const o of (parsed.orders as Order[])) {
          const total = o.totalAmount || 0;
          const paid = o.paidAmount || 0;
          const remaining = o.remainingAmount ?? Math.max(0, total - paid);
          const cashReceived = o.cashReceived ?? paid;
          const overpaymentAmount = o.overpaymentAmount ?? 0;
          const cancellationWriteoffAmount = o.cancellationWriteoffAmount ?? 0;

          ordStmt.run(
            o.id, o.orderNumber, o.customerId, o.customerName, o.customerPhone,
            o.thobeTypeId || null, o.thobeTypeName || 'ثوب', o.fabricId || null,
            o.fabricName || 'قماش', o.fabricColor || 'أبيض',
            o.fabricConsumptionMeters || 3.5, o.fabricBuyPriceAtOrder || 0,
            o.garmentCount || 1, o.orderDate, o.deliveryDate, o.status || 'new',
            total, paid, remaining, cashReceived, overpaymentAmount, cancellationWriteoffAmount,
            o.isCustomMeasurement ? 1 : 0,
            JSON.stringify(normalizeMeasurements(o.measurements)), JSON.stringify(normalizeStyleDetails(o.styleDetails)),
            o.notes || '', o.createdAt || new Date().toISOString()
          );
        }

        // Restore Invoices
        if (Array.isArray(parsed.invoices)) {
          const invStmt = db.prepare(`
            INSERT INTO invoices (
              id, invoice_number, visible_invoice_number, order_id, customer_name, customer_phone,
              order_date, total_amount, paid_amount, remaining_amount,
              cash_received, overpayment_amount, cancellation_writeoff_amount,
              payment_status, payments_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const inv of (parsed.invoices as Invoice[])) {
            const rem = inv.remainingAmount ?? Math.max(0, (inv.totalAmount || 0) - (inv.paidAmount || 0) - (inv.cancellationWriteoffAmount || 0));
            invStmt.run(
              inv.id, inv.invoiceNumber, inv.visibleInvoiceNumber ?? null, inv.orderId, inv.customerName, inv.customerPhone,
              inv.orderDate, inv.totalAmount || 0, inv.paidAmount || 0, rem,
              inv.cashReceived ?? inv.paidAmount ?? 0, inv.overpaymentAmount || 0,
              inv.cancellationWriteoffAmount || 0, inv.paymentStatus || 'unpaid', JSON.stringify(inv.payments || [])
            );
          }
        }

        // Rebuild visible-number allocators from restored data. Legacy backups may not contain the optional fields.
        db.prepare(`
          INSERT INTO visible_number_sequences (name, next_number)
          VALUES ('customers', COALESCE((SELECT MAX(customer_number) + 1 FROM customers), 1))
        `).run();
        db.prepare(`
          INSERT INTO visible_number_sequences (name, next_number)
          VALUES ('invoices', COALESCE((SELECT MAX(visible_invoice_number) + 1 FROM invoices), 1))
        `).run();

        // Restore customer credit / refund-liability audit ledger.
        if (Array.isArray(parsed.customerCredits)) {
          const creditStmt = db.prepare(`
            INSERT INTO customer_credits (
              id, customer_id, order_id, invoice_id, payment_id, entry_type,
              amount, reference_id, notes, created_at,
              operation_id, idempotency_key, source_entry_id, target_invoice_id,
              target_order_id, method, actor_id, reason, occurred_at, balance_after
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const credit of parsed.customerCredits as CustomerCreditRecord[]) {
            creditStmt.run(
              credit.id, credit.customerId, credit.orderId ?? null, credit.invoiceId ?? null,
              credit.paymentId ?? null, credit.entryType, credit.amount,
              credit.referenceId ?? null, credit.notes ?? null, credit.createdAt || new Date().toISOString(),
              credit.operationId ?? null, credit.idempotencyKey ?? null, credit.sourceEntryId ?? null,
              credit.targetInvoiceId ?? null, credit.targetOrderId ?? null, credit.method ?? null,
              credit.actorId ?? null, credit.reason ?? null, credit.occurredAt ?? null,
              credit.balanceAfter ?? null
            );
          }
        }

        // Restore Inventory Movements
        if (Array.isArray(parsed.stockMovements)) {
          const movementStmt = db.prepare(`
            INSERT INTO inventory_movements (id, item_type, item_id, item_name, direction, quantity, quantity_before, quantity_after, unit, reason, reference_type, reference_id, reference_number, unit_cost, total_cost, source_movement_id, actor_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const m of parsed.stockMovements) {
            movementStmt.run(m.id, m.itemType, m.itemId, m.itemName, m.direction, m.quantity, m.quantityBefore, m.quantityAfter, m.unit, m.reason, m.referenceType || null, m.referenceId || null, m.referenceNumber || null, m.unitCost ?? null, m.totalCost ?? null, m.sourceMovementId || null, m.actorId || null, m.createdAt || new Date().toISOString());
          }
        }

        // Restore Purchases and line items
        if (Array.isArray(parsed.purchases)) {
          const purchaseStmt = db.prepare(`
            INSERT INTO purchases (id, supplier, invoice_number, purchase_date, total_amount, payment_method, notes, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          const lineStmt = db.prepare(`
            INSERT INTO purchase_lines (id, purchase_id, item_type, item_id, item_name, quantity, unit, unit_price, total_amount, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const p of parsed.purchases) {
            purchaseStmt.run(p.id, p.supplier, p.invoiceNumber || null, p.purchaseDate, p.totalAmount || 0, p.paymentMethod || 'cash', p.notes || null, p.status || 'approved', p.createdAt || new Date().toISOString());
            for (const line of (p.lines || [])) {
              lineStmt.run(line.id, p.id, line.itemType, line.itemId, line.itemName, line.quantity, line.unit, line.unitPrice || 0, line.totalAmount || 0, line.createdAt || new Date().toISOString());
            }
          }
        }

        // Restore Expenses
        if (Array.isArray(parsed.expenses)) {
          const expenseStmt = db.prepare(`
            INSERT INTO expenses (id, category, amount, expense_date, payment_method, description, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const e of parsed.expenses) {
            expenseStmt.run(e.id, e.category, e.amount || 0, e.expenseDate, e.paymentMethod || 'cash', e.description, e.notes || null, e.createdAt || new Date().toISOString());
          }
        }

        // Restore Cash Ledger
        if (Array.isArray(parsed.cashTransactions)) {
          const cashStmt = db.prepare(`
            INSERT INTO cash_transactions (id, direction, source_type, source_id, order_id, reference_number, amount, payment_method, transaction_date, description, notes, actor_id, reason, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const c of parsed.cashTransactions) {
            cashStmt.run(c.id, c.direction, c.sourceType, c.sourceId || null, c.orderId || null, c.referenceNumber || null, c.amount || 0, c.paymentMethod || 'cash', c.transactionDate, c.description, c.notes || null, c.actorId || null, c.reason || null, c.createdAt || new Date().toISOString());
          }
        }

        // Restore Order Event Timeline
        if (Array.isArray(parsed.orderEvents)) {
          const eventStmt = db.prepare(`
            INSERT INTO order_events (id, order_id, event_type, title, description, from_status, to_status, actor, metadata_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const event of (parsed.orderEvents as OrderEvent[])) {
            eventStmt.run(event.id, event.orderId, event.type, event.title, event.description, event.fromStatus || null, event.toStatus || null, event.actor || null, event.metadata ? JSON.stringify(event.metadata) : null, event.createdAt || new Date().toISOString());
          }
        }

        // Restore immutable Order Material Cost snapshots
        if (Array.isArray(parsed.orderMaterialUsages)) {
          const materialStmt = db.prepare(`
            INSERT INTO order_material_usages (id, order_id, item_type, item_id, item_name, quantity, unit, unit_cost_at_usage, total_cost, source_movement_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const m of parsed.orderMaterialUsages) {
            materialStmt.run(m.id, m.orderId, m.itemType, m.itemId || null, m.itemName, m.quantity, m.unit, m.unitCostAtUsage || 0, m.totalCost || 0, m.sourceMovementId || null, m.createdAt || new Date().toISOString());
          }
        }

        // Restore Notifications
        if (Array.isArray(parsed.notifications)) {
          const notifStmt = db.prepare(`
            INSERT INTO notifications (
              id, type, title, message, date, read, customer_phone, order_id,
              status, source, source_id, read_at, archived_at, retry_count, last_error,
              retry_history_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const n of (parsed.notifications as NotificationItem[])) {
            notifStmt.run(
              n.id, n.type, n.title, n.message, n.date, n.read ? 1 : 0, n.customerPhone || null, n.orderId || null,
              n.status || 'sent', n.source || 'legacy', n.sourceId || n.id, n.readAt || null, n.archivedAt || null,
              n.retryCount || 0, n.lastError || null, JSON.stringify(n.retryHistory || []), n.createdAt || new Date().toISOString(), n.updatedAt || new Date().toISOString()
            );
          }
        }

        const postRestore = new DatabaseIntegrityService(db).check();
        if (!postRestore.ok) {
          throw new Error(`فشل فحص سلامة البيانات بعد الاستعادة: ${postRestore.issues.slice(0, 5).map((item) => `${item.code}(${item.recordId || item.table})`).join(', ')}`);
        }
      });

      restoreTx();
      this.writeSetting('dataCleared', parsed.customers.length === 0 ? 'true' : 'false');
      return { success: true };
    } catch (err: any) {
      console.error('Restore error:', err);
      return { success: false, error: err?.message || 'تعذر استيراد البيانات: فشل التحقق من بنية البيانات.' };
    }
  }

  /**
   * Full Json Exporter helper
   */
  public exportFullDataAsJson(includeArchivedNotifications = true): any {
    const db = this.getRawDb();

    const rawCustomers = db.prepare('SELECT * FROM customers').all() as any[];
    const rawHistory = db.prepare('SELECT * FROM customer_measurement_history').all() as any[];
    const rawFabrics = db.prepare('SELECT * FROM fabrics').all() as any[];
    const rawAccessories = db.prepare('SELECT * FROM accessories').all() as any[];
    const rawThobeTypes = db.prepare('SELECT * FROM dress_types').all() as any[];
    const rawColors = db.prepare('SELECT * FROM colors').all() as any[];
    const rawOrders = db.prepare('SELECT * FROM orders').all() as any[];
    const rawInvoices = db.prepare('SELECT * FROM invoices').all() as any[];
    const rawNotifications = db.prepare(includeArchivedNotifications
      ? 'SELECT * FROM notifications'
      : 'SELECT * FROM notifications WHERE archived_at IS NULL').all() as any[];
    const rawStockMovements = db.prepare('SELECT * FROM inventory_movements').all() as any[];
    const rawPurchases = db.prepare('SELECT * FROM purchases').all() as any[];
    const rawPurchaseLines = db.prepare('SELECT * FROM purchase_lines').all() as any[];
    const rawExpenses = db.prepare('SELECT * FROM expenses').all() as any[];
    const rawCashTransactions = db.prepare('SELECT * FROM cash_transactions').all() as any[];
    const rawOrderMaterialUsages = db.prepare('SELECT * FROM order_material_usages').all() as any[];
    const rawOrderEvents = db.prepare('SELECT * FROM order_events ORDER BY created_at DESC').all() as any[];
    const rawCustomerCredits = db.prepare('SELECT * FROM customer_credits ORDER BY occurred_at ASC, created_at ASC, id ASC').all() as any[];

    const purchaseLinesMap = new Map<string, any[]>();
    for (const line of rawPurchaseLines) {
      const lines = purchaseLinesMap.get(line.purchase_id) || [];
      lines.push(line);
      purchaseLinesMap.set(line.purchase_id, lines);
    }

    // Map history to customers
    const historyMap = new Map<string, any[]>();
    for (const h of rawHistory) {
      const list = historyMap.get(h.customer_id) || [];
      list.push({
        id: h.id,
        savedAt: h.saved_at,
        note: h.note,
        measurements: parseMeasurementsJson(h.measurements_json),
        styleDetails: parseStyleDetailsJson(h.style_details_json)
      });
      historyMap.set(h.customer_id, list);
    }

    const customers = rawCustomers.map(c => ({
      id: c.id,
      customerNumber: c.customer_number ?? undefined,
      name: c.name,
      phone: c.phone,
      createdAt: c.created_at,
      measurements: parseMeasurementsJson(c.measurements_json),
      styleDetails: parseStyleDetailsJson(c.style_details_json),
      measurementHistory: historyMap.get(c.id) || []
    }));

    const fabrics = rawFabrics.map(f => ({
      id: f.id,
      name: f.name,
      color: f.color,
      colorHex: f.color_hex,
      purchasePrice: f.purchase_price,
      sellingPrice: f.selling_price,
      quantityMeters: f.quantity_meters,
      minStockMeters: f.min_stock_meters,
      createdAt: f.created_at
    }));

    const accessories = rawAccessories.map(a => ({
      id: a.id,
      name: a.name,
      category: a.category,
      quantity: a.quantity,
      minStock: a.min_stock,
      unit: a.unit,
      purchasePrice: a.purchase_price || 0,
      sellingPrice: a.selling_price || 0,
      createdAt: a.created_at
    }));

    const thobeTypes = rawThobeTypes.map(t => ({
      id: t.id,
      name: t.name,
      defaultPrice: t.default_price,
      description: t.description
    }));

    const colors = rawColors.map(cl => ({
      id: cl.id,
      name: cl.name,
      hex: cl.hex
    }));

    const customerNumberById = new Map(rawCustomers.map((customer) => [customer.id, customer.customer_number ?? undefined]));
    const orders = rawOrders.map(o => ({
      id: o.id,
      orderNumber: o.order_number,
      customerId: o.customer_id,
      customerNumber: customerNumberById.get(o.customer_id),
      customerName: o.customer_name,
      customerPhone: o.customer_phone,
      thobeTypeId: o.thobe_type_id,
      thobeTypeName: o.thobe_type_name,
      fabricId: o.fabric_id,
      fabricName: o.fabric_name,
      fabricColor: o.fabric_color,
      fabricConsumptionMeters: o.fabric_consumption_meters,
      fabricBuyPriceAtOrder: o.fabric_buy_price_at_order,
      garmentCount: o.garment_count,
      orderDate: o.order_date,
      deliveryDate: o.delivery_date,
      status: o.status,
      totalAmount: o.total_amount,
      paidAmount: o.paid_amount,
      remainingAmount: o.remaining_amount,
      cashReceived: o.cash_received,
      overpaymentAmount: o.overpayment_amount,
      cancellationWriteoffAmount: o.cancellation_writeoff_amount,
      isCustomMeasurement: Boolean(o.is_custom_measurement),
      measurements: parseMeasurementsJson(o.measurements_json),
      styleDetails: parseStyleDetailsJson(o.style_details_json),
      notes: o.notes,
      createdAt: o.created_at
    }));

    const invoices = rawInvoices.map(i => ({
      id: i.id,
      visibleInvoiceNumber: i.visible_invoice_number ?? undefined,
      customerNumber: customerNumberById.get(i.customer_id || rawOrders.find((order) => order.id === i.order_id)?.customer_id),
      invoiceNumber: i.invoice_number,
      orderId: i.order_id,
      customerName: i.customer_name,
      customerPhone: i.customer_phone,
      orderDate: i.order_date,
      totalAmount: i.total_amount,
      paidAmount: i.paid_amount,
      remainingAmount: i.remaining_amount,
      cashReceived: i.cash_received,
      overpaymentAmount: i.overpayment_amount,
      cancellationWriteoffAmount: i.cancellation_writeoff_amount,
      paymentStatus: i.payment_status,
      payments: JSON.parse(i.payments_json || '[]')
    }));

    const notifications = rawNotifications.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      date: n.date,
      read: Boolean(n.read),
      customerPhone: n.customer_phone,
      orderId: n.order_id || undefined,
      status: n.status || 'sent',
      source: n.source || 'legacy',
      sourceId: n.source_id || undefined,
      readAt: n.read_at || undefined,
      archivedAt: n.archived_at || undefined,
      retryCount: Number(n.retry_count || 0),
      lastError: n.last_error || undefined,
      retryHistory: (() => { try { const value = JSON.parse(n.retry_history_json || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } })(),
      createdAt: n.created_at || undefined,
      updatedAt: n.updated_at || undefined
    }));

    const stockMovements = rawStockMovements.map(m => ({
      id: m.id, itemType: m.item_type, itemId: m.item_id, itemName: m.item_name, direction: m.direction,
      quantity: m.quantity, quantityBefore: m.quantity_before, quantityAfter: m.quantity_after, unit: m.unit,
      reason: m.reason, referenceType: m.reference_type, referenceId: m.reference_id, referenceNumber: m.reference_number,
      unitCost: m.unit_cost === null || m.unit_cost === undefined ? undefined : m.unit_cost,
      totalCost: m.total_cost === null || m.total_cost === undefined ? undefined : m.total_cost,
      sourceMovementId: m.source_movement_id || undefined, actorId: m.actor_id || undefined,
      createdAt: m.created_at
    }));
    const purchases = rawPurchases.map(p => ({
      id: p.id, supplier: p.supplier, invoiceNumber: p.invoice_number, purchaseDate: p.purchase_date,
      totalAmount: p.total_amount, paymentMethod: p.payment_method, notes: p.notes, status: p.status,
      lines: (purchaseLinesMap.get(p.id) || []).map(l => ({
        id: l.id, purchaseId: l.purchase_id, itemType: l.item_type, itemId: l.item_id, itemName: l.item_name,
        quantity: l.quantity, unit: l.unit, unitPrice: l.unit_price, totalAmount: l.total_amount, createdAt: l.created_at
      })),
      createdAt: p.created_at
    }));
    const expenses = rawExpenses.map(e => ({
      id: e.id, category: e.category, amount: e.amount, expenseDate: e.expense_date,
      paymentMethod: e.payment_method, description: e.description, notes: e.notes, createdAt: e.created_at
    }));
    const cashTransactions = rawCashTransactions.map(c => ({
      id: c.id, direction: c.direction, sourceType: c.source_type, sourceId: c.source_id,
      referenceNumber: c.reference_number, orderId: c.order_id || undefined, amount: c.amount, paymentMethod: c.payment_method,
      transactionDate: c.transaction_date, description: c.description, notes: c.notes,
      actorId: c.actor_id || undefined, reason: c.reason || undefined, createdAt: c.created_at
    }));
    const orderMaterialUsages = rawOrderMaterialUsages.map(m => ({
      id: m.id, orderId: m.order_id, itemType: m.item_type, itemId: m.item_id, itemName: m.item_name,
      quantity: m.quantity, unit: m.unit, unitCostAtUsage: m.unit_cost_at_usage, totalCost: m.total_cost,
      sourceMovementId: m.source_movement_id, createdAt: m.created_at
    }));
    const orderEvents = rawOrderEvents.map(e => ({
      id: e.id, orderId: e.order_id, type: e.event_type, title: e.title, description: e.description,
      fromStatus: e.from_status || undefined, toStatus: e.to_status || undefined, actor: e.actor || undefined,
      metadata: e.metadata_json ? JSON.parse(e.metadata_json) : undefined, createdAt: e.created_at
    }));
    const customerCredits = rawCustomerCredits.map(c => ({
      id: c.id, customerId: c.customer_id, orderId: c.order_id ?? null,
      invoiceId: c.invoice_id ?? null, paymentId: c.payment_id ?? null,
      entryType: c.entry_type, amount: c.amount, referenceId: c.reference_id ?? null,
      notes: c.notes ?? null, createdAt: c.created_at,
      operationId: c.operation_id ?? null, idempotencyKey: c.idempotency_key ?? null,
      sourceEntryId: c.source_entry_id ?? null, targetInvoiceId: c.target_invoice_id ?? null,
      targetOrderId: c.target_order_id ?? null, method: c.method ?? null,
      actorId: c.actor_id ?? null, reason: c.reason ?? null,
      occurredAt: c.occurred_at ?? null, balanceAfter: c.balance_after ?? null
    }));

    return {
      backupSchemaVersion: BACKUP_SCHEMA_VERSION,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      customers, fabrics, accessories, thobeTypes, colors, orders, invoices, notifications,
      stockMovements, purchases, expenses, cashTransactions, orderMaterialUsages, orderEvents, customerCredits
    };
  }

  /**
   * Excel Reports Generator (.xlsx)
   */
  public async generateExcelReport(startDate?: string, endDate?: string): Promise<Buffer> {
    const XLSX = await import('xlsx');
    const data = this.exportFullDataAsJson() as any;
    // Material cost is computed once inside calculateReportProjection (see
    // materialCostFor in reportMetrics.ts), from the same orderMaterialUsages
    // records used by the on-screen report, so Excel and the screen can never
    // diverge. Do not pre-compute or inject order.materialCost here.
    const projection = calculateReportProjection({
      orders: data.orders || [],
      invoices: data.invoices || [],
      cashTransactions: data.cashTransactions || [],
      customerCredits: data.customerCredits || [],
      purchases: data.purchases || [],
      expenses: data.expenses || [],
      stockMovements: data.stockMovements || [],
      orderEvents: data.orderEvents || [],
      orderMaterialUsages: data.orderMaterialUsages || [],
      startDate,
      endDate
    });
    const statusLabel = (status: string) => status === 'cancelled' ? 'ملغى' : status === 'delivered' ? 'مُسلم' : status === 'ready' ? 'جاهز' : status === 'processing' ? 'تحت التنفيذ' : 'جديد';
    const orderRows = projection.details.map((detail, index) => {
      const customer = (data.customers || []).find((item: any) => item.id === detail.order.customerId);
      const invoice = (data.invoices || []).find((item: any) => item.orderId === detail.order.id);
      const visibleInvoiceNumber = invoice?.visibleInvoiceNumber ? `INV-${invoice.visibleInvoiceNumber}` : invoice?.invoiceNumber || '';
      return {
      'م': index + 1,
      'رقم العميل': customer?.customerNumber || '',
      'رقم الفاتورة': visibleInvoiceNumber,
      'رقم الطلب': detail.order.orderNumber,
      'اسم العميل': detail.order.customerName,
      'رقم الجوال': detail.order.customerPhone,
      'نوع الثوب': detail.order.thobeTypeName,
      'القماش واللون': detail.order.fabricName + ' (' + detail.order.fabricColor + ')',
      'تاريخ الطلب': detail.order.orderDate,
      'تاريخ التسليم': detail.order.deliveryDate,
      'حالة الطلب': statusLabel(detail.order.status),
      'حالة التسوية': formatReportStatus(detail.settlementStatus),
      'داخل المبيعات': detail.includedInSales ? 'نعم' : 'لا',
      'داخل الإيراد المعترف به': detail.includedInRecognizedRevenue ? 'نعم' : 'لا',
      'applied_paid (ر.س)': detail.appliedPaid,
      'cash_received (ر.س)': detail.cashReceived,
      'overpayment (ر.س)': detail.overpaymentAmount,
      'cancellation writeoff (ر.س)': detail.cancellationWriteoffAmount,
      'الإجمالي (ر.س)': detail.order.totalAmount,
      'المتبقي (ر.س)': detail.order.remainingAmount,
      'تكلفة المواد (ر.س)': detail.materialCost || 0,
      'الربح المعترف به (ر.س)': detail.includedInRecognizedRevenue ? Number(detail.order.totalAmount || 0) - Number(detail.materialCost || 0) : 0
      };
    });
    const summaryRows = [
      { البيان: 'Sales booked', القيمة: projection.salesBooked },
      { البيان: 'Recognized revenue', القيمة: projection.recognizedRevenue },
      { البيان: 'Applied collected', القيمة: projection.appliedCollected },
      { البيان: 'Cash received', القيمة: projection.cashReceived },
      { البيان: 'Overpayment created', القيمة: projection.overpaymentCreated },
      { البيان: 'Overpayment applied', القيمة: projection.overpaymentApplied },
      { البيان: 'Overpayment refunded', القيمة: projection.overpaymentRefunded },
      { البيان: 'Closing customer credit liability', القيمة: projection.closingCustomerCreditLiability },
      { البيان: 'Customer credit cash refunds', القيمة: projection.customerCreditCashRefunds },
      { البيان: 'Customer credit non-cash refunds', القيمة: projection.customerCreditNonCashRefunds },
      { البيان: 'Cancellation Writeoff (Non-Cash Settlement)', القيمة: projection.cancellationWriteoff },
      { البيان: 'Active outstanding balance', القيمة: projection.activeOutstanding },
      { البيان: 'إجمالي المشتريات', القيمة: projection.totalPurchases },
      { البيان: 'إجمالي المصروفات', القيمة: projection.totalExpenses },
      { البيان: 'تكلفة المواد المعترف بها', القيمة: projection.recognizedMaterialCost },
      { البيان: 'صافي الربح', القيمة: projection.netProfit },
      { البيان: 'الطلبات الملغاة', القيمة: projection.cancelledOrdersCount },
      { البيان: 'الطلبات المسواة بالإلغاء', القيمة: projection.settledByCancellationCount }
    ];
    const fabrics = data.fabrics || [];
    const accessories = data.accessories || [];
    const customerCreditRows = [
      { البيان: 'overpayment_created', القيمة: projection.overpaymentCreated },
      { البيان: 'overpayment_applied', القيمة: projection.overpaymentApplied },
      { البيان: 'overpayment_refunded', القيمة: projection.overpaymentRefunded },
      { البيان: 'closing_customer_credit_liability', القيمة: projection.closingCustomerCreditLiability },
      { البيان: 'customer_credit_cash_refunds', القيمة: projection.customerCreditCashRefunds },
      { البيان: 'customer_credit_non_cash_refunds', القيمة: projection.customerCreditNonCashRefunds },
      { البيان: 'net_profit_impact', القيمة: 0 },
      { البيان: 'cash_received_impact', القيمة: 0 },
      { البيان: 'applied_collected_impact', القيمة: 0 },
      { البيان: 'recognized_revenue_impact', القيمة: 0 }
    ];
    const inventoryRows = [
      ...fabrics.map((fabric: any) => ({ النوع: 'قماش', الصنف: fabric.name, الكمية: fabric.quantityMeters, الوحدة: 'متر', 'سعر الشراء': fabric.purchasePrice || 0, 'قيمة المخزون': fabric.quantityMeters * (fabric.purchasePrice || 0) })),
      ...accessories.map((accessory: any) => ({ النوع: 'مستلزم', الصنف: accessory.name, الكمية: accessory.quantity, الوحدة: accessory.unit, 'سعر الشراء': accessory.purchasePrice || 0, 'قيمة المخزون': accessory.quantity * (accessory.purchasePrice || 0) }))
    ];
    const lowStockItems = fabrics.filter((fabric: any) => fabric.quantityMeters <= fabric.minStockMeters).length + accessories.filter((accessory: any) => accessory.quantity <= accessory.minStock).length;
    summaryRows.push({ البيان: 'قيمة المخزون', القيمة: inventoryRows.reduce((sum, row) => sum + Number(row['قيمة المخزون'] || 0), 0) });
    summaryRows.push({ البيان: 'أصناف منخفضة المخزون', القيمة: lowStockItems });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orderRows), 'تقرير المبيعات');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'ملخص المحاسبة');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customerCreditRows), 'Customer Credit');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inventoryRows), 'قيمة المخزون');
    return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  }

  /**
   * Seed Data Generator
   */
  private seedInitialDataIfEmpty(): void {
    const db = this.getRawDb();
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM customers').get() as any).cnt;
    const dataCleared = (db.prepare('SELECT value FROM system_settings WHERE key = ?').get('dataCleared') as { value?: string } | undefined)?.value === 'true';
    if (count > 0 || dataCleared) return; // Already has data or was explicitly cleared

    // Initial Seeds
    const seedCustomers: Customer[] = [
      {
        id: 'CUST-101',
        name: 'عبدالمجيد السلمان',
        phone: '0501234567',
        createdAt: '2026-07-10',
        measurements: { ...DEFAULT_MEASUREMENTS, frontLength: '148', shoulderWidth: '46', neckSize: '42' },
        styleDetails: { ...DEFAULT_STYLE_DETAILS, neckType: 'قلاب عالي', buttonsType: 'صدف بيج فاخر' },
        measurementHistory: []
      },
      {
        id: 'CUST-102',
        name: 'سعود بن عبدالعزيز المقرن',
        phone: '0559876543',
        createdAt: '2026-07-15',
        measurements: { ...DEFAULT_MEASUREMENTS, frontLength: '152', sleeveLength: '64', bottomSweep: '82' },
        styleDetails: { ...DEFAULT_STYLE_DETAILS, neckType: 'سادة (كويتي)', habroorType: 'حبرور بارز ٤ سم' },
        measurementHistory: []
      }
    ];

    const seedFabrics: FabricItem[] = [
      {
        id: 'FAB-01',
        name: 'ياباني كريب فاخر - تويوبو',
        color: 'أبيض نص لمعة',
        colorHex: '#f8fafc',
        purchasePrice: 45,
        sellingPrice: 120,
        quantityMeters: 45,
        minStockMeters: 20
      },
      {
        id: 'FAB-02',
        name: 'سلك كوري ممتاز - تيجين',
        color: 'كريمي فاتح',
        colorHex: '#fef3c7',
        purchasePrice: 35,
        sellingPrice: 95,
        quantityMeters: 12,
        minStockMeters: 25
      }
    ];

    const seedAccessories: AccessoryItem[] = [
      { id: 'ACC-01', name: 'أزرار صدف طبيعي (علبة 500)', category: 'أزرار', quantity: 15, minStock: 5, unit: 'علبة' },
      { id: 'ACC-02', name: 'حشوة يابانية للرقبة (رول)', category: 'حشوات', quantity: 2, minStock: 4, unit: 'رول' }
    ];

    const seedThobeTypes: ThobeType[] = [
      { id: 'THB-01', name: 'ثوب سعودي كلاسيك', defaultPrice: 220, description: 'الرقبة القلاب القياسية والكبك التقليدي' },
      { id: 'THB-02', name: 'ثوب كويتي فتحة صليب', defaultPrice: 240, description: 'بدون قلاب مع قَصّة كويتية ممتازة' }
    ];

    const seedColors: ColorItem[] = [
      { id: 'COL-01', name: 'أبيض ناصع', hex: '#ffffff' },
      { id: 'COL-02', name: 'أبيض نص لمعة', hex: '#f8fafc' },
      { id: 'COL-03', name: 'كريمي فاتح', hex: '#fef3c7' }
    ];

    const seedTx = db.transaction(() => {
      const cStmt = db.prepare('INSERT OR IGNORE INTO customers (id, customer_number, name, phone, created_at, measurements_json, style_details_json) VALUES (?, ?, ?, ?, ?, ?, ?)');
      seedCustomers.forEach((c, index) => cStmt.run(c.id, index + 1, c.name, c.phone, c.createdAt, JSON.stringify(c.measurements), JSON.stringify(c.styleDetails)));

      db.prepare(`
        INSERT INTO visible_number_sequences (name, next_number)
        VALUES ('customers', COALESCE((SELECT MAX(customer_number) + 1 FROM customers), 1))
        ON CONFLICT(name) DO UPDATE SET next_number = MAX(visible_number_sequences.next_number, excluded.next_number)
      `).run();
      db.prepare(`
        INSERT INTO visible_number_sequences (name, next_number)
        VALUES ('invoices', COALESCE((SELECT MAX(visible_invoice_number) + 1 FROM invoices), 1))
        ON CONFLICT(name) DO UPDATE SET next_number = MAX(visible_number_sequences.next_number, excluded.next_number)
      `).run();

      const fStmt = db.prepare('INSERT OR IGNORE INTO fabrics (id, name, color, color_hex, purchase_price, selling_price, quantity_meters, min_stock_meters, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      seedFabrics.forEach(f => fStmt.run(f.id, f.name, f.color, f.colorHex, f.purchasePrice, f.sellingPrice, f.quantityMeters, f.minStockMeters, new Date().toISOString()));

      // Seed is idempotent: preserve existing customer data and catalog records.
      const aStmt = db.prepare('INSERT OR IGNORE INTO accessories (id, name, category, quantity, min_stock, unit, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      seedAccessories.forEach(a => aStmt.run(a.id, a.name, a.category, a.quantity, a.minStock, a.unit, new Date().toISOString()));

      const tStmt = db.prepare('INSERT OR IGNORE INTO dress_types (id, name, default_price, description) VALUES (?, ?, ?, ?)');
      seedThobeTypes.forEach(t => tStmt.run(t.id, t.name, t.defaultPrice, t.description));

      const colStmt = db.prepare('INSERT OR IGNORE INTO colors (id, name, hex) VALUES (?, ?, ?)');
      seedColors.forEach(cl => colStmt.run(cl.id, cl.name, cl.hex));
    });

    seedTx();
  }

  public async close(): Promise<void> {
    if (this.closePromise) return this.closePromise;

    this.closePromise = (async () => {
      if (this.autoBackupTimer) {
        clearInterval(this.autoBackupTimer);
        this.autoBackupTimer = null;
      }

      const db = this.db;
      if (!db) return;

      try {
        await this.backupDatabase('app_exit');
      } catch (e) {
        console.error('Error during app_exit backup:', e);
      }
      try {
        db.close();
        this.db = null;
      } catch (e) {
        console.error('Error closing database:', e);
      }
    })();

    return this.closePromise;
  }
}
