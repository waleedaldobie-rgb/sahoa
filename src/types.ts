/**
 * Types definition for Sahwa Tailoring (صهوة للخياطة)
 */

export interface CustomerMeasurements {
  frontLength: string; // طول أمامي
  backLength: string; // طول خلفي
  shoulderWidth: string; // الكتف
  shoulderSlope: string; // ميلان الكتف
  sleeveLength: string; // الكم عادي
  cuffWidth: string; // الكم الكبك
  handOpeningTop: string; // فتحة اليد أعلي
  handOpeningMid: string; // فتحة اليد وسط
  handOpeningLowerMid: string; // فتحة اليد أسفل الوسط
  handOpeningBottom: string; // فتحة اليد الأسفل
  neckSize: string; // الرقبة مقاس
  neckHeight: string; // الرقبة ارتفاع
  chestSize: string; // الصدر
  waistSize: string; // الخصر
  hipSize: string; // الحوض
  clearances: string; // التخاليص
  stepSize: string; // الخطوة
  overlapSize: string; // الغلب
  pieceCount: string; // عدد القطع
  bottomSweep: string; // وسع أسفل الثوب
  currentWeight?: string; // الوزن الحالي (اختياري)
}

export interface CustomerStyleDetails {
  // 1. الرقبة وحشوتها
  neckSizeHeader?: string; // مقاس الرقبة
  neckHeightHeader?: string; // ارتفاع الرقبة
  neckType: string; // نوع الرقبة
  neckShape: string; // شكل الرقبة
  neckPadding?: string; // حشوة الرقبة (حشوة عادي / حشوة دبل / واحد حشوة دبل / واحد حشوة سنجل)
  neckLining: string; // بطانة الرقبة
  neckNotes?: string; // ملاحظات الرقبة

  // 2. الأزرار
  buttonsType: string; // الأزرار (طقاق حديد مخفي / طقاق بلاستيك مخفي / أزرار عاديه / طقطق باين)

  // 3. الحبرور / الجبرور وحشوتها
  habroorType: string; // الحبرور
  habroorPadding?: string; // حشوة الجبرور (واحد حشوة / مخفي حشوة حبروز / مخفي قماش)
  habroorLining: string; // بطانة الحبرور
  habroorStyle: string; // موديل الجبرور القديم
  habroorLength?: string; // طول الجبزور كقياس مستقل
  habroorBottom: string; // شكل أسفل

  // 4. الكم وحشوة الكم
  sleeveCuffLength?: string; // طول الكم كبك
  sleevePlainLength?: string; // طول الكم سادة
  sleeveType: string; // الكم
  sleevePadding?: string; // حشوة الكم (كبك قلاب / كبك حشوة دبل / كبك حشوة سنجل / كبك سادة)
  sleeveShape: string; // شكل الكم
  sleeveLining: string; // بطانة الكم
  pleatsStyle: string; // موديل الكسرات
  sleeveNotes?: string; // ملاحظات الكم

  // 5. جيب الصدر وحشوة الجيب
  chestPocketDrop: string; // ترلة جيب الصدر
  chestPocketWidth: string; // عرض الحشوة
  chestPocketPadding?: string; // حشوة الجيب (حشوة سنجل / حشوة دبل / بدون حشوة)
  chestPocketStyle: string; // موديل الجيب
  chestLining: string; // بطانة الصدر
  pocketNotes?: string; // ملاحظات الجيب

  // 6. الجوانب، الجوال والقلم
  sidePockets?: string; // جيب الجوانب
  mobilePocketRight?: string; // جيب جوال يمين
  mobilePocketLeft?: string; // جيب جوال يسار
  penPocketStyle: string; // موديل القلم
  rightSide: string; // الجانب الأيمن
  leftSide: string; // الجانب الأيسر
  bottomHemShape: string; // شكل الأسفل

  // 7. خانات الكبك وتطريز العلامة
  cuff1: string; // الكبك خانة ١
  cuff2: string; // الكبك خانة ٢
  cuff3: string; // الكبك خانة ٣
  cuff4: string; // الكبك خانة ٤
  cuff5: string; // الكبك خانة ٥
  stitchingType: string; // نوع الخياطة
  richieMark: string; // علامة ريتشي
  generalNotes: string; // ملاحظات عامة
  additionalNotes: string; // ملاحظات إضافية
  tailorNotes?: string; // ملاحظات مخصصة للخياط تظهر في الفاتورة
  modelPhoto?: string; // صورة الموديل (كـ Base64 أو رابط)
  modelTextDescription?: string; // تفاصيل الموديل يدوياً (كتابة)
}

export interface MeasurementHistoryRecord {
  id: string;
  savedAt: string; // ISO String or Arabic formatted date
  note?: string;
  measurements: CustomerMeasurements;
  styleDetails: CustomerStyleDetails;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
  updatedAt?: string;
  measurements: CustomerMeasurements;
  styleDetails: CustomerStyleDetails;
  measurementHistory: MeasurementHistoryRecord[];
}

export type OrderStatus = 'new' | 'processing' | 'ready' | 'delivered';

export type OrderEventType = 'created' | 'status_changed' | 'inventory' | 'payment' | 'whatsapp' | 'printed' | 'measurement_applied' | 'note';

export interface OrderEvent {
  id: string;
  orderId: string;
  type: OrderEventType;
  title: string;
  description: string;
  fromStatus?: string;
  toStatus?: string;
  actor?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type InventoryItemType = 'fabric' | 'accessory';
export type InventoryMovementDirection = 'purchase' | 'sale' | 'adjustment' | 'return';
export type PaymentMethod = 'cash' | 'card' | 'transfer';

export interface StockMovement {
  id: string;
  itemType: InventoryItemType;
  itemId: string;
  itemName: string;
  direction: InventoryMovementDirection;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  unit: string;
  reason: string;
  referenceType?: string;
  referenceId?: string;
  referenceNumber?: string;
  createdAt: string;
}

export interface PurchaseLine {
  id: string;
  purchaseId: string;
  itemType: InventoryItemType;
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalAmount: number;
  createdAt: string;
}

export interface PurchaseRecord {
  id: string;
  supplier: string;
  invoiceNumber?: string;
  purchaseDate: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  status: 'approved' | 'cancelled';
  lines: PurchaseLine[];
  createdAt: string;
}

export interface ExpenseRecord {
  id: string;
  category: 'إيجار' | 'كهرباء' | 'ماء' | 'رواتب' | 'صيانة' | 'نقل' | 'تشغيل' | 'أخرى' | string;
  amount: number;
  expenseDate: string;
  paymentMethod: PaymentMethod;
  description: string;
  notes?: string;
  createdAt: string;
}

export type CashSourceType = 'opening_balance' | 'customer_payment' | 'sale' | 'purchase' | 'expense' | 'withdrawal' | 'adjustment';

export interface CashTransaction {
  id: string;
  direction: 'in' | 'out';
  sourceType: CashSourceType;
  sourceId?: string;
  orderId?: string;
  referenceNumber?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionDate: string;
  description: string;
  notes?: string;
  createdAt: string;
}

export interface OrderMaterialUsage {
  id: string;
  orderId: string;
  itemType: InventoryItemType;
  itemId?: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitCostAtUsage: number;
  totalCost: number;
  sourceMovementId?: string;
  createdAt: string;
}

export type OrderMaterialUsageInput = Omit<OrderMaterialUsage, 'id' | 'orderId' | 'totalCost' | 'createdAt' | 'sourceMovementId'> & {
  itemId: string;
  unitCostAtUsage?: number;
};

export interface Order {
  id: string;
  orderNumber: string; // e.g. ORD-1001
  customerId: string;
  customerName: string;
  customerPhone: string;
  thobeTypeId: string;
  thobeTypeName: string;
  fabricId: string;
  fabricName: string;
  fabricColor: string;
  fabricConsumptionMeters?: number;
  fabricBuyPriceAtOrder?: number;
  garmentCount?: number;
  initialPaymentMethod?: PaymentMethod;
  materialUsages?: OrderMaterialUsageInput[] | OrderMaterialUsage[];
  materialCost?: number;
  profit?: number;
  orderDate: string; // YYYY-MM-DD
  deliveryDate: string; // YYYY-MM-DD
  status: OrderStatus;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  isCustomMeasurement: boolean;
  measurements: CustomerMeasurements;
  styleDetails: CustomerStyleDetails;
  notes?: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  orderId: string;
  amount: number;
  paymentDate: string;
  method: 'cash' | 'card' | 'transfer';
  note?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  orderDate: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  payments: PaymentRecord[];
}

export interface FabricItem {
  id: string;
  name: string;
  color: string;
  colorHex?: string;
  purchasePrice: number;
  sellingPrice: number;
  quantityMeters: number;
  minStockMeters: number;
}

export interface AccessoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  minStock: number;
  unit: string;
  purchasePrice?: number;
  sellingPrice?: number;
}

export interface ThobeType {
  id: string;
  name: string;
  defaultPrice: number;
  description?: string;
  icon?: string;
}

export interface ColorItem {
  id: string;
  name: string;
  hex: string;
}

export interface NotificationItem {
  id: string;
  type: 'stock' | 'whatsapp';
  title: string;
  message: string;
  date: string;
  read: boolean;
  customerPhone?: string;
  orderId?: string;
}

export interface AppData {
  customers: Customer[];
  orders: Order[];
  invoices: Invoice[];
  fabrics: FabricItem[];
  accessories: AccessoryItem[];
  thobeTypes: ThobeType[];
  colors: ColorItem[];
  notifications: NotificationItem[];
  stockMovements?: StockMovement[];
  purchases?: PurchaseRecord[];
  expenses?: ExpenseRecord[];
  cashTransactions?: CashTransaction[];
  orderMaterialUsages?: OrderMaterialUsage[];
  orderEvents?: OrderEvent[];
}

export interface UserPreferences {
  activeTab: string;
  invoicePrintMode: 'detailed' | 'summary';
  shopName?: string;
  managerName?: string;
  shopLogoUrl?: string;
  shopPhone?: string;
  vatNumber?: string;
  shopAddress?: string;
}

declare global {
  interface Window {
    electronAPI: {
      getData: () => Promise<AppData>;
      saveData: (data: AppData) => Promise<boolean>;
      exportBackup: () => Promise<string>;
      importBackup: (jsonContent: string) => Promise<{ success: boolean; error?: string }>;
      getPreferences: () => Promise<UserPreferences>;
      savePreferences: (prefs: Partial<UserPreferences>) => Promise<boolean>;
      clearAllData: () => Promise<boolean>;
      sendWhatsAppNotice: (phone: string, customerName: string, orderNumber: string, statusText: string) => Promise<boolean>;
      printDocument: () => void;
      
      db?: {
        transaction: <T>(action: (draft: AppData) => Promise<T> | T) => Promise<{ result: T; updatedData: AppData; alertMessages: string[] }>;
      };

      // IPC Methods
      getCustomers?: () => Promise<Customer[]>;
      createCustomer?: (customer: Partial<Customer>) => Promise<Customer>;
      updateCustomer?: (customer: Customer) => Promise<boolean>;
      deleteCustomer?: (id: string) => Promise<boolean>;
      saveCustomerMeasurementHistory?: (id: string, note: string) => Promise<any>;

      getFabrics?: () => Promise<FabricItem[]>;
      createFabric?: (fabric: Partial<FabricItem>) => Promise<FabricItem>;
      updateFabric?: (fabric: FabricItem) => Promise<boolean>;
      deleteFabric?: (id: string) => Promise<boolean>;

      getAccessories?: () => Promise<AccessoryItem[]>;
      createAccessory?: (acc: Partial<AccessoryItem>) => Promise<AccessoryItem>;
      updateAccessory?: (acc: AccessoryItem) => Promise<boolean>;
      deleteAccessory?: (id: string) => Promise<boolean>;

      getThobeTypes?: () => Promise<ThobeType[]>;
      createThobeType?: (type: Partial<ThobeType>) => Promise<ThobeType>;
      updateThobeType?: (type: ThobeType) => Promise<boolean>;
      deleteThobeType?: (id: string) => Promise<boolean>;
      getColors?: () => Promise<ColorItem[]>;
      createColor?: (color: Partial<ColorItem>) => Promise<ColorItem>;
      updateColor?: (color: ColorItem) => Promise<boolean>;
      deleteColor?: (id: string) => Promise<boolean>;

      getOrders?: () => Promise<Order[]>;
      createOrder?: (order: Partial<Order>) => Promise<Order>;
      updateOrder?: (order: Order) => Promise<boolean>;
      deleteOrder?: (id: string) => Promise<boolean>;
      updateOrderStatus?: (id: string, status: string) => Promise<boolean>;
      getOrderEvents?: (orderId?: string) => Promise<OrderEvent[]>;

      getInvoices?: () => Promise<Invoice[]>;
            addPayment?: (invoiceId: string, amount: number, method: string, note: string, paymentId?: string) => Promise<boolean>;
      getStockMovements?: (itemType?: InventoryItemType, itemId?: string) => Promise<StockMovement[]>;
      adjustStock?: (itemType: InventoryItemType, itemId: string, quantity: number, reason: string, direction: 'adjustment' | 'return') => Promise<StockMovement>;
      getPurchases?: () => Promise<PurchaseRecord[]>;
      createPurchase?: (purchase: { id?: string; supplier: string; invoiceNumber?: string; purchaseDate: string; paymentMethod: PaymentMethod; notes?: string; lines: Array<Omit<PurchaseLine, 'id' | 'purchaseId' | 'createdAt' | 'totalAmount'>> }) => Promise<PurchaseRecord>;
      getExpenses?: () => Promise<ExpenseRecord[]>;
      createExpense?: (expense: { id?: string; category: string; amount: number; expenseDate: string; paymentMethod: PaymentMethod; description: string; notes?: string }) => Promise<ExpenseRecord>;
      getCashTransactions?: () => Promise<CashTransaction[]>;
      createCashAdjustment?: (transaction: Omit<CashTransaction, 'id' | 'createdAt'>) => Promise<CashTransaction>;
      getOrderMaterialUsages?: (orderId?: string) => Promise<OrderMaterialUsage[]>;
      
      exportExcelReport?: (startDate?: string, endDate?: string) => Promise<string>;
      getSettings?: () => Promise<any>;
      updateSetting?: (key: string, value: any) => Promise<boolean>;
    };
  }
}
