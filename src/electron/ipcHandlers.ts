import { ipcMain } from 'electron';
import { SahwaDatabaseManager } from './db';
import { safeIpcHandle } from './errorHandler';
import {
  Order,
  Customer,
  FabricItem,
  AccessoryItem,
  ThobeType,
  ColorItem,
  PaymentRecord,
  StockMovement,
  PurchaseRecord,
  PurchaseLine,
  ExpenseRecord,
  CashTransaction,
  OrderMaterialUsage,
  OrderEvent,
  InventoryItemType
} from '../types';
import { normalizeMeasurements, normalizeStyleDetails } from '../services/electronMock';

const parseMeasurementsJson = (value?: string) => {
  try { return normalizeMeasurements(JSON.parse(value || '{}')); }
  catch { return normalizeMeasurements(); }
};

const parseStyleDetailsJson = (value?: string) => {
  try { return normalizeStyleDetails(JSON.parse(value || '{}')); }
  catch { return normalizeStyleDetails(); }
};

const round2 = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const inventoryMeta = (db: any, itemType: InventoryItemType, itemId: string) => {
  if (itemType === 'fabric') {
    const row = db.prepare('SELECT id, name, quantity_meters AS quantity, purchase_price AS purchasePrice, \'متر\' AS unit FROM fabrics WHERE id = ?').get(itemId) as any;
    if (!row) throw new Error('صنف القماش غير موجود');
    return { table: 'fabrics', quantityColumn: 'quantity_meters', ...row };
  }
  if (itemType === 'accessory') {
    const row = db.prepare('SELECT id, name, quantity, purchase_price AS purchasePrice, unit FROM accessories WHERE id = ?').get(itemId) as any;
    if (!row) throw new Error('صنف الإكسسوار غير موجود');
    return { table: 'accessories', quantityColumn: 'quantity', ...row };
  }
  throw new Error('نوع الصنف غير مدعوم');
};

const insertInventoryMovement = (
  db: any,
  itemType: InventoryItemType,
  itemId: string,
  delta: number,
  direction: StockMovement['direction'],
  reason: string,
  reference?: { type?: string; id?: string; number?: string }
): StockMovement => {
  const meta = inventoryMeta(db, itemType, itemId);
  const before = round2(meta.quantity);
  const after = round2(before + delta);
  if (after < -0.0001) {
    throw new Error(`لا يمكن تنفيذ الحركة؛ الكمية المتاحة من ${meta.name} غير كافية.`);
  }
  db.prepare(`UPDATE ${meta.table} SET ${meta.quantityColumn} = ? WHERE id = ?`).run(Math.max(0, after), itemId);
  const id = `MOV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  db.prepare(`
    INSERT INTO inventory_movements (
      id, item_type, item_id, item_name, direction, quantity, quantity_before,
      quantity_after, unit, reason, reference_type, reference_id, reference_number, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, itemType, itemId, meta.name, direction, Math.abs(delta), before, Math.max(0, after),
    meta.unit, reason, reference?.type || null, reference?.id || null, reference?.number || null, new Date().toISOString()
  );
  return {
    id,
    itemType,
    itemId,
    itemName: meta.name,
    direction,
    quantity: Math.abs(delta),
    quantityBefore: before,
    quantityAfter: Math.max(0, after),
    unit: meta.unit,
    reason,
    referenceType: reference?.type,
    referenceId: reference?.id,
    referenceNumber: reference?.number,
    createdAt: new Date().toISOString()
  };
};

const insertOrderEvent = (db: any, event: OrderEvent) => {
  const duplicate = db.prepare('SELECT id FROM order_events WHERE id = ?').get(event.id) as any;
  if (duplicate) return;
  db.prepare(`
    INSERT INTO order_events (id, order_id, event_type, title, description, from_status, to_status, actor, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.id, event.orderId, event.type, event.title, event.description,
    event.fromStatus || null, event.toStatus || null, event.actor || null,
    event.metadata ? JSON.stringify(event.metadata) : null, event.createdAt
  );
};

const mapOrderEvent = (row: any): OrderEvent => ({
  id: row.id,
  orderId: row.order_id,
  type: row.event_type,
  title: row.title,
  description: row.description,
  fromStatus: row.from_status || undefined,
  toStatus: row.to_status || undefined,
  actor: row.actor || undefined,
  metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
  createdAt: row.created_at
});

const insertCashTransaction = (db: any, transaction: CashTransaction) => {
  db.prepare(`
    INSERT INTO cash_transactions (
      id, direction, source_type, source_id, order_id, reference_number, amount,
      payment_method, transaction_date, description, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    transaction.id,
    transaction.direction,
    transaction.sourceType,
    transaction.sourceId || null,
    transaction.orderId || null,
    transaction.referenceNumber || null,
    round2(transaction.amount),
    transaction.paymentMethod,
    transaction.transactionDate,
    transaction.description,
    transaction.notes || null,
    transaction.createdAt
  );
};

const mapStockMovement = (row: any): StockMovement => ({
  id: row.id,
  itemType: row.item_type,
  itemId: row.item_id,
  itemName: row.item_name,
  direction: row.direction,
  quantity: row.quantity,
  quantityBefore: row.quantity_before,
  quantityAfter: row.quantity_after,
  unit: row.unit,
  reason: row.reason,
  referenceType: row.reference_type || undefined,
  referenceId: row.reference_id || undefined,
  referenceNumber: row.reference_number || undefined,
  createdAt: row.created_at
});

const mapCashTransaction = (row: any): CashTransaction => ({
  id: row.id,
  direction: row.direction,
  sourceType: row.source_type,
  sourceId: row.source_id || undefined,
  orderId: row.order_id || undefined,
  referenceNumber: row.reference_number || undefined,
  amount: row.amount,
  paymentMethod: row.payment_method,
  transactionDate: row.transaction_date,
  description: row.description,
  notes: row.notes || undefined,
  createdAt: row.created_at
});

const mapPurchase = (row: any, lines: any[]): PurchaseRecord => ({
  id: row.id,
  supplier: row.supplier,
  invoiceNumber: row.invoice_number || undefined,
  purchaseDate: row.purchase_date,
  totalAmount: row.total_amount,
  paymentMethod: row.payment_method,
  notes: row.notes || undefined,
  status: row.status,
  lines: lines.filter((line) => line.purchase_id === row.id).map((line): PurchaseLine => ({
    id: line.id,
    purchaseId: line.purchase_id,
    itemType: line.item_type,
    itemId: line.item_id,
    itemName: line.item_name,
    quantity: line.quantity,
    unit: line.unit,
    unitPrice: line.unit_price,
    totalAmount: line.total_amount,
    createdAt: line.created_at
  })),
  createdAt: row.created_at
});

const mapExpense = (row: any): ExpenseRecord => ({
  id: row.id,
  category: row.category,
  amount: row.amount,
  expenseDate: row.expense_date,
  paymentMethod: row.payment_method,
  description: row.description,
  notes: row.notes || undefined,
  createdAt: row.created_at
});

export function registerIpcHandlers(dbManager: SahwaDatabaseManager) {
  const db = dbManager.getRawDb();

  // -------------------------------------------------------------
  // CUSTOMERS IPC HANDLERS
  // -------------------------------------------------------------
  safeIpcHandle(ipcMain, 'customers:list', async () => {
    const rawCustomers = db.prepare('SELECT * FROM customers ORDER BY name ASC').all() as any[];
    const rawHistory = db.prepare('SELECT * FROM customer_measurement_history ORDER BY saved_at DESC').all() as any[];

    const historyMap = new Map<string, any[]>();
    for (const h of rawHistory) {
      const list = historyMap.get(h.customer_id) || [];
      list.push({
        id: h.id,
        savedAt: h.saved_at,
        note: h.note || '',
        measurements: parseMeasurementsJson(h.measurements_json),
        styleDetails: parseStyleDetailsJson(h.style_details_json)
      });
      historyMap.set(h.customer_id, list);
    }

    return rawCustomers.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      createdAt: c.created_at,
      measurements: parseMeasurementsJson(c.measurements_json),
      styleDetails: parseStyleDetailsJson(c.style_details_json),
      measurementHistory: historyMap.get(c.id) || []
    }));
  });

  safeIpcHandle(ipcMain, 'customers:create', async (_, customer: Partial<Customer>) => {
    const id = customer.id || `CUST-${Date.now()}`;
    const name = customer.name || 'عميل جديد';
    const phone = (customer.phone || '').trim();
    const createdAt = customer.createdAt || new Date().toISOString().slice(0, 10);
    
    // Check if phone number is already registered
    const existing = db.prepare('SELECT id FROM customers WHERE phone = ?').get(phone) as any;
    if (existing) {
      throw new Error('رقم الجوال مسجل بالفعل لعميل آخر');
    }

    const measurementsJson = JSON.stringify(normalizeMeasurements(customer.measurements));
    const styleDetailsJson = JSON.stringify(normalizeStyleDetails(customer.styleDetails));

    db.prepare(`
      INSERT INTO customers (id, name, phone, created_at, measurements_json, style_details_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, phone, createdAt, measurementsJson, styleDetailsJson);

    return {
      id,
      name,
      phone,
      createdAt,
      measurements: normalizeMeasurements(customer.measurements),
      styleDetails: normalizeStyleDetails(customer.styleDetails),
      measurementHistory: []
    };
  });

  safeIpcHandle(ipcMain, 'customers:update', async (_, customer: Customer) => {
    const phone = (customer.phone || '').trim();
    // Check if phone is used by another customer
    const existing = db.prepare('SELECT id FROM customers WHERE phone = ? AND id != ?').get(phone, customer.id) as any;
    if (existing) {
      throw new Error('رقم الجوال مسجل بالفعل لعميل آخر');
    }

    db.prepare(`
      UPDATE customers 
      SET name = ?, phone = ?, measurements_json = ?, style_details_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      customer.name,
      phone,
      JSON.stringify(normalizeMeasurements(customer.measurements)),
      JSON.stringify(normalizeStyleDetails(customer.styleDetails)),
      new Date().toISOString(),
      customer.id
    );

    return true;
  });

  safeIpcHandle(ipcMain, 'customers:delete', async (_, customerId: string) => {
    db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);
    return true;
  });

  safeIpcHandle(ipcMain, 'customers:saveMeasurementHistory', async (_, customerId: string, note: string) => {
    const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
    if (!cust) throw new Error('العميل غير موجود في قاعدة البيانات');

    const histId = `HIST-${Date.now()}`;
    const savedAt = new Date().toISOString().slice(0, 10);

    db.prepare(`
      INSERT INTO customer_measurement_history (id, customer_id, saved_at, note, measurements_json, style_details_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(histId, customerId, savedAt, note || 'تحديث مقاسات', cust.measurements_json, cust.style_details_json);

    return {
      id: histId,
      savedAt,
      note,
      measurements: parseMeasurementsJson(cust.measurements_json),
      styleDetails: parseStyleDetailsJson(cust.style_details_json)
    };
  });

  // -------------------------------------------------------------
  // FABRICS & INVENTORY IPC HANDLERS
  // -------------------------------------------------------------
  safeIpcHandle(ipcMain, 'fabrics:list', async () => {
    const rows = db.prepare('SELECT * FROM fabrics ORDER BY name ASC').all() as any[];
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      color: r.color,
      colorHex: r.color_hex,
      purchasePrice: r.purchase_price,
      sellingPrice: r.selling_price,
      quantityMeters: r.quantity_meters,
      minStockMeters: r.min_stock_meters
    }));
  });

  safeIpcHandle(ipcMain, 'fabrics:create', async (_, fabric: Partial<FabricItem>) => {
    const id = fabric.id || `FAB-${Date.now()}`;
    db.prepare(`
      INSERT INTO fabrics (id, name, color, color_hex, purchase_price, selling_price, quantity_meters, min_stock_meters, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      fabric.name || 'قماش جديد',
      fabric.color || 'أبيض',
      fabric.colorHex || '#ffffff',
      fabric.purchasePrice || 0,
      fabric.sellingPrice || 0,
      fabric.quantityMeters || 0,
      fabric.minStockMeters || 10,
      new Date().toISOString()
    );

    return { ...fabric, id };
  });

  safeIpcHandle(ipcMain, 'fabrics:update', async (_, fabric: FabricItem) => {
    db.prepare(`
      UPDATE fabrics
      SET name = ?, color = ?, color_hex = ?, purchase_price = ?, selling_price = ?, quantity_meters = ?, min_stock_meters = ?
      WHERE id = ?
    `).run(
      fabric.name, fabric.color, fabric.colorHex,
      fabric.purchasePrice, fabric.sellingPrice, fabric.quantityMeters,
      fabric.minStockMeters, fabric.id
    );
    return true;
  });

  safeIpcHandle(ipcMain, 'fabrics:delete', async (_, fabricId: string) => {
    db.prepare('DELETE FROM fabrics WHERE id = ?').run(fabricId);
    return true;
  });

  safeIpcHandle(ipcMain, 'accessories:list', async () => {
    const rows = db.prepare('SELECT * FROM accessories ORDER BY category ASC, name ASC').all() as any[];
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      quantity: r.quantity,
      minStock: r.min_stock,
      unit: r.unit,
      purchasePrice: r.purchase_price || 0,
      sellingPrice: r.selling_price || 0
    }));
  });

  safeIpcHandle(ipcMain, 'accessories:create', async (_, acc: Partial<AccessoryItem>) => {
    const id = acc.id || `ACC-${Date.now()}`;
    db.prepare(`
      INSERT INTO accessories (id, name, category, quantity, min_stock, unit, purchase_price, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, acc.name || 'عنصر', acc.category || 'عام', acc.quantity || 0, acc.minStock || 5, acc.unit || 'حبة', acc.purchasePrice || 0, new Date().toISOString());
    return { ...acc, id };
  });

  safeIpcHandle(ipcMain, 'accessories:update', async (_, acc: AccessoryItem) => {
    db.prepare(`
      UPDATE accessories SET name = ?, category = ?, quantity = ?, min_stock = ?, unit = ?, purchase_price = ?, selling_price = ? WHERE id = ?
    `).run(acc.name, acc.category, acc.quantity, acc.minStock, acc.unit, acc.purchasePrice || 0, acc.sellingPrice || 0, acc.id);
    return true;
  });

  safeIpcHandle(ipcMain, 'accessories:delete', async (_, accId: string) => {
    db.prepare('DELETE FROM accessories WHERE id = ?').run(accId);
    return true;
  });

  // -------------------------------------------------------------
  // INVENTORY MOVEMENTS, PURCHASES, EXPENSES & CASH LEDGER
  // -------------------------------------------------------------
  safeIpcHandle(ipcMain, 'stockMovements:list', async (_, itemType?: InventoryItemType, itemId?: string) => {
    let query = 'SELECT * FROM inventory_movements';
    const params: string[] = [];
    const filters: string[] = [];
    if (itemType) { filters.push('item_type = ?'); params.push(itemType); }
    if (itemId) { filters.push('item_id = ?'); params.push(itemId); }
    if (filters.length) query += ` WHERE ${filters.join(' AND ')}`;
    query += ' ORDER BY created_at DESC';
    return (db.prepare(query).all(...params) as any[]).map(mapStockMovement);
  });

  safeIpcHandle(ipcMain, 'stock:adjust', async (_, itemType: InventoryItemType, itemId: string, quantity: number, reason: string, direction: 'adjustment' | 'return' = 'adjustment') => {
    if (!reason || !reason.trim()) throw new Error('سبب التسوية مطلوب');
    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericQuantity) || numericQuantity === 0) throw new Error('كمية التسوية يجب أن تكون رقماً غير صفري');
    const tx = db.transaction(() => {
      const delta = direction === 'return' ? Math.abs(numericQuantity) : numericQuantity;
      return insertInventoryMovement(db, itemType, itemId, delta, direction, reason.trim(), { type: 'stock_adjustment', id: itemId });
    });
    return tx();
  });

  safeIpcHandle(ipcMain, 'purchases:list', async () => {
    const rows = db.prepare('SELECT * FROM purchases ORDER BY purchase_date DESC, created_at DESC').all() as any[];
    const lines = db.prepare('SELECT * FROM purchase_lines ORDER BY created_at ASC').all() as any[];
    return rows.map((row) => mapPurchase(row, lines));
  });

  safeIpcHandle(ipcMain, 'purchases:create', async (_, payload: any) => {
    const purchaseId = payload.id || `PUR-${Date.now()}`;
    const existing = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId) as any;
    if (existing) {
      const lines = db.prepare('SELECT * FROM purchase_lines WHERE purchase_id = ? ORDER BY created_at ASC').all(purchaseId) as any[];
      return mapPurchase(existing, lines);
    }
    const lines = Array.isArray(payload.lines) ? payload.lines : [];
    if (!payload.supplier?.trim()) throw new Error('اسم المورد مطلوب');
    if (lines.length === 0) throw new Error('أضف صنفاً واحداً على الأقل إلى المشتريات');

    const approvedPurchase = db.transaction(() => {
      const now = new Date().toISOString();
      const purchaseDate = payload.purchaseDate || now.slice(0, 10);
      let totalAmount = 0;
      const preparedLines: Array<{ input: any; meta: any; quantity: number; unitPrice: number; total: number }> = [];
      for (const line of lines) {
        const quantity = Number(line.quantity);
        const unitPrice = Number(line.unitPrice);
        if (!line.itemType || !line.itemId || !Number.isFinite(quantity) || quantity <= 0) throw new Error('بيانات كمية المشتريات غير صحيحة');
        if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error('سعر الشراء لا يمكن أن يكون سالباً');
        const meta = inventoryMeta(db, line.itemType, line.itemId);
        const total = round2(quantity * unitPrice);
        totalAmount += total;
        preparedLines.push({ input: line, meta, quantity, unitPrice, total });
      }

      db.prepare(`
        INSERT INTO purchases (id, supplier, invoice_number, purchase_date, total_amount, payment_method, notes, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?)
      `).run(purchaseId, payload.supplier.trim(), payload.invoiceNumber || null, purchaseDate, round2(totalAmount), payload.paymentMethod || 'cash', payload.notes || null, now);

      for (const line of preparedLines) {
        const movement = insertInventoryMovement(db, line.input.itemType, line.input.itemId, line.quantity, 'purchase', `شراء من المورد ${payload.supplier.trim()}`, {
          type: 'purchase', id: purchaseId, number: payload.invoiceNumber || purchaseId
        });
        db.prepare(`
          INSERT INTO purchase_lines (id, purchase_id, item_type, item_id, item_name, quantity, unit, unit_price, total_amount, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `PURL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          purchaseId,
          line.input.itemType,
          line.input.itemId,
          line.meta.name,
          line.quantity,
          line.input.unit || line.meta.unit,
          line.unitPrice,
          line.total,
          now
        );

        const table = line.input.itemType === 'fabric' ? 'fabrics' : 'accessories';
        const priceColumn = line.input.itemType === 'fabric' ? 'purchase_price' : 'purchase_price';
        db.prepare(`UPDATE ${table} SET ${priceColumn} = ? WHERE id = ?`).run(line.unitPrice, line.input.itemId);
        void movement;
      }

      if (totalAmount > 0) {
        insertCashTransaction(db, {
          id: `CASH-PUR-${purchaseId}`,
          direction: 'out',
          sourceType: 'purchase',
          sourceId: purchaseId,
          referenceNumber: payload.invoiceNumber || purchaseId,
          amount: round2(totalAmount),
          paymentMethod: payload.paymentMethod || 'cash',
          transactionDate: purchaseDate,
          description: `شراء مخزون من ${payload.supplier.trim()}`,
          notes: payload.notes || undefined,
          createdAt: now
        });
      }
      return { id: purchaseId, now };
    });

    const result = approvedPurchase();
    const row = db.prepare('SELECT * FROM purchases WHERE id = ?').get(result.id) as any;
    const lineRows = db.prepare('SELECT * FROM purchase_lines WHERE purchase_id = ? ORDER BY created_at ASC').all(result.id) as any[];
    return mapPurchase(row, lineRows);
  });

  safeIpcHandle(ipcMain, 'expenses:list', async () => {
    const rows = db.prepare('SELECT * FROM expenses ORDER BY expense_date DESC, created_at DESC').all() as any[];
    return rows.map(mapExpense);
  });

  safeIpcHandle(ipcMain, 'expenses:create', async (_, payload: any) => {
    const expenseId = payload.id || `EXP-${Date.now()}`;
    const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId) as any;
    if (existing) return mapExpense(existing);
    const amount = Number(payload.amount);
    if (!payload.category?.trim() || !payload.description?.trim()) throw new Error('تصنيف ووصف المصروف مطلوبان');
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('مبلغ المصروف يجب أن يكون أكبر من صفر');
    const now = new Date().toISOString();
    const expenseDate = payload.expenseDate || now.slice(0, 10);
    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO expenses (id, category, amount, expense_date, payment_method, description, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(expenseId, payload.category.trim(), round2(amount), expenseDate, payload.paymentMethod || 'cash', payload.description.trim(), payload.notes || null, now);
      insertCashTransaction(db, {
        id: `CASH-EXP-${expenseId}`,
        direction: 'out',
        sourceType: 'expense',
        sourceId: expenseId,
        referenceNumber: expenseId,
        amount: round2(amount),
        paymentMethod: payload.paymentMethod || 'cash',
        transactionDate: expenseDate,
        description: payload.description.trim(),
        notes: payload.notes || undefined,
        createdAt: now
      });
    });
    tx();
    return mapExpense(db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId));
  });

  safeIpcHandle(ipcMain, 'cash:list', async () => {
    return (db.prepare('SELECT * FROM cash_transactions ORDER BY transaction_date DESC, created_at DESC').all() as any[]).map(mapCashTransaction);
  });

  safeIpcHandle(ipcMain, 'cash:createAdjustment', async (_, payload: any) => {
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('مبلغ الحركة يجب أن يكون أكبر من صفر');
    if (!payload.description?.trim()) throw new Error('وصف الحركة المالية مطلوب');
    const id = payload.id || `CASH-${Date.now()}`;
    const existing = db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(id) as any;
    if (existing) return mapCashTransaction(existing);
    const transaction: CashTransaction = {
      id,
      direction: payload.direction === 'out' ? 'out' : 'in',
      sourceType: payload.sourceType || 'adjustment',
      sourceId: payload.sourceId,
      referenceNumber: payload.referenceNumber,
      amount: round2(amount),
      paymentMethod: payload.paymentMethod || 'cash',
      transactionDate: payload.transactionDate || new Date().toISOString().slice(0, 10),
      description: payload.description.trim(),
      notes: payload.notes,
      createdAt: new Date().toISOString()
    };
    insertCashTransaction(db, transaction);
    return transaction;
  });

  safeIpcHandle(ipcMain, 'orderMaterials:list', async (_, orderId?: string) => {
    const rows = orderId
      ? db.prepare('SELECT * FROM order_material_usages WHERE order_id = ? ORDER BY created_at ASC').all(orderId)
      : db.prepare('SELECT * FROM order_material_usages ORDER BY created_at DESC').all();
    return (rows as any[]).map((row): OrderMaterialUsage => ({
      id: row.id,
      orderId: row.order_id,
      itemType: row.item_type,
      itemId: row.item_id || undefined,
      itemName: row.item_name,
      quantity: row.quantity,
      unit: row.unit,
      unitCostAtUsage: row.unit_cost_at_usage,
      totalCost: row.total_cost,
      sourceMovementId: row.source_movement_id || undefined,
      createdAt: row.created_at
    }));
  });


  // -------------------------------------------------------------
  // THOBE TYPES & COLORS IPC HANDLERS
  // -------------------------------------------------------------
  safeIpcHandle(ipcMain, 'thobeTypes:list', async () => {
    return db.prepare('SELECT id, name, default_price as defaultPrice, description FROM dress_types ORDER BY name ASC').all();
  });

  safeIpcHandle(ipcMain, 'thobeTypes:create', async (_, item: Partial<ThobeType>) => {
    const id = item.id || `TH-${Date.now()}`;
    db.prepare('INSERT INTO dress_types (id,name,default_price,description) VALUES (?,?,?,?)')
      .run(id, item.name || 'نوع جديد', item.defaultPrice || 0, item.description || '');
    return { ...item, id } as ThobeType;
  });

  safeIpcHandle(ipcMain, 'thobeTypes:update', async (_, item: ThobeType) => {
    db.prepare('UPDATE dress_types SET name=?, default_price=?, description=? WHERE id=?')
      .run(item.name, item.defaultPrice || 0, item.description || '', item.id);
    return true;
  });

  safeIpcHandle(ipcMain, 'colors:list', async () => {
    return db.prepare('SELECT id, name, hex FROM colors ORDER BY name ASC').all();
  });

  safeIpcHandle(ipcMain, 'colors:create', async (_, item: Partial<ColorItem>) => {
    const id = item.id || `COL-${Date.now()}`;
    db.prepare('INSERT INTO colors (id,name,hex) VALUES (?,?,?)')
      .run(id, item.name || 'لون جديد', item.hex || '#ffffff');
    return { ...item, id } as ColorItem;
  });

  safeIpcHandle(ipcMain, 'colors:update', async (_, item: ColorItem) => {
    db.prepare('UPDATE colors SET name=?, hex=? WHERE id=?')
      .run(item.name, item.hex, item.id);
    return true;
  });

  // -------------------------------------------------------------
  // ORDERS & TRANSACTIONS IPC HANDLERS
  // -------------------------------------------------------------
  safeIpcHandle(ipcMain, 'orders:events:list', async (_, orderId?: string) => {
    const rows = orderId
      ? db.prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at DESC').all(orderId)
      : db.prepare('SELECT * FROM order_events ORDER BY created_at DESC').all();
    return (rows as any[]).map(mapOrderEvent);
  });

  safeIpcHandle(ipcMain, 'orders:list', async () => {
    const rows = db.prepare('SELECT * FROM orders ORDER BY order_date DESC, created_at DESC').all() as any[];
    const materialRows = db.prepare('SELECT * FROM order_material_usages ORDER BY created_at ASC').all() as any[];
    const materialsByOrder = new Map<string, OrderMaterialUsage[]>();
    for (const row of materialRows) {
      const usage: OrderMaterialUsage = {
        id: row.id,
        orderId: row.order_id,
        itemType: row.item_type,
        itemId: row.item_id || undefined,
        itemName: row.item_name,
        quantity: row.quantity,
        unit: row.unit,
        unitCostAtUsage: row.unit_cost_at_usage,
        totalCost: row.total_cost,
        sourceMovementId: row.source_movement_id || undefined,
        createdAt: row.created_at
      };
      materialsByOrder.set(row.order_id, [...(materialsByOrder.get(row.order_id) || []), usage]);
    }
    return rows.map(o => {
      const materialUsages = materialsByOrder.get(o.id) || [];
      const legacyFabricCost = materialUsages.length === 0
        ? round2((o.fabric_consumption_meters || 0) * (o.fabric_buy_price_at_order || 0))
        : 0;
      const materialCost = round2(materialUsages.reduce((sum, usage) => sum + usage.totalCost, 0) + legacyFabricCost);
      return {
        id: o.id,
        orderNumber: o.order_number,
        customerId: o.customer_id,
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
        materialUsages,
        materialCost,
        profit: round2((o.total_amount || 0) - materialCost),
        orderDate: o.order_date,
        deliveryDate: o.delivery_date,
        status: o.status,
        totalAmount: o.total_amount,
        paidAmount: o.paid_amount,
        remainingAmount: o.remaining_amount,
        isCustomMeasurement: Boolean(o.is_custom_measurement),
        measurements: parseMeasurementsJson(o.measurements_json),
        styleDetails: parseStyleDetailsJson(o.style_details_json),
        notes: o.notes,
        createdAt: o.created_at
      };
    });
  });

  /**
   * TRANSACTION REQUIREMENT: Create Order + Deduct Fabric Stock synchronously inside db.transaction()
   */
  safeIpcHandle(ipcMain, 'orders:create', async (_, orderData: Partial<Order>) => {
    if (orderData.id || orderData.orderNumber) {
      const alreadyCreated = orderData.id
        ? db.prepare('SELECT id, order_number, remaining_amount FROM orders WHERE id = ?').get(orderData.id) as any
        : db.prepare('SELECT id, order_number, remaining_amount FROM orders WHERE order_number = ?').get(orderData.orderNumber) as any;
      if (alreadyCreated) {
        return { ...orderData, id: alreadyCreated.id, orderNumber: alreadyCreated.order_number, remainingAmount: alreadyCreated.remaining_amount };
      }
    }
    const settings = dbManager.getSettings();
    const rate = settings.fabricConsumptionRatePerGarment || 3.5;
    const garmentCount = orderData.garmentCount || 1;
    const requiredMeters = garmentCount * rate;

    // Execute in a single atomic transaction
    const createOrderTx = db.transaction(() => {
      const orderId = orderData.id || `ORD-${Date.now()}`;
      const count = (db.prepare('SELECT COUNT(*) as c FROM orders').get() as any).c;
      const orderNumber = orderData.orderNumber || `${1001 + count}`;
      const totalAmount = orderData.totalAmount || 0;
      const paidAmount = orderData.paidAmount || 0;
      const remainingAmount = totalAmount - paidAmount;

      // 1. Check Fabric Stock Availability and write an auditable sale movement
      let fabricBuyPrice = 0;
      let fabricMovement: StockMovement | undefined;
      if (orderData.fabricId) {
        const fab = db.prepare('SELECT * FROM fabrics WHERE id = ?').get(orderData.fabricId) as any;
        if (!fab) throw new Error('القماش المختار غير موجود في المخزون');
        fabricBuyPrice = fab.purchase_price || 0;
        fabricMovement = insertInventoryMovement(db, 'fabric', orderData.fabricId, -requiredMeters, 'sale', 'استهلاك قماش للطلب', {
          type: 'order', id: orderId, number: orderNumber
        });
      }

      // 3. Insert Order
      db.prepare(`
        INSERT INTO orders (
          id, order_number, customer_id, customer_name, customer_phone,
          thobe_type_id, thobe_type_name, fabric_id, fabric_name, fabric_color,
          fabric_consumption_meters, fabric_buy_price_at_order, garment_count,
          order_date, delivery_date, status, total_amount, paid_amount, remaining_amount,
          is_custom_measurement, measurements_json, style_details_json, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderId,
        orderNumber,
        orderData.customerId,
        orderData.customerName,
        orderData.customerPhone,
        orderData.thobeTypeId || null,
        orderData.thobeTypeName || 'ثوب',
        orderData.fabricId || null,
        orderData.fabricName || 'قماش',
        orderData.fabricColor || 'أبيض',
        requiredMeters,
        fabricBuyPrice,
        garmentCount,
        orderData.orderDate || new Date().toISOString().slice(0, 10),
        orderData.deliveryDate || new Date().toISOString().slice(0, 10),
        orderData.status || 'new',
        totalAmount,
        paidAmount,
        remainingAmount,
        orderData.isCustomMeasurement ? 1 : 0,
        JSON.stringify(normalizeMeasurements(orderData.measurements)),
        JSON.stringify(normalizeStyleDetails(orderData.styleDetails)),
        orderData.notes || '',
        new Date().toISOString()
      );

      // 4. Record material snapshots. Fabric is always included; optional accessory usages are consumed atomically.
      const materialUsages: OrderMaterialUsage[] = [];
      if (orderData.fabricId && fabricMovement) {
        const fabricCost = round2(requiredMeters * fabricBuyPrice);
        const usage: OrderMaterialUsage = {
          id: `OMU-${Date.now()}-fabric`,
          orderId,
          itemType: 'fabric',
          itemId: orderData.fabricId,
          itemName: orderData.fabricName || 'قماش',
          quantity: requiredMeters,
          unit: 'متر',
          unitCostAtUsage: fabricBuyPrice,
          totalCost: fabricCost,
          sourceMovementId: fabricMovement.id,
          createdAt: new Date().toISOString()
        };
        db.prepare(`
          INSERT INTO order_material_usages (id, order_id, item_type, item_id, item_name, quantity, unit, unit_cost_at_usage, total_cost, source_movement_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(usage.id, usage.orderId, usage.itemType, usage.itemId, usage.itemName, usage.quantity, usage.unit, usage.unitCostAtUsage, usage.totalCost, usage.sourceMovementId, usage.createdAt);
        materialUsages.push(usage);
      }

      for (const material of (orderData.materialUsages || [])) {
        if (!material.itemId || (material.itemType === 'fabric' && material.itemId === orderData.fabricId)) continue;
        const quantity = Number(material.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('كمية المادة المرتبطة بالطلب غير صحيحة');
        const meta = inventoryMeta(db, material.itemType, material.itemId);
        const movement = insertInventoryMovement(db, material.itemType, material.itemId, -quantity, 'sale', 'استهلاك مادة للطلب', {
          type: 'order', id: orderId, number: orderNumber
        });
        const unitCost = Number.isFinite(Number(material.unitCostAtUsage)) ? Number(material.unitCostAtUsage) : Number(meta.purchasePrice || 0);
        const usage: OrderMaterialUsage = {
          id: `OMU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          orderId,
          itemType: material.itemType,
          itemId: material.itemId,
          itemName: material.itemName || meta.name,
          quantity,
          unit: material.unit || meta.unit,
          unitCostAtUsage: unitCost,
          totalCost: round2(quantity * unitCost),
          sourceMovementId: movement.id,
          createdAt: new Date().toISOString()
        };
        db.prepare(`
          INSERT INTO order_material_usages (id, order_id, item_type, item_id, item_name, quantity, unit, unit_cost_at_usage, total_cost, source_movement_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(usage.id, usage.orderId, usage.itemType, usage.itemId, usage.itemName, usage.quantity, usage.unit, usage.unitCostAtUsage, usage.totalCost, usage.sourceMovementId, usage.createdAt);
        materialUsages.push(usage);
      }

      // 5. Create Matching Invoice Record
      const invId = `INV-${orderNumber}`;
      const pStatus = remainingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
      const initialPaymentId = paidAmount > 0 ? `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` : undefined;
      const initialPayments = paidAmount > 0 ? [{
        id: initialPaymentId,
        invoiceId: invId,
        orderId: orderId,
        amount: paidAmount,
        paymentDate: orderData.orderDate || new Date().toISOString().slice(0, 10),
        method: orderData.initialPaymentMethod || 'cash',
        note: 'دفعة أولى عند إنشاء الطلب'
      }] : [];

      db.prepare(`
        INSERT INTO invoices (
          id, invoice_number, order_id, customer_name, customer_phone,
          order_date, total_amount, paid_amount, remaining_amount, payment_status, payments_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invId,
        `INV-${orderNumber}`,
        orderId,
        orderData.customerName,
        orderData.customerPhone,
        orderData.orderDate || new Date().toISOString().slice(0, 10),
        totalAmount,
        paidAmount,
        remainingAmount,
        pStatus,
        JSON.stringify(initialPayments)
      );

      if (paidAmount > 0 && initialPaymentId) {
        insertCashTransaction(db, {
          id: `CASH-PAY-${initialPaymentId}`,
          direction: 'in',
          sourceType: 'customer_payment',
          sourceId: initialPaymentId,
          orderId,
          referenceNumber: orderNumber,
          amount: paidAmount,
          paymentMethod: orderData.initialPaymentMethod || 'cash',
          transactionDate: orderData.orderDate || new Date().toISOString().slice(0, 10),
          description: `دفعة أولى للطلب #${orderNumber}`,
          createdAt: new Date().toISOString()
        });
      }

      const materialCost = round2(materialUsages.reduce((sum, usage) => sum + usage.totalCost, 0));
      insertOrderEvent(db, {
        id: `EVT-CREATED-${orderId}`,
        orderId,
        type: 'created',
        title: 'تم إنشاء الطلب',
        description: `تم إنشاء الطلب #${orderNumber} وتسجيل الفاتورة${paidAmount > 0 ? ' والدفعة الأولى' : ''}.`,
        toStatus: orderData.status || 'new',
        actor: 'النظام',
        metadata: { materialCost, paidAmount, remainingAmount },
        createdAt: new Date().toISOString()
      });
      return { orderId, orderNumber, remainingAmount, materialUsages, materialCost, profit: round2(totalAmount - materialCost) };
    });

    const result = createOrderTx();
    return {
      ...orderData,
      id: result.orderId,
      orderNumber: result.orderNumber,
      remainingAmount: result.remainingAmount,
      materialUsages: result.materialUsages,
      materialCost: result.materialCost,
      profit: result.profit,
      measurements: normalizeMeasurements(orderData.measurements),
      styleDetails: normalizeStyleDetails(orderData.styleDetails),
    };
  });

  /**
   * TRANSACTION REQUIREMENT: Update order + Adjust fabric deduction differences cleanly
   */
  safeIpcHandle(ipcMain, 'orders:update', async (_, updatedOrder: Order) => {
    const updateTx = db.transaction(() => {
      const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(updatedOrder.id) as any;
      if (!existing) throw new Error('الطلب المطلوب غير موجود');

      const settings = dbManager.getSettings();
      const rate = settings.fabricConsumptionRatePerGarment || 3.5;
      const newMeters = (updatedOrder.garmentCount || 1) * rate;

      // Handle Fabric Exchange logic through auditable return/sale movements.
      const fabricChanged = existing.fabric_id !== updatedOrder.fabricId;
      const countChanged = existing.garment_count !== updatedOrder.garmentCount;
      const materialRows = db.prepare('SELECT * FROM order_material_usages WHERE order_id = ? ORDER BY created_at ASC').all(updatedOrder.id) as any[];
      const materialChanged = fabricChanged || countChanged || updatedOrder.materialUsages !== undefined;

      if (materialChanged && existing.status !== 'cancelled') {
        for (const oldMaterial of materialRows) {
          if (oldMaterial.item_id) {
            insertInventoryMovement(db, oldMaterial.item_type, oldMaterial.item_id, oldMaterial.quantity, 'return', 'إرجاع استهلاك مادة بعد تعديل الطلب', {
              type: 'order_update', id: updatedOrder.id, number: existing.order_number
            });
          }
        }

        if (updatedOrder.fabricId) {
          const newFab = db.prepare('SELECT * FROM fabrics WHERE id = ?').get(updatedOrder.fabricId) as any;
          if (!newFab) throw new Error('القماش الجديد المختار غير موجود');
          if (fabricChanged) updatedOrder.fabricBuyPriceAtOrder = newFab.purchase_price || 0;
          else updatedOrder.fabricBuyPriceAtOrder = existing.fabric_buy_price_at_order || updatedOrder.fabricBuyPriceAtOrder || 0;
          const newFabricMovement = insertInventoryMovement(db, 'fabric', updatedOrder.fabricId, -newMeters, 'sale', 'استهلاك قماش بعد تعديل الطلب', {
            type: 'order_update', id: updatedOrder.id, number: existing.order_number
          });
          const fabricUsageCost = round2(newMeters * (updatedOrder.fabricBuyPriceAtOrder || 0));
          db.prepare('DELETE FROM order_material_usages WHERE order_id = ?').run(updatedOrder.id);
          db.prepare(`
            INSERT INTO order_material_usages (id, order_id, item_type, item_id, item_name, quantity, unit, unit_cost_at_usage, total_cost, source_movement_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            `OMU-${Date.now()}-fabric-update`, updatedOrder.id, 'fabric', updatedOrder.fabricId,
            updatedOrder.fabricName || 'قماش', newMeters, 'متر', updatedOrder.fabricBuyPriceAtOrder || 0,
            fabricUsageCost, newFabricMovement.id, new Date().toISOString()
          );
          for (const material of (updatedOrder.materialUsages || materialRows.filter((row) => row.item_type !== 'fabric'))) {
            if (!material.item_id && !material.itemId) continue;
            const itemId = material.itemId || material.item_id;
            if (material.itemType === 'fabric' && itemId === updatedOrder.fabricId) continue;
            const quantity = Number(material.quantity);
            if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('كمية المادة المرتبطة بالطلب غير صحيحة');
            const meta = inventoryMeta(db, material.itemType || material.item_type, itemId);
            const movement = insertInventoryMovement(db, material.itemType || material.item_type, itemId, -quantity, 'sale', 'استهلاك مادة بعد تعديل الطلب', {
              type: 'order_update', id: updatedOrder.id, number: existing.order_number
            });
            const unitCost = Number(material.unitCostAtUsage ?? material.unit_cost_at_usage ?? meta.purchasePrice ?? 0);
            db.prepare(`
              INSERT INTO order_material_usages (id, order_id, item_type, item_id, item_name, quantity, unit, unit_cost_at_usage, total_cost, source_movement_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              `OMU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, updatedOrder.id,
              material.itemType || material.item_type, itemId, material.itemName || material.item_name || meta.name,
              quantity, material.unit || meta.unit, unitCost, round2(quantity * unitCost), movement.id, new Date().toISOString()
            );
          }
        }
      }

      // Financial Calculation
      const totalAmount = updatedOrder.totalAmount || 0;
      const paidAmount = updatedOrder.paidAmount || 0;
      const remainingAmount = totalAmount - paidAmount;

      db.prepare(`
        UPDATE orders SET
          customer_name = ?, customer_phone = ?, thobe_type_id = ?, thobe_type_name = ?,
          fabric_id = ?, fabric_name = ?, fabric_color = ?, garment_count = ?,
          fabric_consumption_meters = ?, delivery_date = ?, status = ?,
          total_amount = ?, paid_amount = ?, remaining_amount = ?,
          measurements_json = ?, style_details_json = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `).run(
        updatedOrder.customerName, updatedOrder.customerPhone,
        updatedOrder.thobeTypeId, updatedOrder.thobeTypeName,
        updatedOrder.fabricId, updatedOrder.fabricName, updatedOrder.fabricColor,
        updatedOrder.garmentCount || 1, newMeters, updatedOrder.deliveryDate,
        updatedOrder.status, totalAmount, paidAmount, remainingAmount,
        JSON.stringify(normalizeMeasurements(updatedOrder.measurements)),
        JSON.stringify(normalizeStyleDetails(updatedOrder.styleDetails)),
        updatedOrder.notes || '', new Date().toISOString(),
        updatedOrder.id
      );

      // Update invoice as well
      const pStatus = remainingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
      db.prepare(`
        UPDATE invoices SET
          total_amount = ?, paid_amount = ?, remaining_amount = ?, payment_status = ?
        WHERE order_id = ?
      `).run(totalAmount, paidAmount, remainingAmount, pStatus, updatedOrder.id);
    });

    updateTx();
    return true;
  });

  /**
   * TRANSACTION REQUIREMENT: Delete order + return fabric stock automatically
   */
  safeIpcHandle(ipcMain, 'orders:delete', async (_, orderId: string) => {
    const deleteTx = db.transaction(() => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
      if (order && order.status !== 'cancelled') {
        const materials = db.prepare('SELECT * FROM order_material_usages WHERE order_id = ?').all(orderId) as any[];
        for (const material of materials) {
          if (material.item_id) {
            insertInventoryMovement(db, material.item_type, material.item_id, material.quantity, 'return', 'إرجاع مواد بسبب حذف الطلب', {
              type: 'order_delete', id: orderId, number: order.order_number
            });
          }
        }
      }

      // Keep money auditable: reverse existing receipts instead of silently erasing cash history.
      const invoice = db.prepare('SELECT * FROM invoices WHERE order_id = ?').get(orderId) as any;
      if (invoice) {
        const payments: PaymentRecord[] = JSON.parse(invoice.payments_json || '[]');
        for (const payment of payments) {
          const reversalId = `CASH-REV-${payment.id}`;
          const alreadyReversed = db.prepare('SELECT id FROM cash_transactions WHERE id = ?').get(reversalId) as any;
          if (!alreadyReversed) {
            insertCashTransaction(db, {
              id: reversalId,
              direction: 'out',
              sourceType: 'adjustment',
              sourceId: payment.id,
              referenceNumber: order.order_number,
              amount: payment.amount,
              paymentMethod: payment.method,
              transactionDate: new Date().toISOString().slice(0, 10),
              description: `عكس دفعة بسبب حذف الطلب #${order.order_number}`,
              createdAt: new Date().toISOString()
            });
          }
        }
      }

      db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
      db.prepare('DELETE FROM invoices WHERE order_id = ?').run(orderId);
      db.prepare('DELETE FROM order_material_usages WHERE order_id = ?').run(orderId);
    });

    deleteTx();
    return true;
  });

  /**
   * TRANSACTION REQUIREMENT: Status Change to Cancelled -> Restore fabric
   */
  safeIpcHandle(ipcMain, 'orders:updateStatus', async (_, orderId: string, status: string) => {
    const statusTx = db.transaction(() => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
      if (!order) return;

      if (status === 'cancelled' && order.status !== 'cancelled') {
        const materials = db.prepare('SELECT * FROM order_material_usages WHERE order_id = ?').all(orderId) as any[];
        for (const material of materials) {
          if (material.item_id) {
            insertInventoryMovement(db, material.item_type, material.item_id, material.quantity, 'return', 'إرجاع مواد بسبب إلغاء الطلب', {
              type: 'order_cancel', id: orderId, number: order.order_number
            });
          }
        }
      } else if (order.status === 'cancelled' && status !== 'cancelled') {
        const materials = db.prepare('SELECT * FROM order_material_usages WHERE order_id = ?').all(orderId) as any[];
        for (const material of materials) {
          if (material.item_id) {
            insertInventoryMovement(db, material.item_type, material.item_id, -material.quantity, 'sale', 'إعادة استهلاك مواد بعد إلغاء الإلغاء', {
              type: 'order_reactivate', id: orderId, number: order.order_number
            });
          }
        }
      }

      db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), orderId);
      if (order.status !== status) {
        insertOrderEvent(db, {
          id: `EVT-STATUS-${orderId}-${Date.now()}`,
          orderId,
          type: 'status_changed',
          title: `تغيير الحالة إلى ${status}`,
          description: `تم تغيير حالة الطلب من ${order.status} إلى ${status}${status === 'cancelled' ? ' مع إعادة المواد للمخزون' : order.status === 'cancelled' ? ' مع إعادة استهلاك المواد' : ''}.`,
          fromStatus: order.status,
          toStatus: status,
          actor: 'النظام',
          createdAt: new Date().toISOString()
        });
      }
    });

    statusTx();
    return true;
  });

  // -------------------------------------------------------------
  // INVOICES & PAYMENTS IPC
  // -------------------------------------------------------------
  safeIpcHandle(ipcMain, 'invoices:list', async () => {
    const rows = db.prepare('SELECT * FROM invoices ORDER BY order_date DESC').all() as any[];
    return rows.map(i => ({
      id: i.id,
      invoiceNumber: i.invoice_number,
      orderId: i.order_id,
      customerName: i.customer_name,
      customerPhone: i.customer_phone,
      orderDate: i.order_date,
      totalAmount: i.total_amount,
      paidAmount: i.paid_amount,
      remainingAmount: i.remaining_amount,
      paymentStatus: i.payment_status,
      payments: JSON.parse(i.payments_json || '[]')
    }));
  });

  safeIpcHandle(ipcMain, 'invoices:addPayment', async (_, invoiceId: string, amount: number, method: string, note: string, paymentId?: string) => {
    const paymentTx = db.transaction(() => {
      const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as any;
      if (!inv) throw new Error('الفاتورة غير موجودة');
      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('مبلغ الدفعة يجب أن يكون أكبر من صفر');

      const existingPayments: PaymentRecord[] = JSON.parse(inv.payments_json || '[]');
      const id = paymentId || `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      if (existingPayments.some((payment) => payment.id === id) || db.prepare('SELECT id FROM cash_transactions WHERE source_id = ?').get(id)) {
        return;
      }
      if (numericAmount > inv.remaining_amount) throw new Error('مبلغ الدفعة يتجاوز المتبقي على الفاتورة');
      const newPayment: PaymentRecord = {
        id,
        invoiceId,
        orderId: inv.order_id,
        amount: numericAmount,
        paymentDate: new Date().toISOString().slice(0, 10),
        method: method as any,
        note
      };

      existingPayments.push(newPayment);

      const newPaid = inv.paid_amount + numericAmount;
      const newRemaining = inv.total_amount - newPaid;
      const newStatus = newRemaining <= 0 ? 'paid' : 'partial';

      db.prepare(`
        UPDATE invoices SET
          paid_amount = ?, remaining_amount = ?, payment_status = ?, payments_json = ?
        WHERE id = ?
      `).run(newPaid, newRemaining, newStatus, JSON.stringify(existingPayments), invoiceId);

      // Synchronize order record as well
      db.prepare(`
        UPDATE orders SET
          paid_amount = ?, remaining_amount = ?
        WHERE id = ?
      `).run(newPaid, newRemaining, inv.order_id);

      insertCashTransaction(db, {
        id: `CASH-PAY-${id}`,
        direction: 'in',
        sourceType: 'customer_payment',
        sourceId: id,
        orderId: inv.order_id,
        referenceNumber: inv.invoice_number,
        amount: numericAmount,
        paymentMethod: method as any,
        transactionDate: new Date().toISOString().slice(0, 10),
        description: `دفعة عميل للفاتورة ${inv.invoice_number}`,
        notes: note || undefined,
        createdAt: new Date().toISOString()
      });
      insertOrderEvent(db, {
        id: `EVT-PAYMENT-${id}`,
        orderId: inv.order_id,
        type: 'payment',
        title: 'تم تسجيل دفعة',
        description: `تم تسجيل دفعة بقيمة ${numericAmount} للفاتورة ${inv.invoice_number}.`,
        actor: 'النظام',
        metadata: { paymentId: id, amount: numericAmount, method, remainingAmount: newRemaining },
        createdAt: new Date().toISOString()
      });
    });

    paymentTx();
    return true;
  });

  // -------------------------------------------------------------
  // SYSTEM & REPORTS IPC
  // -------------------------------------------------------------
  safeIpcHandle(ipcMain, 'system:backup', async () => {
    return dbManager.backupDatabase('manual_user');
  });

  safeIpcHandle(ipcMain, 'system:restore', async (_, jsonContent: string) => {
    return dbManager.restoreFromJson(jsonContent);
  });

  safeIpcHandle(ipcMain, 'reports:exportExcel', async (_, startDate?: string, endDate?: string) => {
    const buffer = dbManager.generateExcelReport(startDate, endDate);
    return buffer.toString('base64');
  });

  safeIpcHandle(ipcMain, 'settings:get', async () => {
    return dbManager.getSettings();
  });

  safeIpcHandle(ipcMain, 'settings:update', async (_, key: any, value: any) => {
    dbManager.updateSetting(key, value);
    return true;
  });

  safeIpcHandle(ipcMain, 'whatsapp:send', async (_, phone: string, customerName: string, orderNumber: string, statusText: string) => {
    const internationalPhone = phone.startsWith('0') ? '966' + phone.slice(1) : phone;
    const message = `مرحباً بك أ/ ${customerName}، نفيدك بنتيجة متابعة طلبك رقم (#${orderNumber}) لدى صهوة للخياطة. حالياً: ${statusText}. يسعدنا تواصلكم دائماً!`;
    const whatsappUrl = `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`;
    
    try {
      const { shell } = require('electron');
      await shell.openExternal(whatsappUrl);
    } catch (e) {
      console.error('Failed to open external WhatsApp URL:', e);
    }

    // Insert notification log into SQLite
    try {
      const notifId = `NOTIF-${Date.now()}`;
      const dateStr = new Date().toLocaleString('ar-SA');
      db.prepare(`
        INSERT INTO notifications (id, type, title, message, date, read, customer_phone, order_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        notifId,
        'whatsapp',
        `تذكير واتساب - طلب #${orderNumber}`,
        `تم إرسال رسالة واتساب للعميل ${customerName} (${phone}) - الحالة: ${statusText}`,
        dateStr,
        1,
        phone,
        (db.prepare('SELECT id FROM orders WHERE order_number = ?').get(orderNumber) as any)?.id || null
      );
      const order = db.prepare('SELECT id FROM orders WHERE order_number = ?').get(orderNumber) as any;
      if (order) {
        insertOrderEvent(db, {
          id: `EVT-WHATSAPP-${notifId}`,
          orderId: order.id,
          type: 'whatsapp',
          title: 'فتح رسالة واتساب',
          description: `تم تجهيز رسالة واتساب للعميل ${customerName} عن حالة الطلب: ${statusText}.`,
          actor: 'النظام',
          metadata: { phone, orderNumber, statusText },
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Failed to insert notification into database', err);
    }

    return true;
  });
}

