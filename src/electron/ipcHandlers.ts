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
import { normalizePositiveAmount } from '../domain/amountRules';
import { round2 } from '../domain/inventoryRules';
import { assertValidManualCashSourceType } from '../domain/cashRules';
import { CustomerRepository } from './repositories/customerRepository';
import { CashRepository } from './repositories/cashRepository';
import { CustomerService } from './services/customerService';
import { InventoryRepository } from './repositories/inventoryRepository';
import { InventoryService } from './services/inventoryService';
import { OrderEventRepository } from './repositories/orderEventRepository';
import { AccountingRepository } from './repositories/accountingRepository';
import { AccountingService } from './services/accountingService';
import { OrderRepository } from './repositories/orderRepository';
import { OrderWriteRepository } from './repositories/orderWriteRepository';
import { InvoiceRepository } from './repositories/invoiceRepository';
import { PaymentService } from './services/paymentService';
import { OrderStatusService } from './services/orderStatusService';
import { NotificationRepository } from './repositories/notificationRepository';
import { WhatsAppService } from './services/whatsappService';
import { OrderService } from './services/orderService';
import { FabricRepository } from './repositories/fabricRepository';
import { AccessoryRepository } from './repositories/accessoryRepository';
import { ThobeTypeRepository } from './repositories/thobeTypeRepository';
import { ColorRepository } from './repositories/colorRepository';
import { DatabaseIntegrityService } from './services/databaseIntegrityService';
import { createSafeId } from '../domain/idGenerator';
import { assertValidPaymentMethod } from '../domain/paymentRules';

const parseMeasurementsJson = (value?: string) => {
  try { return normalizeMeasurements(JSON.parse(value || '{}')); }
  catch { return normalizeMeasurements(); }
};

const parseStyleDetailsJson = (value?: string) => {
  try { return normalizeStyleDetails(JSON.parse(value || '{}')); }
  catch { return normalizeStyleDetails(); }
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
  const customerService = new CustomerService(customerRepository, db);
  const cashRepository = new CashRepository(db);
  const inventoryRepository = new InventoryRepository(db);
  const inventoryService = new InventoryService(inventoryRepository, db);
  const orderEventRepository = new OrderEventRepository(db);
  const accountingRepository = new AccountingRepository(db);
  const accountingService = new AccountingService(accountingRepository, inventoryService, cashRepository, db);
  const orderRepository = new OrderRepository(db);
  const orderWriteRepository = new OrderWriteRepository(db);
  const invoiceRepository = new InvoiceRepository(db);
  const paymentService = new PaymentService(invoiceRepository, orderWriteRepository, cashRepository, orderEventRepository, db);
  const orderStatusService = new OrderStatusService(orderRepository, orderWriteRepository, inventoryService, orderEventRepository, db);
  const notificationRepository = new NotificationRepository(db);
  const whatsappService = new WhatsAppService(notificationRepository, orderRepository, orderEventRepository);
  const orderService = new OrderService(orderRepository, orderWriteRepository, inventoryService, cashRepository, orderEventRepository, invoiceRepository, db);
  const fabricRepository = new FabricRepository(db);
  const accessoryRepository = new AccessoryRepository(db);
  const thobeTypeRepository = new ThobeTypeRepository(db);
  const colorRepository = new ColorRepository(db);

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
    return inventoryService.adjustStock(itemType, itemId, quantity, reason, direction);
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
    const amount = normalizePositiveAmount(payload.amount, 'مبلغ الحركة');
    const paymentMethod = assertValidPaymentMethod(payload.paymentMethod ?? 'cash');
    if (!payload.description?.trim()) throw new Error('وصف الحركة المالية مطلوب');
    const id = payload.id || createSafeId('CASH');
    const existing = cashRepository.findById(id) as any;
    if (existing) return mapCashTransaction(existing);
    const transaction: CashTransaction = {
      id,
      direction: payload.direction === 'out' ? 'out' : 'in',
      sourceType: assertValidManualCashSourceType(payload.sourceType || 'adjustment'),
      sourceId: payload.sourceId,
      referenceNumber: payload.referenceNumber,
      amount: round2(amount),
      paymentMethod,
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
  safeIpcHandle(ipcMain, 'thobeTypes:list', async () => thobeTypeRepository.list());
  safeIpcHandle(ipcMain, 'thobeTypes:create', async (_, item: Partial<ThobeType>) => thobeTypeRepository.insert(item));
  safeIpcHandle(ipcMain, 'thobeTypes:update', async (_, item: ThobeType) => { thobeTypeRepository.update(item); return true; });
  safeIpcHandle(ipcMain, 'thobeTypes:delete', async (_, id: string) => { thobeTypeRepository.delete(id); return true; });

  safeIpcHandle(ipcMain, 'colors:list', async () => colorRepository.list());
  safeIpcHandle(ipcMain, 'colors:create', async (_, item: Partial<ColorItem>) => colorRepository.insert(item));
  safeIpcHandle(ipcMain, 'colors:update', async (_, item: ColorItem) => { colorRepository.update(item); return true; });
  safeIpcHandle(ipcMain, 'colors:delete', async (_, id: string) => { colorRepository.delete(id); return true; });

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
    const settings = dbManager.getSettings();
    return orderService.updateOrder(updatedOrder, settings.fabricConsumptionRatePerGarment || 3.5);
  });

  safeIpcHandle(ipcMain, 'orders:delete', async (_, orderId: string) => {
    return orderService.deleteOrder(orderId);
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
    safeIpcHandle(ipcMain, 'data:get', async () => {
      return dbManager.exportFullDataAsJson();
    });

    safeIpcHandle(ipcMain, 'data:save', async (_, data: { notifications?: any[] }) => {
      if (!data || !Array.isArray(data.notifications)) return false;
      return dbManager.replaceNotifications(data.notifications);
    });

    safeIpcHandle(ipcMain, 'preferences:get', async () => {
      return dbManager.getUserPreferences();
    });

    safeIpcHandle(ipcMain, 'preferences:save', async (_, preferences: Record<string, unknown>) => {
      return dbManager.updateUserPreferences(preferences);
    });

    safeIpcHandle(ipcMain, 'system:backup', async () => {
      const result = await dbManager.backupDatabase('manual_user');
      if (!result.success) throw new Error(result.error || 'فشل إنشاء النسخة الاحتياطية');
      return JSON.stringify(dbManager.exportFullDataAsJson(), null, 2);
    });

  safeIpcHandle(ipcMain, 'system:restore', async (_, jsonContent: string) => {
    return dbManager.restoreFromJson(jsonContent);
  });

  safeIpcHandle(ipcMain, 'system:clearAllData', async () => {
    return dbManager.clearAllData();
  });

  safeIpcHandle(ipcMain, 'system:integrityCheck', async () => {
    return new DatabaseIntegrityService(db).check();
  });

  safeIpcHandle(ipcMain, 'reports:exportExcel', async (_, startDate?: string, endDate?: string) => {
    const buffer = await dbManager.generateExcelReport(startDate, endDate);
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
    const prepared = whatsappService.prepareMessage(phone, customerName, orderNumber, statusText);
    if (process.env.SAHWA_FORCE_WHATSAPP_FAILURE === '1') {
      whatsappService.recordDeliveryResult(phone, customerName, orderNumber, statusText, prepared, 'failed');
      return false;
    }
    try {
      const { shell } = require('electron');
      await shell.openExternal(prepared.url);
      whatsappService.recordDeliveryResult(phone, customerName, orderNumber, statusText, prepared, 'opened');
      return true;
    } catch (e) {
      console.error('Failed to open external WhatsApp URL:', e);
      whatsappService.recordDeliveryResult(phone, customerName, orderNumber, statusText, prepared, 'failed');
      return false;
    }
  });
}

