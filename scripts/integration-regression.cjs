const fs = require('fs');
const os = require('os');
const childProcess = require('child_process');
const path = require('path');
const assert = require('assert');
const { app, ipcMain } = require('electron');
const { SahwaDatabaseManager } = require('../dist-electron/db.js');
const { registerIpcHandlers } = require('../dist-electron/ipcHandlers.js');
const XLSX = require('xlsx');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sahwa-integration-'));
const databaseDir = path.join(root, 'database');
const backupDir = path.join(root, 'backups');
const results = [];

function record(name, fn) {
  return Promise.resolve().then(fn).then(() => {
    results.push({ name, status: 'passed' });
  }).catch((error) => {
    results.push({ name, status: 'failed', error: error?.message || String(error) });
    throw error;
  });
}

function call(channel, ...args) {
  const registry = ipcMain._invokeHandlers || ipcMain._invokeHandlersMap;
  const entry = registry && registry.get(channel);
  const handler = typeof entry === 'function' ? entry : entry?.callback;
  if (!handler) throw new Error(`IPC handler not registered: ${channel}`);
  return handler({ sender: null }, ...args);
}

async function main() {
  await app.whenReady();
  const manager = new SahwaDatabaseManager(databaseDir, undefined, backupDir);
  const init = manager.initDatabase();
  assert.equal(init.success, true, init.error || 'database initialization failed');
  registerIpcHandlers(manager);

  await record('real IPC bridge registry', async () => {
    for (const channel of ['customers:create', 'customers:update', 'orders:create', 'orders:update', 'orders:delete', 'invoices:addPayment', 'purchases:create', 'reports:exportExcel', 'system:backup', 'system:restore', 'system:clearAllData', 'system:integrityCheck']) {
      assert.ok((ipcMain._invokeHandlers || ipcMain._invokeHandlersMap).has(channel), channel);
    }
  });

  await record('clear data integration path', async () => {
    const cleared = await call('system:clearAllData');
    assert.equal(cleared, true);
    const db = manager.getRawDb();
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM customers').get().count, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 0);
    assert.equal(fs.readdirSync(backupDir).some((file) => file.includes('pre_clear')), true);
  });

  const customerId = 'CUST-INT-001';
  const fabricId = 'FAB-INT-001';
  const accessoryId = 'ACC-INT-001';
  const orderId = 'ORD-INT-001';
  const orderNumber = 'INT-1001';

  await record('create customer, save measurements, and measurement history', async () => {
    const customer = await call('customers:create', {
      id: customerId, name: 'عميل تكامل', phone: '0500000001',
      measurements: { frontLength: '150', neckSize: '42' }, styleDetails: { neckType: 'قلاب' }
    });
    assert.equal(customer.id, customerId);
    const updated = { ...customer, measurements: { ...customer.measurements, frontLength: '152', sleeveLength: '63' } };
    assert.equal(await call('customers:update', updated), true);
    const afterUpdate = (await call('customers:list')).find((item) => item.id === customerId);
    assert.equal(afterUpdate.measurements.frontLength, '152');
    assert.equal(afterUpdate.measurementHistory.length, 1);
    assert.equal(afterUpdate.measurementHistory[0].measurements.frontLength, '150');
    const history = await call('customers:saveMeasurementHistory', customerId, 'قياس التكامل');
    assert.equal(history.note, 'قياس التكامل');
    const afterHistory = (await call('customers:list')).find((item) => item.id === customerId);
    assert.equal(afterHistory.measurementHistory.length, 2);
  });

  await record('create fabric and accessory inventory', async () => {
    const fabric = await call('fabrics:create', {
      id: fabricId, name: 'قماش تكامل', color: 'أبيض', colorHex: '#fff', purchasePrice: 40,
      sellingPrice: 100, quantityMeters: 30, minStockMeters: 2
    });
    const accessory = await call('accessories:create', {
      id: accessoryId, name: 'سحاب تكامل', category: 'سحابات', quantity: 10, minStock: 2, unit: 'حبة', purchasePrice: 5, sellingPrice: 12
    });
    assert.equal(fabric.quantityMeters, 30);
    assert.equal(accessory.quantity, 10);
    await call('accessories:update', { ...accessory, sellingPrice: 12, quantity: 999 });
    const loadedInventory = (await call('data:get')).accessories.find((item) => item.id === accessoryId);
    assert.equal(loadedInventory.purchasePrice, 5);
    assert.equal(loadedInventory.sellingPrice, 12);
    assert.equal(loadedInventory.quantity, 10);
    await call('fabrics:update', { ...fabric, quantityMeters: 999, purchasePrice: 40, sellingPrice: 100 });
    const afterCatalogUpdate = (await call('fabrics:list')).find((item) => item.id === fabricId);
    assert.equal(afterCatalogUpdate.quantityMeters, 30);
  });

  const orderPayload = {
    id: orderId, orderNumber, customerId, customerName: 'عميل تكامل', customerPhone: '0500000001',
    thobeTypeId: 'THB-01', thobeTypeName: 'ثوب سعودي كلاسيك', fabricId, fabricName: 'قماش تكامل', fabricColor: 'أبيض',
    garmentCount: 1, totalAmount: 300, paidAmount: 100, initialPaymentMethod: 'cash',
    orderDate: '2026-08-16', deliveryDate: '2026-08-20', measurements: { frontLength: '152', sleeveLength: '63' },
    styleDetails: { neckType: 'قلاب' }, materialUsages: [{ itemType: 'accessory', itemId: accessoryId, itemName: 'سحاب تكامل', quantity: 2, unit: 'حبة', unitCostAtUsage: 5 }]
  };

  await record('create order, material usage, invoice, initial payment, and profit', async () => {
    const order = await call('orders:create', orderPayload);
    assert.equal(order.id, orderId);
    assert.equal(order.materialCost, 150);
    assert.equal(order.profit, 150);
    const db = manager.getRawDb();
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders WHERE id = ?').get(orderId).count, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM invoices WHERE order_id = ?').get(orderId).count, 1);
    assert.equal(db.prepare('SELECT quantity_meters FROM fabrics WHERE id = ?').get(fabricId).quantity_meters, 26.5);
    assert.equal(db.prepare('SELECT quantity FROM accessories WHERE id = ?').get(accessoryId).quantity, 8);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM cash_transactions WHERE order_id = ?').get(orderId).count, 1);
  });

  await record('duplicate order save is idempotent', async () => {
    await call('orders:create', orderPayload);
    const db = manager.getRawDb();
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders WHERE id = ?').get(orderId).count, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM inventory_movements WHERE reference_id = ?').get(orderId).count, 2);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM cash_transactions WHERE order_id = ?').get(orderId).count, 1);
  });

  await record('payment and remaining amount update are idempotent', async () => {
    const invoice = (await call('invoices:list')).find((item) => item.orderId === orderId);
    assert.ok(invoice);
    assert.equal(await call('invoices:addPayment', invoice.id, 50, 'cash', 'دفعة تكامل', 'PAY-INT-001'), true);
    assert.equal(await call('invoices:addPayment', invoice.id, 50, 'cash', 'دفعة تكامل', 'PAY-INT-001'), false);
    const updatedInvoice = (await call('invoices:list')).find((item) => item.id === invoice.id);
    assert.equal(updatedInvoice.paidAmount, 150);
    assert.equal(updatedInvoice.remainingAmount, 150);
    assert.equal((await call('cash:list')).filter((item) => item.sourceId === 'PAY-INT-001').length, 1);
  });

  await record('paidAmount cannot bypass the payment ledger', async () => {
    const currentOrder = (await call('orders:list')).find((item) => item.id === orderId);
    assert.ok(currentOrder);
    await assert.rejects(
      call('orders:update', { ...currentOrder, paidAmount: 200 }),
      /مسار الدفعات|لا يمكن تعديل المبلغ المدفوع/
    );
    const invoice = (await call('invoices:list')).find((item) => item.orderId === orderId);
    assert.equal(invoice.paidAmount, 150);
    assert.equal(invoice.payments.reduce((sum, payment) => sum + payment.amount, 0), 150);
  });

  await record('backend rejects invalid order amounts and garment counts', async () => {
    await assert.rejects(
      call('orders:create', { ...orderPayload, id: 'ORD-NEGATIVE-GARMENT', orderNumber: 'INT-NEGATIVE-GARMENT', garmentCount: -1, paidAmount: 0 }),
      /عدد الثياب/
    );
    await assert.rejects(
      call('orders:create', { ...orderPayload, id: 'ORD-OVERPAYMENT', orderNumber: 'INT-OVERPAYMENT', garmentCount: 1, paidAmount: 301 }),
      /يتجاوز/
    );
  });

  await record('payment ledger drift is rejected before a new payment', async () => {
    const db = manager.getRawDb();
    const invoice = db.prepare('SELECT * FROM invoices WHERE order_id = ?').get(orderId);
    db.prepare('UPDATE invoices SET paid_amount = 200, remaining_amount = 100 WHERE id = ?').run(invoice.id);
    await assert.rejects(
      call('invoices:addPayment', invoice.id, 10, 'cash', 'يجب رفضها', 'PAY-DRIFT-001'),
      /لا تتطابق مع سجل الدفعات/
    );
    db.prepare('UPDATE invoices SET paid_amount = 150, remaining_amount = 150 WHERE id = ?').run(invoice.id);
  });

  const oldSnapshot = manager.exportFullDataAsJson();
  const oldAccessory = oldSnapshot.accessories.find((item) => item.id === accessoryId);
  assert.equal(oldAccessory.purchasePrice, 5);
  assert.equal(oldAccessory.sellingPrice, 12);
  const oldBackupJson = JSON.stringify(oldSnapshot);

  await record('purchase increases inventory and records cash outflow', async () => {
    const purchase = await call('purchases:create', {
      id: 'PUR-INT-001', supplier: 'مورد تكامل', invoiceNumber: 'P-INT-1', purchaseDate: '2026-08-16', paymentMethod: 'cash',
      lines: [
        { itemType: 'fabric', itemId: fabricId, itemName: 'قماش تكامل', quantity: 5, unit: 'متر', unitPrice: 42 },
        { itemType: 'accessory', itemId: accessoryId, itemName: 'سحاب تكامل', quantity: 4, unit: 'حبة', unitPrice: 6 }
      ]
    });
    assert.equal(purchase.totalAmount, 234);
    const db = manager.getRawDb();
    assert.equal(db.prepare('SELECT quantity_meters FROM fabrics WHERE id = ?').get(fabricId).quantity_meters, 31.5);
    assert.equal(db.prepare('SELECT quantity FROM accessories WHERE id = ?').get(accessoryId).quantity, 12);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM cash_transactions WHERE source_id = ?').get('PUR-INT-001').count, 1);
  });

  await record('expense records one cash outflow', async () => {
    const expense = await call('expenses:create', { id: 'EXP-INT-001', category: 'تشغيل', amount: 80, expenseDate: '2026-08-16', paymentMethod: 'cash', description: 'مصروف تكامل' });
    assert.equal(expense.id, 'EXP-INT-001');
    const db = manager.getRawDb();
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM cash_transactions WHERE source_id = ?').get('EXP-INT-001').count, 1);
  });

  await record('reports and Excel export contain data', async () => {
    const report = await call('reports:exportExcel', '2026-08-01', '2026-08-31');
    assert.ok(typeof report === 'string' && report.length > 100);
    const workbook = XLSX.read(Buffer.from(report, 'base64'), { type: 'buffer' });
    assert.deepEqual(workbook.SheetNames, ['تقرير المبيعات', 'ملخص المحاسبة', 'قيمة المخزون']);
    const summaryRows = XLSX.utils.sheet_to_json(workbook.Sheets['ملخص المحاسبة']);
    assert.ok(summaryRows.some((row) => row['البيان'] === 'إجمالي المشتريات' && row['القيمة'] === 234));
    const db = manager.getRawDb();
    const totals = db.prepare(`SELECT SUM(total_amount) AS sales, SUM(paid_amount) AS paid, SUM(remaining_amount) AS remaining FROM orders WHERE order_date BETWEEN ? AND ?`).get('2026-08-01', '2026-08-31');
    assert.equal(totals.sales, 300);
    assert.equal(totals.paid, 150);
    assert.equal(totals.remaining, 150);
    const earlyReport = await call('reports:exportExcel', '2026-08-01', '2026-08-16');
    const earlyWorkbook = XLSX.read(Buffer.from(earlyReport, 'base64'), { type: 'buffer' });
    const earlySummary = XLSX.utils.sheet_to_json(earlyWorkbook.Sheets['ملخص المحاسبة']);
    const earlyCollected = earlySummary.find((row) => row['البيان'] === 'إجمالي التحصيل')['القيمة'];
    assert.equal(earlyCollected, 100);
  });

  await record('card and transfer remain separate from the cash drawer', async () => {
    const beforeCashOut = (await call('cash:list')).filter((item) => item.direction === 'out' && item.paymentMethod === 'cash').reduce((sum, item) => sum + item.amount, 0);
    await call('purchases:create', {
      id: 'PUR-CARD-001', supplier: 'مورد بطاقة', invoiceNumber: 'P-CARD-1', purchaseDate: '2026-08-19', paymentMethod: 'card',
      lines: [{ itemType: 'fabric', itemId: fabricId, itemName: 'قماش تكامل', quantity: 1, unit: 'متر', unitPrice: 42 }]
    });
    await call('expenses:create', { id: 'EXP-TRANSFER-001', category: 'تشغيل', amount: 25, expenseDate: '2026-08-19', paymentMethod: 'transfer', description: 'مصروف تحويل' });
    const transactions = await call('cash:list');
    assert.equal(transactions.some((item) => item.sourceId === 'PUR-CARD-001' && item.paymentMethod === 'card'), true);
    assert.equal(transactions.some((item) => item.sourceId === 'EXP-TRANSFER-001' && item.paymentMethod === 'transfer'), true);
    const afterCashOut = transactions.filter((item) => item.direction === 'out' && item.paymentMethod === 'cash').reduce((sum, item) => sum + item.amount, 0);
    assert.equal(afterCashOut, beforeCashOut);
  });

  await record('backup, restore of older snapshot, and persistence after reopen', async () => {
    const backup = await call('system:backup');
    assert.ok(typeof backup === 'string' && backup.length > 100);
    const sqliteBackups = fs.readdirSync(backupDir).filter((fileName) => fileName.includes('manual_user') && fileName.endsWith('.db'));
    assert.ok(sqliteBackups.length > 0);
    const restoreResult = await call('system:restore', oldBackupJson);
    assert.equal(restoreResult.success, true);
    const db = manager.getRawDb();
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM purchases WHERE id = ?').get('PUR-INT-001').count, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM expenses WHERE id = ?').get('EXP-INT-001').count, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders WHERE id = ?').get(orderId).count, 1);
    const restoredAccessory = (await call('accessories:list')).find((item) => item.id === accessoryId);
    assert.equal(restoredAccessory.purchasePrice, 5);
    assert.equal(restoredAccessory.sellingPrice, 12);
    const integrity = await call('system:integrityCheck');
    assert.equal(integrity.ok, true, JSON.stringify(integrity.issues));
  });

  await record('restore rejects business-inconsistent backup without changing the database', async () => {
    const beforeOrderCount = manager.getRawDb().prepare('SELECT COUNT(*) AS count FROM orders').get().count;
    const invalid = JSON.parse(oldBackupJson);
    invalid.invoices[0].paidAmount = 999;
    invalid.invoices[0].remainingAmount = 0;
    const result = await call('system:restore', JSON.stringify(invalid));
    assert.equal(result.success, false);
    assert.match(result.error, /INVOICE_PAYMENT_MISMATCH/);
    assert.equal(manager.getRawDb().prepare('SELECT COUNT(*) AS count FROM orders').get().count, beforeOrderCount);
  });

  await record('WhatsApp failure records failed state without success audit', async () => {
    process.env.SAHWA_FORCE_WHATSAPP_FAILURE = '1';
    try {
      assert.equal(await call('whatsapp:send', '0500000001', 'عميل تكامل', orderNumber, 'قيد التنفيذ'), false);
    } finally {
      delete process.env.SAHWA_FORCE_WHATSAPP_FAILURE;
    }
    const snapshot = await call('data:get');
    assert.equal(snapshot.notifications.some((item) => item.orderId === orderId && item.title.includes('فشل فتح')), true);
    assert.equal(snapshot.notifications.some((item) => item.orderId === orderId && item.title.includes('تم فتح')), false);
    const events = await call('orders:events:list', orderId);
    assert.equal(events.some((item) => item.type === 'whatsapp' && item.title.includes('فشل')), true);
  });

  await record('order numbers use a persistent sequence instead of row count', async () => {
    const first = await call('orders:create', { ...orderPayload, id: 'ORD-SEQ-001', orderNumber: undefined, totalAmount: 50, paidAmount: 0, materialUsages: [] });
    const second = await call('orders:create', { ...orderPayload, id: 'ORD-SEQ-002', orderNumber: undefined, totalAmount: 50, paidAmount: 0, materialUsages: [] });
    assert.notEqual(first.orderNumber, second.orderNumber);
    assert.equal(Number(second.orderNumber), Number(first.orderNumber) + 1);
    await call('orders:delete', 'ORD-SEQ-001');
    const third = await call('orders:create', { ...orderPayload, id: 'ORD-SEQ-003', orderNumber: undefined, totalAmount: 50, paidAmount: 0, materialUsages: [] });
    assert.equal(Number(third.orderNumber), Number(second.orderNumber) + 1);
  });

  await record('cancel edit reactivate consumes the new material snapshot only', async () => {
    await call('fabrics:create', { id: 'FAB-INT-002', name: 'قماش بديل تكامل', color: 'كحلي', colorHex: '#111827', purchasePrice: 55, sellingPrice: 120, quantityMeters: 30, minStockMeters: 2 });
    const activeOrder = (await call('orders:list')).find((item) => item.id === orderId);
    assert.ok(activeOrder);
    const beforeCancelFabric = manager.getRawDb().prepare('SELECT quantity_meters FROM fabrics WHERE id = ?').get(fabricId).quantity_meters;
    const beforeCancelAccessory = manager.getRawDb().prepare('SELECT quantity FROM accessories WHERE id = ?').get(accessoryId).quantity;
    await call('orders:updateStatus', orderId, 'cancelled');
    const afterCancel = manager.getRawDb();
    assert.equal(afterCancel.prepare('SELECT quantity_meters FROM fabrics WHERE id = ?').get(fabricId).quantity_meters, beforeCancelFabric + 3.5);
    assert.equal(afterCancel.prepare('SELECT quantity FROM accessories WHERE id = ?').get(accessoryId).quantity, beforeCancelAccessory + 2);
    assert.equal(await call('orders:update', { ...activeOrder, status: 'cancelled', fabricId: 'FAB-INT-002', fabricName: 'قماش بديل تكامل', fabricColor: 'كحلي', garmentCount: 2 }), true);
    assert.equal(afterCancel.prepare('SELECT quantity_meters FROM fabrics WHERE id = ?').get('FAB-INT-002').quantity_meters, 30);
    const updatedMaterials = afterCancel.prepare('SELECT item_type, item_id, quantity, source_movement_id FROM order_material_usages WHERE order_id = ? ORDER BY item_type, item_id').all(orderId);
    assert.equal(updatedMaterials.some((row) => row.item_type === 'fabric' && row.item_id === 'FAB-INT-002' && row.quantity === 7 && row.source_movement_id === null), true);
    assert.equal(updatedMaterials.some((row) => row.item_type === 'fabric' && row.item_id === fabricId), false);
    await call('orders:updateStatus', orderId, 'new');
    assert.equal(afterCancel.prepare('SELECT quantity_meters FROM fabrics WHERE id = ?').get(fabricId).quantity_meters, beforeCancelFabric + 3.5);
    assert.equal(afterCancel.prepare('SELECT quantity_meters FROM fabrics WHERE id = ?').get('FAB-INT-002').quantity_meters, 23);
    assert.equal(afterCancel.prepare('SELECT quantity FROM accessories WHERE id = ?').get(accessoryId).quantity, 8);
    assert.equal(afterCancel.prepare('SELECT COUNT(*) AS count FROM order_material_usages WHERE order_id = ? AND source_movement_id IS NULL').get(orderId).count, 0);
  });

  await record('delete order reverses the actual payment ledger', async () => {
    const deleted = await call('orders:create', { ...orderPayload, id: 'ORD-DELETE-PAY', orderNumber: 'DELETE-PAY-1', totalAmount: 100, paidAmount: 20, materialUsages: [] });
    const beforeDelete = (await call('cash:list')).filter((item) => item.orderId === deleted.id && item.sourceType === 'customer_payment');
    assert.equal(beforeDelete.length, 1);
    await call('orders:delete', deleted.id);
    const afterDelete = (await call('cash:list')).filter((item) => item.orderId === deleted.id);
    assert.equal(afterDelete.some((item) => item.sourceType === 'adjustment' && item.direction === 'out' && item.amount === 20), true);
    assert.equal((await call('orders:list')).some((item) => item.id === deleted.id), false);
  });

  await record('manual stock adjustment rolls back when movement insert fails', async () => {
    const db = manager.getRawDb();
    const before = db.prepare('SELECT quantity_meters FROM fabrics WHERE id = ?').get(fabricId).quantity_meters;
    db.exec("CREATE TRIGGER integration_fail_inventory_insert BEFORE INSERT ON inventory_movements BEGIN SELECT RAISE(ABORT, 'forced movement failure'); END");
    await assert.rejects(call('stock:adjust', 'fabric', fabricId, 2, 'اختبار rollback', 'adjustment'), /حدث خطأ غير متوقع/);
    db.exec('DROP TRIGGER integration_fail_inventory_insert');
    assert.equal(db.prepare('SELECT quantity_meters FROM fabrics WHERE id = ?').get(fabricId).quantity_meters, before);
  });

  await record('invalid and insufficient operations rollback atomically', async () => {
    await assert.rejects(call('orders:create', { id: 'ORD-INCOMPLETE', customerId, fabricId, totalAmount: 100 }), /مفقودة|NOT NULL|إلزامية/);
    await assert.rejects(call('orders:create', { id: 'ORD-LOW-STOCK', orderNumber: 'INT-LOW', customerId, customerName: 'عميل تكامل', customerPhone: '0500000001', fabricId, fabricName: 'قماش تكامل', garmentCount: 100, totalAmount: 1000 }), /غير كافية/);
    const db = manager.getRawDb();
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders WHERE id IN (?, ?)').get('ORD-INCOMPLETE', 'ORD-LOW-STOCK').count, 0);
  });

  await record('abrupt close during an uncommitted SQLite write rolls back safely', async () => {
    const db = manager.getRawDb();
    db.exec('CREATE TABLE IF NOT EXISTS integration_crash_probe (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT NOT NULL)');
    db.prepare('DELETE FROM integration_crash_probe').run();
    db.prepare('INSERT INTO integration_crash_probe (value) VALUES (?)').run('committed-write');
    const child = childProcess.spawnSync(process.execPath, [path.join(__dirname, 'abrupt-write.cjs'), path.join(databaseDir, 'sahwa_tailoring.db')], {
      encoding: 'utf8', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    });
    assert.notEqual(child.status, 0);
    const values = db.prepare('SELECT value FROM integration_crash_probe ORDER BY id').all().map((row) => row.value);
    assert.deepEqual(values, ['committed-write']);
  });

  await record('offline local workflow and graceful close/reopen', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => { throw new Error('network disabled for offline test'); };
    try {
      const settings = await call('settings:get');
      assert.equal(settings.fabricConsumptionRatePerGarment, 3.5);
      const orders = await call('orders:list');
      assert.equal(orders.some((item) => item.id === orderId), true);
    } finally {
      global.fetch = originalFetch;
    }
    await manager.close();
    const reopened = new SahwaDatabaseManager(databaseDir, undefined, backupDir);
    const reopenedInit = reopened.initDatabase();
    assert.equal(reopenedInit.success, true);
    assert.equal(reopened.getRawDb().prepare('SELECT COUNT(*) AS count FROM orders WHERE id = ?').get(orderId).count, 1);
    await reopened.close();
  });

  console.log(JSON.stringify({ ok: true, root, results }, null, 2));
  await app.quit();
}

main().catch(async (error) => {
  console.error(JSON.stringify({ ok: false, error: error?.stack || error?.message || String(error), results }, null, 2));
  try { await app.quit(); } catch {}
  process.exitCode = 1;
});
