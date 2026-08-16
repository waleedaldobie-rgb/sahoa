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
import { normalizeMeasurements, normalizeStyleDetails } from '../services/shared/measurementDefaults';
import { CustomerRepository } from './repositories/customerRepository';
import { CashRepository } from './repositories/cashRepository';
import { CustomerService } from './services/customerService';
import { InventoryRepository } from './repositories/inventoryRepository';
import { InventoryService } from './services/inventoryService';
import { OrderEventRepository } from './repositories/orderEventRepository';
import { AccountingRepository } from './repositories/accountingRepository';
import { AccountingService } from './services/accountingService';
import { OrderRepository } from './repositories/orderRepository';
import { InvoiceRepository } from './repositories/invoiceRepository';
import { PaymentService } from './services/paymentService';
import { OrderStatusService } from './services/orderStatusService';
import { NotificationRepository } from './repositories/notificationRepository';
import { WhatsAppService } from './services/whatsappService';
import { OrderService } from './services/orderService';
import { FabricRepository } from './repositories/fabricRepository';
import { AccessoryRepository } from './repositories/accessoryRepository';

const parseMeasurementsJson = (value?: string) => {
  try { return normalizeMeasurements(JSON.parse(value || '{}')); }
  catch { return normalizeMeasurements(); }
};

const parseStyleDetailsJson = (value?: string) => {
  try { return normalizeStyleDetails(JSON.parse(value || '{}')); }
  catch { return normalizeStyleDetails(); }
};

const round2 = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

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
  const customerRepository = new CustomerRepository(db);
  const customerService = new CustomerService(customerRepository);
  const cashRepository = new CashRepository(db);
  const inventoryRepository = new InventoryRepository(db);
  const inventoryService = new InventoryService(inventoryRepository);
  const orderEventRepository = new OrderEventRepository(db);
  const accountingRepository = new AccountingRepository(db);
  const accountingService = new AccountingService(accountingRepository, inventoryService, cashRepository, db);
  const orderRepository = new OrderRepository(db);
  const invoiceRepository = new InvoiceRepository(db);
  const paymentService = new PaymentService(invoiceRepository, orderRepository, cashRepository, orderEventRepository, db);
  const orderStatusService = new OrderStatusService(orderRepository, inventoryService, orderEventRepository, db);
  const notificationRepository = new NotificationRepository(db);
  const whatsappService = new WhatsAppService(notificationRepository, orderRepository, orderEventRepository);
  const orderService = new OrderService(orderRepository, inventoryService, cashRepository, orderEventRepository, db);
  const fabricRepository = new FabricRepository(db);
  const accessoryRepository = new AccessoryRepository(db);

  // -------------------------------------------------------------
  // CUSTOMERS IPC HANDLERS
  // -------------------------------------------------------------
  safeIpcHandle(ipcMain, 'customers:list', async () => customerService.list());
  safeIpcHandle(ipcMain, 'customers:create', async (_, customer: Partial<Customer>) => customerService.create(customer));
  safeIpcHandle(ipcMain, 'customers:update', async (_, customer: Customer) => customerService.update(customer));
  safeIpcHandle(ipcMain, 'customers:delete', async (_, customerId: string) => customerService.delete(customerId));
  safeIpcHandle(ipcMain, 'customers:saveMeasurementHistory', async (_, customerId: string, note: string) => customerService.saveMeasurementHistory(customerId, note));

  // -------------------------------------------------------------
  // FABRICS & INVENTORY IPC HANDLERS
  // -------------------------------------------------------------
  safeIpcHandle(ipcMain, 'fabrics:list', async () => fabricRepository.list());
  safeIpcHandle(ipcMain, 'fabrics:create', async (_, fabric: Partial<FabricItem>) => fabricRepository.insert(fabric));
  safeIpcHandle(ipcMain, 'fabrics:update', async (_, fabric: FabricItem) => { fabricRepository.update(fabric); return true; });
  safeIpcHandle(ipcMain, 'fabrics:delete', async (_, fabricId: string) => { fabricRepository.delete(fabricId); return true; });

  safeIpcHandle(ipcMain, 'accessories:list', async () => accessoryRepository.list());
  safeIpcHandle(ipcMain, 'accessories:create', async (_, accessory: Partial<AccessoryItem>) => accessoryRepository.insert(accessory));
  safeIpcHandle(ipcMain, 'accessories:update', async (_, accessory: AccessoryItem) => { accessoryRepository.update(accessory); return true; });
  safeIpcHandle(ipcMain, 'accessories:delete', async (_, accessoryId: string) => { accessoryRepository.delete(accessoryId); return true; });

  // -------------------------------------------------------------
  // INVENTORY MOVEMENTS, PURCHASES, EXPENSES & CASH LEDGER
  // -------------------------------------------------------------
  safeIpcHandle(ipcMain, 'stockMovements:list', async (_, itemType?: InventoryItemType, itemId?: string) => {
    return inventoryService.listMovements(itemType, itemId);
  });

  safeIpcHandle(ipcMain, 'stock:adjust', async (_, itemType: InventoryItemType, itemId: string, quantity: number, reason: string, direction: 'adjustment' | 'return' = 'adjustment') => {
    if (!reason || !reason.trim()) throw new Error('سبب التسوية مطلوب');
    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericQuantity) || numericQuantity === 0) throw new Error('كمية التسوية يجب أن تكون رقماً غير صفري');
    const tx = db.transaction(() => {
      const delta = direction === 'return' ? Math.abs(numericQuantity) : numericQuantity;
      return inventoryService.recordMovement( itemType, itemId, delta, direction, reason.trim(), { type: 'stock_adjustment', id: itemId });
    });
    return tx();
  });

  safeIpcHandle(ipcMain, 'purchases:list', async () => {
    const { rows, lines } = accountingService.listPurchases();
    return rows.map((row) => mapPurchase(row, lines));
  });

  safeIpcHandle(ipcMain, 'purchases:create', async (_, payload: any) => {
    const result = accountingService.createPurchase(payload);
    const purchase = accountingService.findPurchase(result.id);
    if (!purchase) throw new Error('تعذر قراءة عملية الشراء بعد اعتمادها');
    return mapPurchase(purchase.row, purchase.lines);
  });

  safeIpcHandle(ipcMain, 'expenses:list', async () => accountingService.listExpenses().map(mapExpense));

  safeIpcHandle(ipcMain, 'expenses:create', async (_, payload: any) => {
    const expenseId = accountingService.createExpense(payload);
    const expense = accountingService.findExpense(expenseId);
    if (!expense) throw new Error('تعذر قراءة المصروف بعد حفظه');
    return mapExpense(expense);
  });

  safeIpcHandle(ipcMain, 'cash:list', async () => {
    return (cashRepository.list() as any[]).map(mapCashTransaction);
  });

  safeIpcHandle(ipcMain, 'cash:createAdjustment', async (_, payload: any) => {
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('مبلغ الحركة يجب أن يكون أكبر من صفر');
    if (!payload.description?.trim()) throw new Error('وصف الحركة المالية مطلوب');
    const id = payload.id || `CASH-${Date.now()}`;
    const existing = cashRepository.findById(id) as any;
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
    cashRepository.insert(transaction);
    return transaction;
  });

  safeIpcHandle(ipcMain, 'orderMaterials:list', async (_, orderId?: string) => {
    const rows = orderRepository.listMaterialUsages(orderId);
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
    return (orderEventRepository.list(orderId) as any[]).map(mapOrderEvent);
  });

  safeIpcHandle(ipcMain, 'orders:list', async () => {
    const rows = orderRepository.list();
    const materialRows = orderRepository.listMaterialUsages();
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
    const settings = dbManager.getSettings();
    const result = orderService.createOrder(orderData, settings.fabricConsumptionRatePerGarment || 3.5);
    return {
      ...orderData,
      id: result.orderId,
      orderNumber: result.orderNumber,
      remainingAmount: result.remainingAmount,
      materialUsages: result.materialUsages,
      materialCost: result.materialCost,
      profit: result.profit,
      measurements: normalizeMeasurements(orderData.measurements),
      styleDetails: normalizeStyleDetails(orderData.styleDetails)
    };
  });
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
            inventoryService.recordMovement( oldMaterial.item_type, oldMaterial.item_id, oldMaterial.quantity, 'return', 'إرجاع استهلاك مادة بعد تعديل الطلب', {
              type: 'order_update', id: updatedOrder.id, number: existing.order_number
            });
          }
        }

        if (updatedOrder.fabricId) {
          const newFab = db.prepare('SELECT * FROM fabrics WHERE id = ?').get(updatedOrder.fabricId) as any;
          if (!newFab) throw new Error('القماش الجديد المختار غير موجود');
          if (fabricChanged) updatedOrder.fabricBuyPriceAtOrder = newFab.purchase_price || 0;
          else updatedOrder.fabricBuyPriceAtOrder = existing.fabric_buy_price_at_order || updatedOrder.fabricBuyPriceAtOrder || 0;
          const newFabricMovement = inventoryService.recordMovement( 'fabric', updatedOrder.fabricId, -newMeters, 'sale', 'استهلاك قماش بعد تعديل الطلب', {
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
            const meta = inventoryService.getMeta( material.itemType || material.item_type, itemId);
            const movement = inventoryService.recordMovement( material.itemType || material.item_type, itemId, -quantity, 'sale', 'استهلاك مادة بعد تعديل الطلب', {
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
            inventoryService.recordMovement( material.item_type, material.item_id, material.quantity, 'return', 'إرجاع مواد بسبب حذف الطلب', {
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
            cashRepository.insert({
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
    return orderStatusService.updateStatus(orderId, status);
  });

  // -------------------------------------------------------------
  // INVOICES & PAYMENTS IPC
  // -------------------------------------------------------------
  safeIpcHandle(ipcMain, 'invoices:list', async () => {
    const rows = invoiceRepository.list();
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
    return paymentService.addPayment(invoiceId, amount, method, note, paymentId);
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
    const whatsappUrl = whatsappService.logPreparedMessage(phone, customerName, orderNumber, statusText);
    try {
      const { shell } = require('electron');
      await shell.openExternal(whatsappUrl);
    } catch (e) {
      console.error('Failed to open external WhatsApp URL:', e);
    }
    return true;
  });
}

