import { AppData, UserPreferences, Customer, CustomerMeasurements, CustomerStyleDetails, Order, Invoice, FabricItem, AccessoryItem, ThobeType, ColorItem, NotificationItem,   PaymentRecord, StockMovement, PurchaseRecord, PurchaseLine, ExpenseRecord, CashTransaction, OrderMaterialUsage, OrderEvent, MeasurementHistoryRecord, CustomerCreditRecord, CustomerCreditApplyRequest, CustomerCreditHistoryFilters, CustomerCreditOperationResult, CustomerCreditRefundRequest, CustomerCreditSummary, InventoryItemType } from '../types';
import { checkAndSyncStockAlerts } from '../utils/stockAlerts';
import { calculateStockBalance, round2 } from './shared/inventoryRules';
import { assertSafeInitialOrderStatus } from '../domain/orderRules';
import { assertCashTransactionContract } from '../domain/cashRules';
import { calculateMaterialCost, calculateOrderAmounts } from './shared/orderRules';
import { assertStoredPaymentAggregates, assertValidPaymentMethod, calculatePaymentUpdate } from '../domain/paymentRules';
import { createSafeId } from '../domain/idGenerator';
import { normalizePositiveAmount } from '../domain/amountRules';
import { applyPaymentToDraft } from './adapters/paymentDraftAdapter';
import { applyCustomerCreditInDraft, createCustomerCreditFromOverpaymentInDraft, getCustomerCreditHistoryInDraft, getCustomerCreditOperationInDraft, getCustomerCreditSummaryInDraft, refundCustomerCreditInDraft } from './adapters/customerCreditDraftAdapter';
import { assertMockBusinessIntegrity } from './adapters/mockIntegrityAdapter';
import { settleCancelledOrderInDraft } from './adapters/orderSettlementAdapter';
import { applyExpenseToDraft, applyCashAdjustmentToDraft } from './adapters/accountingDraftAdapter';
import { createCustomerInDraft, updateCustomerInDraft, saveCustomerMeasurementHistoryInDraft } from './adapters/customerDraftAdapter';
import { createFabricInDraft, updateFabricInDraft, createAccessoryInDraft, updateAccessoryInDraft } from './adapters/inventoryCatalogDraftAdapter';
import { createPurchaseInDraft, getInventoryMeta, insertStockMovementInDraft, returnPurchaseInDraft } from './adapters/inventoryMovementDraftAdapter';
import { appendMaterialUsage, buildFabricMaterialUsage, buildInitialInvoiceDraft, buildMaterialUsage, buildOrderDraft, calculateOrderMaterialCost } from './adapters/orderDraftAdapter';
import { updateOrderMaterialsInDraft, updateOrderInvoiceInDraft } from './adapters/orderUpdateAdapter';
import { findById, hasIdOrSourceId } from './shared/idempotencyRules';

const STORAGE_KEY = 'sahwa_tailoring_app_data_v1';
const PREFS_KEY = 'sahwa_tailoring_prefs_v1';
const ORDER_SEQUENCE_KEY = 'sahwa_tailoring_order_sequence_v1';

function nextMockOrderNumber(orders: Order[]): string {
  const maxExisting = orders.reduce((max, order) => Math.max(max, Number(order.orderNumber) || 1000), 1000);
  const stored = Number(window.localStorage.getItem(ORDER_SEQUENCE_KEY) || 1000);
  const next = Math.max(maxExisting, stored) + 1;
  window.localStorage.setItem(ORDER_SEQUENCE_KEY, String(next));
  return String(next);
}

import { DEFAULT_MEASUREMENTS, DEFAULT_STYLE_DETAILS, EMPTY_MEASUREMENTS, EMPTY_STYLE_DETAILS, normalizeMeasurements, normalizeStyleDetails } from './shared/measurementDefaults';
export { DEFAULT_MEASUREMENTS, DEFAULT_STYLE_DETAILS, EMPTY_MEASUREMENTS, EMPTY_STYLE_DETAILS, normalizeMeasurements, normalizeStyleDetails } from './shared/measurementDefaults';

// Initial Seed Data (Empty by default per user request - no demo/sample data)
const INITIAL_CUSTOMERS: Customer[] = [];

const INITIAL_FABRICS: FabricItem[] = [];

const INITIAL_ACCESSORIES: AccessoryItem[] = [];

const INITIAL_THOBE_TYPES: ThobeType[] = [
  { id: 'THB-01', name: 'ثوب سعودي كلاسيك', defaultPrice: 220, description: 'الرقبة القلاب القياسية والكبك التقليدي' },
  { id: 'THB-02', name: 'ثوب كويتي فتحة صليب', defaultPrice: 240, description: 'بدون قلاب مع قَصّة كويتية ممتازة' },
  { id: 'THB-03', name: 'ثوب قطري جيب بارز', defaultPrice: 250, description: 'ياقة مرتفعة وجيب صدر مطرز' },
  { id: 'THB-04', name: 'ثوب سحاب مخفي رسمي', defaultPrice: 230, description: 'سحاب مخفي وعملي للدوامات' }
];

const INITIAL_COLORS: ColorItem[] = [
  { id: 'COL-01', name: 'أبيض ناصع', hex: '#ffffff' },
  { id: 'COL-02', name: 'أبيض نص لمعة', hex: '#f8fafc' },
  { id: 'COL-03', name: 'كريمي فاتح', hex: '#fef3c7' },
  { id: 'COL-04', name: 'أوف وايت', hex: '#f5f5f4' },
  { id: 'COL-05', name: 'كحلي داكن', hex: '#1e293b' },
  { id: 'COL-06', name: 'رمادي رصاصي', hex: '#475569' }
];

const INITIAL_ORDERS: Order[] = [];

const INITIAL_INVOICES: Invoice[] = [];

const INITIAL_NOTIFICATIONS: NotificationItem[] = [];

const INITIAL_APP_DATA: AppData = {
  customers: INITIAL_CUSTOMERS,
  orders: INITIAL_ORDERS,
  invoices: INITIAL_INVOICES,
  fabrics: INITIAL_FABRICS,
  accessories: INITIAL_ACCESSORIES,
  thobeTypes: INITIAL_THOBE_TYPES,
  colors: INITIAL_COLORS,
  notifications: INITIAL_NOTIFICATIONS,
  stockMovements: [],
  purchases: [],
  expenses: [],
  cashTransactions: [],
  orderMaterialUsages: [],
  orderEvents: [],
  customerCredits: []
};

const INITIAL_PREFS: UserPreferences = {
  activeTab: 'dashboard',
  invoicePrintMode: 'detailed',
  managerName: 'حاتم محمد الدبعي'
};

function deduplicateById<T extends { id: string }>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (item && item.id && !seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}

const normalizeCustomer = (customer: Customer): Customer => ({
  ...customer,
  measurements: normalizeMeasurements(customer.measurements),
  styleDetails: normalizeStyleDetails(customer.styleDetails),
  measurementHistory: Array.isArray(customer.measurementHistory)
    ? customer.measurementHistory.map((history) => ({
        ...history,
        measurements: normalizeMeasurements(history.measurements),
        styleDetails: normalizeStyleDetails(history.styleDetails),
      }))
    : [],
});

const normalizeOrder = (order: Order): Order => ({
  ...order,
  measurements: normalizeMeasurements(order.measurements),
  styleDetails: normalizeStyleDetails(order.styleDetails),
});

function sanitizeAppData(raw: Partial<AppData>): AppData {
  return {
    customers: deduplicateById(raw.customers || INITIAL_CUSTOMERS).map(normalizeCustomer),
    orders: deduplicateById(raw.orders || INITIAL_ORDERS).map(normalizeOrder),
    invoices: deduplicateById(raw.invoices || INITIAL_INVOICES),
    fabrics: deduplicateById(raw.fabrics || INITIAL_FABRICS),
    accessories: deduplicateById(raw.accessories || INITIAL_ACCESSORIES),
    thobeTypes: deduplicateById(raw.thobeTypes || INITIAL_THOBE_TYPES),
    colors: deduplicateById(raw.colors || INITIAL_COLORS),
    notifications: deduplicateById(raw.notifications || INITIAL_NOTIFICATIONS),
    stockMovements: deduplicateById(raw.stockMovements || []),
    purchases: deduplicateById(raw.purchases || []),
    expenses: deduplicateById(raw.expenses || []),
    cashTransactions: deduplicateById(raw.cashTransactions || []),
    orderMaterialUsages: deduplicateById(raw.orderMaterialUsages || []),
    orderEvents: deduplicateById(raw.orderEvents || []),
    customerCredits: deduplicateById(raw.customerCredits || []) as CustomerCreditRecord[]
  };
}

// Atomic Database Transaction Manager
export const db = {
  /**
   * Executes a callback atomically inside a database transaction on AppData.
   * Clones current AppData into an isolated draft.
   * If action fails/throws, transaction rolls back cleanly without persisting changes.
   * If action succeeds, draft is sanitized, stock alerts synced, and committed atomically to storage.
   */
  async transaction<T>(
    action: (draft: AppData) => Promise<T> | T
  ): Promise<{ result: T; updatedData: AppData; alertMessages: string[] }> {
    const currentData = await window.electronAPI.getData();
    // Deep clone for isolated atomic mutation
    const draft: AppData = JSON.parse(JSON.stringify(currentData));

    try {
      const result = await action(draft);

      const { updatedData, alertMessages } = checkAndSyncStockAlerts(draft);
      assertMockBusinessIntegrity(updatedData);
      const saved = await window.electronAPI.saveData(updatedData);
      if (!saved) {
        throw new Error('فشل الترانزاكشن: تعذر حفظ البيانات في وحدة التخزين');
      }

      return { result, updatedData, alertMessages };
    } catch (err) {
      console.error('[db.transaction] Transaction rolled back due to error:', err);
      throw err;
    }
  }
};

const mockInsertCash = (draft: AppData, transaction: CashTransaction) => {
  assertCashTransactionContract(transaction);
  const cashTransactions = draft.cashTransactions || [];
  if (hasIdOrSourceId(cashTransactions, transaction.id, transaction.sourceId)) return;
  draft.cashTransactions = [transaction, ...cashTransactions];
};

const mockInsertEvent = (draft: AppData, event: OrderEvent) => {
  const orderEvents = draft.orderEvents || [];
  if (findById(orderEvents, event.id)) return;
  draft.orderEvents = [event, ...orderEvents];
};

// Setup window.electronAPI mock
export function initElectronMock() {
  if (typeof window === 'undefined') return;

  const existing = window.electronAPI;
  const isRealElectron = existing && !(existing as any).__isMock;

  // Electron preload exposes a read-only contextBridge API. Never replace it
  // with the browser mock; use the mock only when running outside Electron.
  if (isRealElectron) return;

  window.electronAPI = {
    __isMock: true,
    ...existing,
    db,

    async getData(): Promise<AppData> {
      if (isRealElectron && existing?.getCustomers && existing?.getOrders && existing?.getInvoices && existing?.getFabrics && existing?.getAccessories) {
        try {
          const [customers, orders, invoices, fabrics, accessories, thobeTypes, colors, stockMovements, purchases, expenses, cashTransactions, orderMaterialUsages, orderEvents, customerCredits] = await Promise.all([
            existing.getCustomers(),
            existing.getOrders(),
            existing.getInvoices(),
            existing.getFabrics(),
            existing.getAccessories(),
            existing.getThobeTypes?.() || Promise.resolve(INITIAL_THOBE_TYPES),
            existing.getColors?.() || Promise.resolve(INITIAL_COLORS),
            existing.getStockMovements?.() || Promise.resolve([]),
            existing.getPurchases?.() || Promise.resolve([]),
            existing.getExpenses?.() || Promise.resolve([]),
            existing.getCashTransactions?.() || Promise.resolve([]),
            existing.getOrderMaterialUsages?.() || Promise.resolve([]),
            existing.getOrderEvents?.() || Promise.resolve([]),
            (existing as any).getCustomerCredits?.() || Promise.resolve([])
          ]);
          return sanitizeAppData({
            customers: customers || [],
            orders: orders || [],
            invoices: invoices || [],
            fabrics: fabrics || [],
            accessories: accessories || [],
            thobeTypes: thobeTypes || INITIAL_THOBE_TYPES,
            colors: colors || INITIAL_COLORS,
            notifications: [],
            stockMovements: stockMovements || [],
            purchases: purchases || [],
            expenses: expenses || [],
            cashTransactions: cashTransactions || [],
            orderMaterialUsages: orderMaterialUsages || [],
            orderEvents: orderEvents || [],
            customerCredits: customerCredits || []
          });
        } catch (err) {
          console.error('Error loading real Electron SQLite data, falling back to localStorage:', err);
        }
      }

      try {
        const noDemoFlag = localStorage.getItem('sahwa_no_demo_v2');
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // If stored has old demo customers like CUST-101 and noDemoFlag is not set, purge them
          const hasDemoData = parsed.customers?.some((c: any) => c.id === 'CUST-101');
          if (hasDemoData && !noDemoFlag) {
            localStorage.setItem('sahwa_no_demo_v2', 'true');
            const cleanData: AppData = {
              customers: [],
              orders: [],
              invoices: [],
              fabrics: [],
              accessories: [],
              thobeTypes: INITIAL_THOBE_TYPES,
              colors: INITIAL_COLORS,
              notifications: [],
              stockMovements: [],
              purchases: [],
              expenses: [],
              cashTransactions: [],
              orderMaterialUsages: [],
              orderEvents: [],
              customerCredits: []
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanData));
            return cleanData;
          }

          const sanitized = sanitizeAppData(parsed);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
          return sanitized;
        }
      } catch (e) {
        console.error('Failed to load data from localStorage', e);
      }
      
      const isCleared = localStorage.getItem('sahwa_tailoring_is_cleared') === 'true';
      if (isCleared) {
        const emptyData: AppData = {
          customers: [],
          orders: [],
          invoices: [],
          fabrics: [],
          accessories: [],
          thobeTypes: INITIAL_THOBE_TYPES,
          colors: INITIAL_COLORS,
          notifications: [],
          stockMovements: [],
          purchases: [],
          expenses: [],
          cashTransactions: [],
          orderMaterialUsages: [],
          orderEvents: [],
          customerCredits: []
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyData));
        return emptyData;
      }

      const initial = sanitizeAppData(INITIAL_APP_DATA);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    },

    async saveData(data: AppData): Promise<boolean> {
      try {
        const { updatedData } = checkAndSyncStockAlerts(data);
        const sanitized = sanitizeAppData(updatedData);
        assertMockBusinessIntegrity(sanitized);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
        return true;
      } catch (e) {
        console.error('Failed to save data', e);
        return false;
      }
    },

    async exportBackup(): Promise<string> {
      if (isRealElectron && existing?.exportBackup) return existing.exportBackup();
      const data = await window.electronAPI.getData();
      return JSON.stringify(data, null, 2);
    },

    async importBackup(jsonContent: string): Promise<{ success: boolean; error?: string }> {
      if (isRealElectron && existing?.importBackup) return existing.importBackup(jsonContent);
      try {
        const parsed = JSON.parse(jsonContent);
        if (!parsed.customers || !parsed.orders || !parsed.fabrics) {
          return { success: false, error: 'تنسيق الملف غير صحيح! يجب أن يحتوي على بيانات العملاء والطلبات والمخزون.' };
        }
        const sanitized = sanitizeAppData(parsed);
        assertMockBusinessIntegrity(sanitized);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
        return { success: true };
      } catch (e) {
        return { success: false, error: 'عذراً، تعذر قراءة ملف JSON. يرجى التاكد من سلامة الملف.' };
      }
    },

    async getPreferences(): Promise<UserPreferences> {
      try {
        const stored = localStorage.getItem(PREFS_KEY);
        if (stored) {
          return { ...INITIAL_PREFS, ...JSON.parse(stored) };
        }
      } catch (e) {
        console.error('Failed to load preferences', e);
      }
      return INITIAL_PREFS;
    },

    async savePreferences(prefs: Partial<UserPreferences>): Promise<boolean> {
      try {
        const current = await window.electronAPI.getPreferences();
        const updated = { ...current, ...prefs };
        localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
        return true;
      } catch (e) {
        return false;
      }
    },

    async clearAllData(): Promise<boolean> {
      try {
        const clearedData: AppData = {
          customers: [],
          orders: [],
          invoices: [],
          fabrics: [],
          accessories: [],
          thobeTypes: INITIAL_THOBE_TYPES,
          colors: INITIAL_COLORS,
          notifications: [],
          customerCredits: []
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clearedData));
        // Save a flag to indicate the mock data was explicitly cleared and shouldn't be reseeded
        localStorage.setItem('sahwa_tailoring_is_cleared', 'true');
        return true;
      } catch (e) {
        console.error('Failed to clear data', e);
        return false;
      }
    },

    async deleteFabric(id: string): Promise<boolean> {
      if (isRealElectron && existing?.deleteFabric) return existing.deleteFabric(id);
      await db.transaction((draft) => {
        const isUsed = draft.orders.some((o) => o.fabricId === id && (o.status as string) !== 'cancelled');
        if (isUsed) {
          throw new Error('لا يمكن حذف هذا الصنف لارتباطه بطلبات موجودة');
        }
        draft.fabrics = draft.fabrics.filter((f) => f.id !== id);
      });
      return true;
    },

    async deleteCustomer(id: string): Promise<boolean> {
      if (isRealElectron && existing?.deleteCustomer) return existing.deleteCustomer(id);
      await db.transaction((draft) => {
        const hasOrders = draft.orders.some((o) => o.customerId === id);
        if (hasOrders) {
          throw new Error('لا يمكن حذف هذا الصنف لارتباطه بطلبات موجودة');
        }
        draft.customers = draft.customers.filter((c) => c.id !== id);
      });
      return true;
    },

    async deleteAccessory(id: string): Promise<boolean> {
      if (isRealElectron && existing?.deleteAccessory) return existing.deleteAccessory(id);
      await db.transaction((draft) => {
        draft.accessories = draft.accessories.filter((a) => a.id !== id);
      });
      return true;
    },

    async deleteOrder(id: string): Promise<boolean> {
      if (isRealElectron && existing?.deleteOrder) return existing.deleteOrder(id);
      await db.transaction((draft) => {
        const order = draft.orders.find((item) => item.id === id);
        if (!order) return;
        const invoice = draft.invoices.find((item) => item.orderId === id);
        const credits = (draft.customerCredits || []).filter((credit) => credit.orderId === id || credit.invoiceId === invoice?.id);
        if (invoice || credits.length > 0) {
          throw new Error('لا يمكن حذف طلب له فاتورة أو سجل مالي؛ استخدم مسار الأرشفة');
        }
        const usages = (draft.orderMaterialUsages || []).filter((usage) => usage.orderId === id);
        if ((order.status as string) !== 'cancelled') {
          for (const usage of usages) {
            if (usage.itemId) insertStockMovementInDraft(draft, usage.itemType, usage.itemId, usage.quantity, 'return', 'إرجاع مواد بسبب حذف الطلب', { type: 'order_delete', id });
          }
        }
        draft.orderMaterialUsages = (draft.orderMaterialUsages || []).filter((usage) => usage.orderId !== id);
        draft.orderEvents = (draft.orderEvents || []).filter((event) => event.orderId !== id);
        draft.orders = draft.orders.filter((item) => item.id !== id);
      });
      return true;
    },

    async getCustomers(): Promise<Customer[]> {
      if (isRealElectron && existing?.getCustomers) return existing.getCustomers();
      const data = await window.electronAPI.getData();
      return data.customers;
    },

    async createCustomer(customer: Partial<Customer>): Promise<Customer> {
      if (isRealElectron && existing?.createCustomer) return existing.createCustomer(customer);
      let newCustomer!: Customer;
      await db.transaction((draft) => {
        newCustomer = createCustomerInDraft(draft, customer);
      });
      return newCustomer;
    },

    async updateCustomer(customer: Customer): Promise<boolean> {
      if (isRealElectron && existing?.updateCustomer) return existing.updateCustomer(customer);
      await db.transaction((draft) => {
        updateCustomerInDraft(draft, customer);
      });
      return true;
    },

    async saveCustomerMeasurementHistory(id: string, note: string): Promise<MeasurementHistoryRecord> {
      if (isRealElectron && existing?.saveCustomerMeasurementHistory) return existing.saveCustomerMeasurementHistory(id, note);
      let newHistory!: MeasurementHistoryRecord;
      await db.transaction((draft) => {
        newHistory = saveCustomerMeasurementHistoryInDraft(draft, id, note);
      });
      return newHistory;
    },

    async getFabrics(): Promise<FabricItem[]> {
      if (isRealElectron && existing?.getFabrics) return existing.getFabrics();
      const data = await window.electronAPI.getData();
      return data.fabrics;
    },

    async createFabric(fabric: Partial<FabricItem>): Promise<FabricItem> {
      if (isRealElectron && existing?.createFabric) return existing.createFabric(fabric);
      let newFabric!: FabricItem;
      await db.transaction((draft) => {
        newFabric = createFabricInDraft(draft, fabric);
      });
      return newFabric;
    },

    async updateFabric(fabric: FabricItem): Promise<boolean> {
      if (isRealElectron && existing?.updateFabric) return existing.updateFabric(fabric);
      await db.transaction((draft) => {
        updateFabricInDraft(draft, fabric);
      });
      return true;
    },

    async getAccessories(): Promise<AccessoryItem[]> {
      if (isRealElectron && existing?.getAccessories) return existing.getAccessories();
      const data = await window.electronAPI.getData();
      return data.accessories;
    },

    async createAccessory(acc: Partial<AccessoryItem>): Promise<AccessoryItem> {
      if (isRealElectron && existing?.createAccessory) return existing.createAccessory(acc);
      let newAccessory!: AccessoryItem;
      await db.transaction((draft) => {
        newAccessory = createAccessoryInDraft(draft, acc);
      });
      return newAccessory;
    },

    async updateAccessory(acc: AccessoryItem): Promise<boolean> {
      if (isRealElectron && existing?.updateAccessory) return existing.updateAccessory(acc);
      await db.transaction((draft) => {
        updateAccessoryInDraft(draft, acc);
      });
      return true;
    },

    async getStockMovements(itemType?: InventoryItemType, itemId?: string): Promise<StockMovement[]> {
      if (isRealElectron && existing?.getStockMovements) return existing.getStockMovements(itemType, itemId);
      const data = await window.electronAPI.getData();
      return (data.stockMovements || []).filter((movement) => (!itemType || movement.itemType === itemType) && (!itemId || movement.itemId === itemId));
    },

    async adjustStock(itemType: InventoryItemType, itemId: string, quantity: number, reason: string, direction: 'adjustment' | 'return' | 'adjustment_in' | 'adjustment_out' = 'adjustment', actorId = 'system', unitCost?: number): Promise<StockMovement> {
      if (isRealElectron && existing?.adjustStock) return existing.adjustStock(itemType, itemId, quantity, reason, direction, actorId, unitCost);
      let movement!: StockMovement;
      await db.transaction((draft) => {
        if (!reason?.trim()) throw new Error('سبب التسوية مطلوب');
        const numericQuantity = Number(quantity);
        if (!Number.isFinite(numericQuantity) || numericQuantity === 0) throw new Error('كمية التسوية يجب أن تكون رقماً غير صفري');
        if (direction !== 'adjustment' && numericQuantity < 0) throw new Error('كمية الحركة لا يمكن أن تكون سالبة');
        const delta = direction === 'return' || direction === 'adjustment_in'
          ? Math.abs(numericQuantity)
          : direction === 'adjustment_out' ? -Math.abs(numericQuantity) : numericQuantity;
        movement = insertStockMovementInDraft(draft, itemType, itemId, delta, direction === 'return' ? 'return' : 'adjustment', reason.trim(), { type: 'stock_adjustment', id: itemId }, { actorId, unitCost, updateWac: direction === 'adjustment_in' });
      });
      return movement;
    },

    async returnPurchase(itemType: InventoryItemType, itemId: string, quantity: number, reason: string, originalMovementId?: string, purchaseId?: string, actorId = 'system'): Promise<StockMovement> {
      if (isRealElectron && existing?.returnPurchase) return existing.returnPurchase(itemType, itemId, quantity, reason, originalMovementId, purchaseId, actorId);
      let movement!: StockMovement;
      await db.transaction((draft) => {
        movement = returnPurchaseInDraft(draft, itemType, itemId, quantity, reason, originalMovementId, purchaseId, actorId);
      });
      return movement;
    },

    async getPurchases(): Promise<PurchaseRecord[]> {
      if (isRealElectron && existing?.getPurchases) return existing.getPurchases();
      const data = await window.electronAPI.getData();
      return data.purchases || [];
    },

    async createPurchase(payload: any): Promise<PurchaseRecord> {
      if (isRealElectron && existing?.createPurchase) return existing.createPurchase(payload);
      let purchase!: PurchaseRecord;
      await db.transaction((draft) => {
        purchase = createPurchaseInDraft(draft, payload);
      });
      return purchase;
    },

    async getExpenses(): Promise<ExpenseRecord[]> {
      if (isRealElectron && existing?.getExpenses) return existing.getExpenses();
      const data = await window.electronAPI.getData();
      return data.expenses || [];
    },

    async createExpense(payload: any): Promise<ExpenseRecord> {
      if (isRealElectron && existing?.createExpense) return existing.createExpense(payload);
      let expense!: ExpenseRecord;
      await db.transaction((draft) => {
        expense = applyExpenseToDraft(draft, payload);
      });
      return expense;
    },

    async getCashTransactions(): Promise<CashTransaction[]> {
      if (isRealElectron && existing?.getCashTransactions) return existing.getCashTransactions();
      const data = await window.electronAPI.getData();
      return data.cashTransactions || [];
    },

    async createCashAdjustment(payload: any): Promise<CashTransaction> {
      if (isRealElectron && existing?.createCashAdjustment) return existing.createCashAdjustment(payload);
      let transaction!: CashTransaction;
      await db.transaction((draft) => {
        transaction = applyCashAdjustmentToDraft(draft, payload);
      });
      return transaction;
    },

    async getOrderMaterialUsages(orderId?: string): Promise<OrderMaterialUsage[]> {
      if (isRealElectron && existing?.getOrderMaterialUsages) return existing.getOrderMaterialUsages(orderId);
      const data = await window.electronAPI.getData();
      return (data.orderMaterialUsages || []).filter((usage) => !orderId || usage.orderId === orderId);
    },

    async getOrderEvents(orderId?: string): Promise<OrderEvent[]> {
      if (isRealElectron && existing?.getOrderEvents) return existing.getOrderEvents(orderId);
      const data = await window.electronAPI.getData();
      return (data.orderEvents || []).filter((event) => !orderId || event.orderId === orderId);
    },

    async getOrders(): Promise<Order[]> {
      if (isRealElectron && existing?.getOrders) return existing.getOrders();
      const data = await window.electronAPI.getData();
      return data.orders;
    },

    async createOrder(orderData: Partial<Order>): Promise<Order> {
      if (isRealElectron && existing?.createOrder) return existing.createOrder(orderData);
      const existingData = await window.electronAPI.getData();
      const existingOrder = existingData.orders.find((order) => order.id === orderData.id || (orderData.orderNumber && order.orderNumber === orderData.orderNumber));
      if (existingOrder) return existingOrder;
      let createdOrder: Order | null = null;
      await db.transaction(async (draft) => {
        const settings = await window.electronAPI.getSettings();
        const rate = settings.fabricConsumptionRatePerGarment || 3.5;
        const garmentCount = orderData.garmentCount || 1;
        const requiredMeters = garmentCount * rate;
        const orderNumber = orderData.orderNumber || nextMockOrderNumber(draft.orders);
        const initialStatus = assertSafeInitialOrderStatus(orderData.status);
        const initialPaymentMethod = assertValidPaymentMethod((orderData as any).initialPaymentMethod || 'cash');
        const initialCashReceived = Number(orderData.paidAmount || 0);
        const settlement = initialCashReceived > 0
          ? calculatePaymentUpdate(orderData.totalAmount || 0, 0, orderData.totalAmount || 0, initialCashReceived)
          : { numericAmount: 0, cashReceived: 0, overpaymentAmount: 0, ...calculateOrderAmounts(orderData.totalAmount || 0, 0) };
        if (settlement.overpaymentAmount > 0 && !orderData.customerId) throw new Error('لا يمكن تسجيل overpayment دون ربط الطلب بعميل');
        const { totalAmount, paidAmount, remainingAmount, cashReceived, overpaymentAmount } = settlement;
        const orderId = orderData.id || createSafeId('ORD');
        let fabricMovement: StockMovement | undefined;
        let fabricBuyPrice = orderData.fabricBuyPriceAtOrder || 0;

        // Check stock and record a sale movement atomically.
        if (orderData.fabricId) {
          const fab = draft.fabrics.find(f => f.id === orderData.fabricId);
          if (!fab) throw new Error('القماش المختار غير موجود في المخزون');
          fabricBuyPrice = fab.purchasePrice || fabricBuyPrice;
          fabricMovement = insertStockMovementInDraft(draft, 'fabric', orderData.fabricId, -requiredMeters, 'sale', 'استهلاك قماش للطلب', { type: 'order', id: orderId, number: orderNumber });
        }

        const materialUsages: OrderMaterialUsage[] = [];
        if (orderData.fabricId && fabricMovement) {
          const fabricUsage = buildFabricMaterialUsage(orderId, orderData.fabricId, orderData.fabricName || 'قماش', requiredMeters, fabricBuyPrice, fabricMovement, new Date().toISOString());
          appendMaterialUsage(draft, fabricUsage);
          materialUsages.push(fabricUsage);
        }
        for (const material of (orderData.materialUsages || [])) {
          if (!material.itemId || (material.itemType === 'fabric' && material.itemId === orderData.fabricId)) continue;
          const quantity = Number(material.quantity);
          if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('كمية المادة المرتبطة بالطلب غير صحيحة');
          const meta = getInventoryMeta(draft, material.itemType, material.itemId);
          const movement = insertStockMovementInDraft(draft, material.itemType, material.itemId, -quantity, 'sale', 'استهلاك مادة للطلب', { type: 'order', id: orderId, number: orderNumber });
          const usage = buildMaterialUsage(orderId, material, meta, movement, new Date().toISOString());
          appendMaterialUsage(draft, usage);
          materialUsages.push(usage);
        }
        const materialCost = calculateOrderMaterialCost(materialUsages);

        const createdAt = new Date().toISOString();
        const newOrder = buildOrderDraft({ ...orderData, status: initialStatus, initialPaymentMethod }, {
          orderId,
          orderNumber,
          requiredMeters,
          fabricBuyPrice,
          garmentCount,
          totalAmount,
          paidAmount,
          cashReceived,
          overpaymentAmount,
          materialUsages,
          materialCost,
          createdAt
        });

        draft.orders = [newOrder, ...draft.orders];

        // Create invoice and initial payment through the isolated order adapter.
        const { invoice: newInvoice, payment: initialPayment } = buildInitialInvoiceDraft({ ...orderData, status: initialStatus, initialPaymentMethod }, orderId, orderNumber, totalAmount, cashReceived);
        const initialPaymentId = initialPayment?.id;

        draft.invoices = [newInvoice, ...draft.invoices];
        if (initialPaymentId) {
          mockInsertCash(draft, { id: `CASH-PAY-${initialPaymentId}`, direction: 'in', sourceType: 'customer_payment', sourceId: initialPaymentId, orderId, referenceNumber: orderNumber, amount: cashReceived, paymentMethod: orderData.initialPaymentMethod || 'cash', transactionDate: orderData.orderDate || new Date().toISOString().slice(0, 10), description: `دفعة أولى للطلب #${orderNumber}`, actorId: 'system', reason: 'دفعة أولى عند إنشاء الطلب', createdAt: new Date().toISOString() });
          if (overpaymentAmount > 0) {
            createCustomerCreditFromOverpaymentInDraft(draft, {
              customerId: orderData.customerId,
              orderId,
              invoiceId: newInvoice.id,
              paymentId: initialPaymentId,
              amount: overpaymentAmount,
              paymentMethod: orderData.initialPaymentMethod || 'cash',
              invoiceNumber: newInvoice.invoiceNumber,
              createdAt: new Date().toISOString()
            });
          }
        }
        mockInsertEvent(draft, {
          id: `EVT-CREATED-${orderId}`,
          orderId,
          type: 'created',
          title: 'تم إنشاء الطلب',
          description: `تم إنشاء الطلب #${orderNumber} وتسجيل الفاتورة${paidAmount > 0 ? ' والدفعة الأولى' : ''}.`,
          toStatus: newOrder.status,
          actor: 'النظام',
          metadata: { materialCost, appliedPaid: paidAmount, cashReceived, overpaymentAmount, remainingAmount, paymentStatus: newInvoice.paymentStatus },
          createdAt: newOrder.createdAt
        });
        createdOrder = newOrder;
      });
      return createdOrder!;
    },

    async updateOrder(updatedOrder: Order): Promise<boolean> {
      if (isRealElectron && existing?.updateOrder) return existing.updateOrder(updatedOrder);
      await db.transaction(async (draft) => {
        const existingOrder = draft.orders.find(o => o.id === updatedOrder.id);
        if (!existingOrder) throw new Error('الطلب المطلوب غير موجود');
        const invoice = draft.invoices.find((item) => item.orderId === updatedOrder.id);
        if (!invoice) throw new Error('لا توجد فاتورة مرتبطة بالطلب');
        const current = assertStoredPaymentAggregates(invoice.totalAmount, invoice.paidAmount, invoice.remainingAmount, invoice.payments || [], invoice.cancellationWriteoffAmount);
        if (Math.abs(Number(updatedOrder.paidAmount ?? current.paidAmount) - current.paidAmount) > 0.0001) throw new Error('لا يمكن تعديل المبلغ المدفوع من خلال تحديث الطلب؛ استخدم مسار الدفعات');

        const settings = await window.electronAPI.getSettings();
        const rate = settings.fabricConsumptionRatePerGarment || 3.5;
        const garmentCount = Number(updatedOrder.garmentCount ?? existingOrder.garmentCount ?? 1);
        if (!Number.isInteger(garmentCount) || garmentCount < 1) throw new Error('عدد الثياب يجب أن يكون عدداً صحيحاً لا يقل عن 1');
        const newMeters = garmentCount * rate;

        updateOrderMaterialsInDraft(draft, existingOrder, updatedOrder, newMeters);

        updatedOrder.fabricConsumptionMeters = newMeters;
        updatedOrder.garmentCount = garmentCount;
        const totalAmount = Number(updatedOrder.totalAmount ?? existingOrder.totalAmount);
        const paidAmount = current.paidAmount;
        updateOrderInvoiceInDraft(draft, updatedOrder, totalAmount, paidAmount);
        const updatedInvoice = draft.invoices.find((item) => item.orderId === updatedOrder.id);

        draft.orders = draft.orders.map((order) => order.id === updatedOrder.id ? {
          ...updatedOrder,
          status: existingOrder.status,
          paidAmount,
          remainingAmount: updatedInvoice?.remainingAmount ?? current.remainingAmount,
          cashReceived: updatedInvoice?.cashReceived ?? existingOrder.cashReceived,
          overpaymentAmount: updatedInvoice?.overpaymentAmount ?? existingOrder.overpaymentAmount,
          cancellationWriteoffAmount: updatedInvoice?.cancellationWriteoffAmount ?? existingOrder.cancellationWriteoffAmount
        } : order);
      });
      return true;
    },

    async updateOrderStatus(id: string, status: string): Promise<boolean> {
      if (isRealElectron && existing?.updateOrderStatus) return existing.updateOrderStatus(id, status);
      await db.transaction((draft) => {
        const order = draft.orders.find((item) => item.id === id);
        if (!order) throw new Error('الطلب غير موجود في قاعدة البيانات');
        const oldStatus = String(order.status);
        const allowed: Record<string, string[]> = { new: ['processing', 'cancelled'], processing: ['ready', 'cancelled'], ready: ['delivered', 'cancelled'], delivered: [], cancelled: ['new'] };
        if (oldStatus === status) return;
        if (!allowed[oldStatus]?.includes(status)) throw new Error(`انتقال حالة الطلب من ${oldStatus} إلى ${status} غير مسموح`);
        const usages = (draft.orderMaterialUsages || []).filter((usage) => usage.orderId === id);
        let cancellationWriteoffAmount = 0;
        let cancellationPaymentStatus: 'paid' | 'settled_by_cancellation' | undefined;
        if (status === 'cancelled') {
          const settlement = settleCancelledOrderInDraft(draft, id);
          cancellationWriteoffAmount = settlement.cancellationWriteoffAmount;
          cancellationPaymentStatus = settlement.paymentStatus;
          for (const usage of usages) {
            const movement = insertStockMovementInDraft(draft, usage.itemType, usage.itemId, usage.quantity, 'return', 'إرجاع مواد بسبب إلغاء الطلب', { type: 'order_cancel', id }, { unitCost: usage.unitCostAtUsage, sourceMovementId: usage.sourceMovementId, actorId: 'system', updateWac: false });
            usage.sourceMovementId = undefined;
            void movement;
          }
        } else if (oldStatus === 'cancelled' && status === 'new') {
          for (const usage of usages) {
            const movement = insertStockMovementInDraft(draft, usage.itemType, usage.itemId, -usage.quantity, 'sale', 'إعادة استهلاك مواد بعد إلغاء الإلغاء', { type: 'order_reactivate', id });
            usage.sourceMovementId = movement.id;
          }
        }
        order.status = status as any;
        const createdAt = new Date().toISOString();
        mockInsertEvent(draft, {
          id: createSafeId(`EVT-STATUS-${id}`),
          orderId: id,
          type: 'status_changed',
          title: `تغيير الحالة إلى ${status}`,
          description: `تم تغيير حالة الطلب من ${oldStatus} إلى ${status}${status === 'cancelled' ? ' مع إعادة المواد للمخزون' : oldStatus === 'cancelled' ? ' مع إعادة استهلاك المواد' : ''}.`,
          fromStatus: oldStatus,
          toStatus: status,
          actor: 'النظام',
          metadata: status === 'cancelled' ? { cancellationWriteoffAmount, paymentStatus: cancellationPaymentStatus || 'paid', cashReversalCreated: false } : undefined,
          createdAt
        });
      });
      return true;
    },

    async getInvoices(): Promise<Invoice[]> {
      if (isRealElectron && existing?.getInvoices) return existing.getInvoices();
      const data = await window.electronAPI.getData();
      return data.invoices;
    },

    async addPayment(invoiceId: string, amount: number, method: string, note: string, paymentId?: string): Promise<boolean> {
      if (isRealElectron && existing?.addPayment) return existing.addPayment(invoiceId, amount, method, note, paymentId);
      await db.transaction((draft) => {
        applyPaymentToDraft(draft, invoiceId, amount, method, note, paymentId);
      });
      return true;
    },

    customerCredits: {
      async list(customerId: string, filters: CustomerCreditHistoryFilters = {}): Promise<CustomerCreditRecord[]> {
        if (isRealElectron && existing?.customerCredits?.list) return existing.customerCredits.list(customerId, filters);
        const data = await window.electronAPI.getData();
        return getCustomerCreditHistoryInDraft(data, customerId, filters);
      },
      async summary(customerId: string): Promise<CustomerCreditSummary> {
        if (isRealElectron && existing?.customerCredits?.summary) return existing.customerCredits.summary(customerId);
        const data = await window.electronAPI.getData();
        return getCustomerCreditSummaryInDraft(data, customerId);
      },
      async apply(request: CustomerCreditApplyRequest): Promise<CustomerCreditOperationResult> {
        if (isRealElectron && existing?.customerCredits?.apply) return existing.customerCredits.apply(request);
        const transaction = await db.transaction((draft) => applyCustomerCreditInDraft(draft, request));
        return transaction.result;
      },
      async refund(request: CustomerCreditRefundRequest): Promise<CustomerCreditOperationResult> {
        if (isRealElectron && existing?.customerCredits?.refund) return existing.customerCredits.refund(request);
        const transaction = await db.transaction((draft) => refundCustomerCreditInDraft(draft, request));
        return transaction.result;
      },
      async getOperation(operationId: string) {
        if (isRealElectron && existing?.customerCredits?.getOperation) return existing.customerCredits.getOperation(operationId);
        const data = await window.electronAPI.getData();
        return getCustomerCreditOperationInDraft(data, operationId);
      }
    },

    async getSettings(): Promise<any> {
      if (isRealElectron && existing?.getSettings) return existing.getSettings();
      try {
        const stored = localStorage.getItem('sahwa_settings_v1');
        if (stored) return JSON.parse(stored);
      } catch (e) {}
      return { fabricConsumptionRatePerGarment: 3.5 };
    },

    async updateSetting(key: string, value: any): Promise<boolean> {
      if (isRealElectron && existing?.updateSetting) return existing.updateSetting(key, value);
      try {
        const settings = await window.electronAPI.getSettings();
        settings[key] = value;
        localStorage.setItem('sahwa_settings_v1', JSON.stringify(settings));
        return true;
      } catch (e) {
        return false;
      }
    },

    async sendWhatsAppNotice(phone: string, customerName: string, orderNumber: string, statusText: string): Promise<boolean> {
      // Formats whatsapp link and simulates IPC messaging log
      const cleanPhone = phone.replace(/\D/g, '');
      const internationalPhone = cleanPhone.startsWith('05') ? '966' + cleanPhone.substring(1) : cleanPhone;
      const message = `مرحباً بك أ/ ${customerName}، نفيدك بنتيجة متابعة طلبك رقم (#${orderNumber}) لدى صهوة للخياطة. حالياً: ${statusText}. يسعدنا تواصلكم دائماً!`;
      
      const whatsappUrl = `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');

      // Log notification in IPC state
      const data = await window.electronAPI.getData();
      const order = data.orders.find((item) => item.orderNumber === orderNumber);
      const newNotif: NotificationItem = {
        id: createSafeId('NOTIF'),
        type: 'whatsapp',
        title: `تذكير واتساب - طلب #${orderNumber}`,
        message: `تم إرسال رسالة واتساب للعميل ${customerName} (${phone}) - الحالة: ${statusText}`,
        date: new Date().toLocaleString('ar-SA'),
        read: true,
        customerPhone: phone,
        orderId: order?.id
      };
      data.notifications = [newNotif, ...data.notifications];
      if (order) {
        mockInsertEvent(data, {
          id: `EVT-WHATSAPP-${newNotif.id}`,
          orderId: order.id,
          type: 'whatsapp',
          title: 'فتح رسالة واتساب',
          description: `تم تجهيز رسالة واتساب للعميل ${customerName} عن حالة الطلب: ${statusText}.`,
          actor: 'النظام',
          metadata: { phone, orderNumber, statusText },
          createdAt: new Date().toISOString()
        });
      }
      await window.electronAPI.saveData(data);

      return true;
    },

    printDocument() {
      window.print();
    }
  } as any;
}
