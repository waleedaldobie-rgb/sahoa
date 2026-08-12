import { AppData, UserPreferences, Customer, Order, Invoice, FabricItem, AccessoryItem, ThobeType, ColorItem, NotificationItem, PaymentRecord } from '../types';
import { checkAndSyncStockAlerts } from '../utils/stockAlerts';

const STORAGE_KEY = 'sahwa_tailoring_app_data_v1';
const PREFS_KEY = 'sahwa_tailoring_prefs_v1';

// Initial default measurements template
export const DEFAULT_MEASUREMENTS = {
  frontLength: '145',
  backLength: '146',
  shoulderWidth: '44',
  shoulderSlope: '3.5',
  sleeveLength: '62',
  cuffWidth: '13',
  handOpeningTop: '26',
  handOpeningMid: '22',
  handOpeningLowerMid: '19',
  handOpeningBottom: '16',
  neckSize: '40',
  neckHeight: '4.5',
  chestSize: '108',
  waistSize: '102',
  hipSize: '112',
  clearances: '8',
  stepSize: '75',
  overlapSize: '6',
  pieceCount: '1',
  bottomSweep: '78',
  currentWeight: '76'
};

export const DEFAULT_STYLE_DETAILS = {
  neckSizeHeader: '40',
  neckHeightHeader: '4.5',
  neckType: 'قلاب',
  neckShape: 'سادة',
  neckPadding: 'حشوة عادي',
  neckLining: 'حشو ألماني مقوى',
  neckNotes: '',

  buttonsType: 'طقاق حديد مخفي',

  habroorType: 'حبرور سادة',
  habroorPadding: 'واحد حشوة',
  habroorLining: 'حشوة خفيفة',
  habroorStyle: 'عرض ٣.٥ سم',
  habroorBottom: 'مربع عادي',

  sleeveCuffLength: '62',
  sleevePlainLength: '61',
  sleeveType: 'كم عادي',
  sleevePadding: 'كبك حشوة سنجل',
  sleeveShape: 'مستقيم',
  sleeveLining: 'بدون حشو',
  pleatsStyle: 'كسرة واحدة خلفية',
  sleeveNotes: '',

  chestPocketDrop: '22',
  chestPocketWidth: '13',
  chestPocketPadding: 'حشوة سنجل',
  chestPocketStyle: 'مربع بكسرة علوية',
  chestLining: 'قماش رقيق مطابق',
  pocketNotes: '',

  sidePockets: 'جيب جانبي مزدوج',
  mobilePocketRight: 'جوال يمين',
  mobilePocketLeft: 'بدون',
  penPocketStyle: 'جيب قلم جانبي مخفي',
  rightSide: 'جيب مخفي بجوال',
  leftSide: 'جيب قياسي',
  bottomHemShape: 'جبزور مربع',

  cuff1: 'كبك زرارين',
  cuff2: 'عرض ٦ سم',
  cuff3: 'بطانة متوسطة',
  cuff4: 'فتحة زاوية',
  cuff5: 'خياطة بارزة',
  stitchingType: 'خياطة دقيقة مزدوجة',
  richieMark: 'علامة صهوة الأصيلة',
  generalNotes: 'يفضل غسيل بالماء البارد دون استخدام مبيضات',
  additionalNotes: 'التأكد من شد الخياطة عند الكتف',
  modelPhoto: '',
  modelTextDescription: ''
};

// Blank templates used when starting a brand-new customer/order record.
// Every field starts empty — no trial numbers or sample values are shown to the user.
export const EMPTY_MEASUREMENTS: typeof DEFAULT_MEASUREMENTS = {
  frontLength: '',
  backLength: '',
  shoulderWidth: '',
  shoulderSlope: '',
  sleeveLength: '',
  cuffWidth: '',
  handOpeningTop: '',
  handOpeningMid: '',
  handOpeningLowerMid: '',
  handOpeningBottom: '',
  neckSize: '',
  neckHeight: '',
  chestSize: '',
  waistSize: '',
  hipSize: '',
  clearances: '',
  stepSize: '',
  overlapSize: '',
  pieceCount: '',
  bottomSweep: '',
  currentWeight: ''
};

export const EMPTY_STYLE_DETAILS: typeof DEFAULT_STYLE_DETAILS = {
  neckSizeHeader: '',
  neckHeightHeader: '',
  neckType: '',
  neckShape: '',
  neckPadding: '',
  neckLining: '',
  neckNotes: '',

  buttonsType: '',

  habroorType: '',
  habroorPadding: '',
  habroorLining: '',
  habroorStyle: '',
  habroorBottom: '',

  sleeveCuffLength: '',
  sleevePlainLength: '',
  sleeveType: '',
  sleevePadding: '',
  sleeveShape: '',
  sleeveLining: '',
  pleatsStyle: '',
  sleeveNotes: '',

  chestPocketDrop: '',
  chestPocketWidth: '',
  chestPocketPadding: '',
  chestPocketStyle: '',
  chestLining: '',
  pocketNotes: '',

  sidePockets: '',
  mobilePocketRight: '',
  mobilePocketLeft: '',
  penPocketStyle: '',
  rightSide: '',
  leftSide: '',
  bottomHemShape: '',

  cuff1: '',
  cuff2: '',
  cuff3: '',
  cuff4: '',
  cuff5: '',
  stitchingType: '',
  richieMark: '',
  generalNotes: '',
  additionalNotes: '',
  modelPhoto: '',
  modelTextDescription: ''
};

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
  notifications: INITIAL_NOTIFICATIONS
};

const INITIAL_PREFS: UserPreferences = {
  activeTab: 'dashboard',
  invoicePrintMode: 'detailed'
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

function sanitizeAppData(raw: Partial<AppData>): AppData {
  return {
    customers: deduplicateById(raw.customers || INITIAL_CUSTOMERS),
    orders: deduplicateById(raw.orders || INITIAL_ORDERS),
    invoices: deduplicateById(raw.invoices || INITIAL_INVOICES),
    fabrics: deduplicateById(raw.fabrics || INITIAL_FABRICS),
    accessories: deduplicateById(raw.accessories || INITIAL_ACCESSORIES),
    thobeTypes: deduplicateById(raw.thobeTypes || INITIAL_THOBE_TYPES),
    colors: deduplicateById(raw.colors || INITIAL_COLORS),
    notifications: deduplicateById(raw.notifications || INITIAL_NOTIFICATIONS)
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

// Setup window.electronAPI mock
export function initElectronMock() {
  if (typeof window === 'undefined') return;

  const existing = window.electronAPI;
  const isRealElectron = existing && !(existing as any).__isMock;

  window.electronAPI = {
    __isMock: true,
    ...existing,
    db,

    async getData(): Promise<AppData> {
      if (isRealElectron && existing?.getCustomers && existing?.getOrders && existing?.getInvoices && existing?.getFabrics && existing?.getAccessories) {
        try {
          const [customers, orders, invoices, fabrics, accessories] = await Promise.all([
            existing.getCustomers(),
            existing.getOrders(),
            existing.getInvoices(),
            existing.getFabrics(),
            existing.getAccessories()
          ]);
          return {
            customers: customers || [],
            orders: orders || [],
            invoices: invoices || [],
            fabrics: fabrics || [],
            accessories: accessories || [],
            thobeTypes: INITIAL_THOBE_TYPES,
            colors: INITIAL_COLORS,
            notifications: []
          };
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
              notifications: []
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
          notifications: []
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
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
          notifications: []
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
        const o = draft.orders.find(ord => ord.id === id);
        if (o && o.fabricId && (o.status as string) !== 'cancelled') {
          const fab = draft.fabrics.find(f => f.id === o.fabricId);
          if (fab) {
            fab.quantityMeters = Number((fab.quantityMeters + o.fabricConsumptionMeters).toFixed(2));
          }
        }
        draft.orders = draft.orders.filter((ord) => ord.id !== id);
        draft.invoices = draft.invoices.filter((inv) => inv.orderId !== id);
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
      const data = await window.electronAPI.getData();
      const newCustomer: Customer = {
        id: customer.id || `CUST-${Date.now()}`,
        name: customer.name || 'عميل جديد',
        phone: customer.phone || '',
        createdAt: customer.createdAt || new Date().toISOString().slice(0, 10),
        measurements: { ...DEFAULT_MEASUREMENTS, ...customer.measurements },
        styleDetails: { ...DEFAULT_STYLE_DETAILS, ...customer.styleDetails },
        measurementHistory: customer.measurementHistory || []
      };
      data.customers = [newCustomer, ...data.customers];
      await window.electronAPI.saveData(data);
      return newCustomer;
    },

    async updateCustomer(customer: Customer): Promise<boolean> {
      if (isRealElectron && existing?.updateCustomer) return existing.updateCustomer(customer);
      const data = await window.electronAPI.getData();
      data.customers = data.customers.map(c => c.id === customer.id ? customer : c);
      await window.electronAPI.saveData(data);
      return true;
    },

    async saveCustomerMeasurementHistory(id: string, note: string): Promise<any> {
      if (isRealElectron && existing?.saveCustomerMeasurementHistory) return existing.saveCustomerMeasurementHistory(id, note);
      const data = await window.electronAPI.getData();
      const customer = data.customers.find(c => c.id === id);
      if (!customer) throw new Error('العميل غير موجود في قاعدة البيانات');
      const newHistory = {
        id: `HIST-${Date.now()}`,
        savedAt: new Date().toISOString().slice(0, 10),
        note,
        measurements: { ...customer.measurements },
        styleDetails: { ...customer.styleDetails }
      };
      customer.measurementHistory = [newHistory, ...(customer.measurementHistory || [])];
      data.customers = data.customers.map(c => c.id === id ? customer : c);
      await window.electronAPI.saveData(data);
      return newHistory;
    },

    async getFabrics(): Promise<FabricItem[]> {
      if (isRealElectron && existing?.getFabrics) return existing.getFabrics();
      const data = await window.electronAPI.getData();
      return data.fabrics;
    },

    async createFabric(fabric: Partial<FabricItem>): Promise<FabricItem> {
      if (isRealElectron && existing?.createFabric) return existing.createFabric(fabric);
      const data = await window.electronAPI.getData();
      const newFabric: FabricItem = {
        id: fabric.id || `FAB-${Date.now()}`,
        name: fabric.name || '',
        color: fabric.color || '',
        colorHex: fabric.colorHex || '#ffffff',
        purchasePrice: fabric.purchasePrice || 0,
        sellingPrice: fabric.sellingPrice || 0,
        quantityMeters: fabric.quantityMeters || 0,
        minStockMeters: fabric.minStockMeters || 0
      };
      data.fabrics = [newFabric, ...data.fabrics];
      await window.electronAPI.saveData(data);
      return newFabric;
    },

    async updateFabric(fabric: FabricItem): Promise<boolean> {
      if (isRealElectron && existing?.updateFabric) return existing.updateFabric(fabric);
      const data = await window.electronAPI.getData();
      data.fabrics = data.fabrics.map(f => f.id === fabric.id ? fabric : f);
      await window.electronAPI.saveData(data);
      return true;
    },

    async getAccessories(): Promise<AccessoryItem[]> {
      if (isRealElectron && existing?.getAccessories) return existing.getAccessories();
      const data = await window.electronAPI.getData();
      return data.accessories;
    },

    async createAccessory(acc: Partial<AccessoryItem>): Promise<AccessoryItem> {
      if (isRealElectron && existing?.createAccessory) return existing.createAccessory(acc);
      const data = await window.electronAPI.getData();
      const newAcc: AccessoryItem = {
        id: acc.id || `ACC-${Date.now()}`,
        name: acc.name || '',
        category: acc.category || '',
        quantity: acc.quantity || 0,
        minStock: acc.minStock || 0,
        unit: acc.unit || 'حبة'
      };
      data.accessories = [newAcc, ...data.accessories];
      await window.electronAPI.saveData(data);
      return newAcc;
    },

    async updateAccessory(acc: AccessoryItem): Promise<boolean> {
      if (isRealElectron && existing?.updateAccessory) return existing.updateAccessory(acc);
      const data = await window.electronAPI.getData();
      data.accessories = data.accessories.map(a => a.id === acc.id ? acc : a);
      await window.electronAPI.saveData(data);
      return true;
    },

    async getOrders(): Promise<Order[]> {
      if (isRealElectron && existing?.getOrders) return existing.getOrders();
      const data = await window.electronAPI.getData();
      return data.orders;
    },

    async createOrder(orderData: Partial<Order>): Promise<Order> {
      if (isRealElectron && existing?.createOrder) return existing.createOrder(orderData);
      let createdOrder: Order | null = null;
      await db.transaction(async (draft) => {
        const settings = await window.electronAPI.getSettings();
        const rate = settings.fabricConsumptionRatePerGarment || 3.5;
        const garmentCount = orderData.garmentCount || 1;
        const requiredMeters = garmentCount * rate;

        // Check stock and deduct
        if (orderData.fabricId) {
          const fab = draft.fabrics.find(f => f.id === orderData.fabricId);
          if (!fab) throw new Error('القماش المختار غير موجود في المخزون');
          if (fab.quantityMeters < requiredMeters) {
            throw new Error(`كمية القماش المتوفرة (${fab.quantityMeters} متر) غير كافية لخصم الطلب الحالي (${requiredMeters} متر).`);
          }
          fab.quantityMeters = Number((fab.quantityMeters - requiredMeters).toFixed(2));
        }

        const count = draft.orders.length;
        const orderNumber = orderData.orderNumber || `${1001 + count}`;
        const totalAmount = orderData.totalAmount || 0;
        const paidAmount = orderData.paidAmount || 0;
        const remainingAmount = totalAmount - paidAmount;
        const orderId = orderData.id || `ORD-${Date.now()}`;

        const newOrder: Order = {
          id: orderId,
          orderNumber,
          customerId: orderData.customerId || '',
          customerName: orderData.customerName || '',
          customerPhone: orderData.customerPhone || '',
          thobeTypeId: orderData.thobeTypeId || '',
          thobeTypeName: orderData.thobeTypeName || 'ثوب',
          fabricId: orderData.fabricId || '',
          fabricName: orderData.fabricName || '',
          fabricColor: orderData.fabricColor || '',
          fabricConsumptionMeters: requiredMeters,
          fabricBuyPriceAtOrder: orderData.fabricBuyPriceAtOrder || 0,
          garmentCount,
          orderDate: orderData.orderDate || new Date().toISOString().slice(0, 10),
          deliveryDate: orderData.deliveryDate || new Date().toISOString().slice(0, 10),
          status: orderData.status || 'new',
          totalAmount,
          paidAmount,
          remainingAmount,
          isCustomMeasurement: Boolean(orderData.isCustomMeasurement),
          measurements: orderData.measurements || { ...DEFAULT_MEASUREMENTS },
          styleDetails: orderData.styleDetails || { ...DEFAULT_STYLE_DETAILS },
          notes: orderData.notes || '',
          createdAt: new Date().toISOString()
        };

        draft.orders = [newOrder, ...draft.orders];

        // Create invoice
        const invId = `INV-${orderNumber}`;
        const pStatus = remainingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
        const initialPayments: PaymentRecord[] = paidAmount > 0 ? [{
          id: `PAY-${Date.now()}`,
          invoiceId: invId,
          orderId: orderId,
          amount: paidAmount,
          paymentDate: orderData.orderDate || new Date().toISOString().slice(0, 10),
          method: 'cash' as const,
          note: 'دفعة أولى عند إنشاء الطلب'
        }] : [];

        const newInvoice: Invoice = {
          id: invId,
          invoiceNumber: invId,
          orderId: orderId,
          customerName: orderData.customerName || '',
          customerPhone: orderData.customerPhone || '',
          orderDate: orderData.orderDate || new Date().toISOString().slice(0, 10),
          totalAmount,
          paidAmount,
          remainingAmount,
          paymentStatus: pStatus,
          payments: initialPayments
        };

        draft.invoices = [newInvoice, ...draft.invoices];
        createdOrder = newOrder;
      });
      return createdOrder!;
    },

    async updateOrder(updatedOrder: Order): Promise<boolean> {
      if (isRealElectron && existing?.updateOrder) return existing.updateOrder(updatedOrder);
      await db.transaction(async (draft) => {
        const existingOrder = draft.orders.find(o => o.id === updatedOrder.id);
        if (!existingOrder) throw new Error('الطلب المطلوب غير موجود');

        const settings = await window.electronAPI.getSettings();
        const rate = settings.fabricConsumptionRatePerGarment || 3.5;
        const newMeters = (updatedOrder.garmentCount || 1) * rate;

        const fabricChanged = existingOrder.fabricId !== updatedOrder.fabricId;
        const countChanged = existingOrder.garmentCount !== updatedOrder.garmentCount;

        if ((fabricChanged || countChanged) && (existingOrder.status as string) !== 'cancelled') {
          // Restore old fabric
          if (existingOrder.fabricId) {
            const oldFab = draft.fabrics.find(f => f.id === existingOrder.fabricId);
            if (oldFab) {
              oldFab.quantityMeters = Number((oldFab.quantityMeters + existingOrder.fabricConsumptionMeters).toFixed(2));
            }
          }

          // Deduct new fabric
          if (updatedOrder.fabricId) {
            const newFab = draft.fabrics.find(f => f.id === updatedOrder.fabricId);
            if (!newFab) throw new Error('القماش الجديد المختار غير موجود');
            if (newFab.quantityMeters < newMeters) {
              throw new Error(`الكمية المتاحة من القماش الجديدة (${newFab.quantityMeters} متر) غير كافية للطلب (${newMeters} متر).`);
            }
            newFab.quantityMeters = Number((newFab.quantityMeters - newMeters).toFixed(2));
            updatedOrder.fabricBuyPriceAtOrder = newFab.purchasePrice || 0;
          }
        }

        updatedOrder.fabricConsumptionMeters = newMeters;
        const totalAmount = updatedOrder.totalAmount || 0;
        const paidAmount = updatedOrder.paidAmount || 0;
        const remainingAmount = totalAmount - paidAmount;
        updatedOrder.remainingAmount = remainingAmount;

        draft.orders = draft.orders.map(o => o.id === updatedOrder.id ? updatedOrder : o);

        // Update invoice
        const pStatus = remainingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
        draft.invoices = draft.invoices.map(inv => {
          if (inv.orderId === updatedOrder.id) {
            return {
              ...inv,
              customerName: updatedOrder.customerName,
              customerPhone: updatedOrder.customerPhone,
              totalAmount,
              paidAmount,
              remainingAmount,
              paymentStatus: pStatus
            };
          }
          return inv;
        });
      });
      return true;
    },

    async updateOrderStatus(id: string, status: string): Promise<boolean> {
      if (isRealElectron && existing?.updateOrderStatus) return existing.updateOrderStatus(id, status);
      await db.transaction((draft) => {
        const order = draft.orders.find(o => o.id === id);
        if (!order) throw new Error('الطلب غير موجود في قاعدة البيانات');

        const oldStatus = order.status;
        if (status === 'cancelled' && (oldStatus as string) !== 'cancelled' && order.fabricId) {
          // Return fabric
          const fab = draft.fabrics.find(f => f.id === order.fabricId);
          if (fab) {
            fab.quantityMeters = Number((fab.quantityMeters + order.fabricConsumptionMeters).toFixed(2));
          }
        } else if ((oldStatus as string) === 'cancelled' && status !== 'cancelled' && order.fabricId) {
          // Re-deduct
          const fab = draft.fabrics.find(f => f.id === order.fabricId);
          if (fab) {
            if (fab.quantityMeters < order.fabricConsumptionMeters) {
              throw new Error('لا توجد كمية قماش كافية لتغيير الحالة من ملغي إلى نشط.');
            }
            fab.quantityMeters = Number((fab.quantityMeters - order.fabricConsumptionMeters).toFixed(2));
          }
        }

        order.status = status as any;
      });
      return true;
    },

    async getInvoices(): Promise<Invoice[]> {
      if (isRealElectron && existing?.getInvoices) return existing.getInvoices();
      const data = await window.electronAPI.getData();
      return data.invoices;
    },

    async addPayment(invoiceId: string, amount: number, method: string, note: string): Promise<boolean> {
      if (isRealElectron && existing?.addPayment) return existing.addPayment(invoiceId, amount, method, note);
      await db.transaction((draft) => {
        const inv = draft.invoices.find(i => i.id === invoiceId);
        if (!inv) throw new Error('الفاتورة غير موجودة');

        const payment: PaymentRecord = {
          id: `PAY-${Date.now()}`,
          invoiceId,
          orderId: inv.orderId,
          amount,
          paymentDate: new Date().toISOString().slice(0, 10),
          method: method as any,
          note
        };

        inv.payments = [...(inv.payments || []), payment];
        inv.paidAmount += amount;
        inv.remainingAmount = Math.max(0, inv.totalAmount - inv.paidAmount);
        inv.paymentStatus = inv.remainingAmount <= 0 ? 'paid' : 'partial';

        // Update order
        const order = draft.orders.find(o => o.id === inv.orderId);
        if (order) {
          order.paidAmount = inv.paidAmount;
          order.remainingAmount = inv.remainingAmount;
        }
      });
      return true;
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
      const newNotif: NotificationItem = {
        id: 'NOTIF-' + Date.now(),
        type: 'whatsapp',
        title: `تذكير واتساب - طلب #${orderNumber}`,
        message: `تم إرسال رسالة واتساب للعميل ${customerName} (${phone}) - الحالة: ${statusText}`,
        date: new Date().toLocaleString('ar-SA'),
        read: true,
        customerPhone: phone
      };
      data.notifications = [newNotif, ...data.notifications];
      await window.electronAPI.saveData(data);

      return true;
    },

    printDocument() {
      window.print();
    }
  } as any;
}
