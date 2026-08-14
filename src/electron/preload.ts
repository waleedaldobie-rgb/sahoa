import { contextBridge, ipcRenderer } from 'electron';
import {
  Customer,
  Order,
  FabricItem,
  AccessoryItem,
  ThobeType,
  ColorItem,
  InventoryItemType
} from '../types';

export const electronBridge = {
  // Customers
  getCustomers: () => ipcRenderer.invoke('customers:list'),
  createCustomer: (customer: Partial<Customer>) => ipcRenderer.invoke('customers:create', customer),
  updateCustomer: (customer: Customer) => ipcRenderer.invoke('customers:update', customer),
  deleteCustomer: (id: string) => ipcRenderer.invoke('customers:delete', id),
  saveCustomerMeasurementHistory: (id: string, note: string) => ipcRenderer.invoke('customers:saveMeasurementHistory', id, note),

  // Fabrics & Accessories
  getFabrics: () => ipcRenderer.invoke('fabrics:list'),
  createFabric: (fabric: Partial<FabricItem>) => ipcRenderer.invoke('fabrics:create', fabric),
  updateFabric: (fabric: FabricItem) => ipcRenderer.invoke('fabrics:update', fabric),
  deleteFabric: (id: string) => ipcRenderer.invoke('fabrics:delete', id),

  getAccessories: () => ipcRenderer.invoke('accessories:list'),
  createAccessory: (acc: Partial<AccessoryItem>) => ipcRenderer.invoke('accessories:create', acc),
  updateAccessory: (acc: AccessoryItem) => ipcRenderer.invoke('accessories:update', acc),
  deleteAccessory: (id: string) => ipcRenderer.invoke('accessories:delete', id),


  // Thobe Types & Colors
  getThobeTypes: () => ipcRenderer.invoke('thobeTypes:list'),
  createThobeType: (type: Partial<ThobeType>) => ipcRenderer.invoke('thobeTypes:create', type),
  updateThobeType: (type: ThobeType) => ipcRenderer.invoke('thobeTypes:update', type),
  getColors: () => ipcRenderer.invoke('colors:list'),
  createColor: (color: Partial<ColorItem>) => ipcRenderer.invoke('colors:create', color),
  updateColor: (color: ColorItem) => ipcRenderer.invoke('colors:update', color),

  // Orders
  getOrders: () => ipcRenderer.invoke('orders:list'),
  createOrder: (order: Partial<Order>) => ipcRenderer.invoke('orders:create', order),
  updateOrder: (order: Order) => ipcRenderer.invoke('orders:update', order),
  deleteOrder: (id: string) => ipcRenderer.invoke('orders:delete', id),
  updateOrderStatus: (id: string, status: string) => ipcRenderer.invoke('orders:updateStatus', id, status),

  // Invoices & Payments
  getInvoices: () => ipcRenderer.invoke('invoices:list'),
  addPayment: (invoiceId: string, amount: number, method: string, note: string, paymentId?: string) =>
    ipcRenderer.invoke('invoices:addPayment', invoiceId, amount, method, note, paymentId),

  // Inventory movements, purchases, expenses & cash ledger
  getStockMovements: (itemType?: InventoryItemType, itemId?: string) => ipcRenderer.invoke('stockMovements:list', itemType, itemId),
  adjustStock: (itemType: InventoryItemType, itemId: string, quantity: number, reason: string, direction: 'adjustment' | 'return' = 'adjustment') =>
    ipcRenderer.invoke('stock:adjust', itemType, itemId, quantity, reason, direction),
  getPurchases: () => ipcRenderer.invoke('purchases:list'),
  createPurchase: (purchase: any) => ipcRenderer.invoke('purchases:create', purchase),
  getExpenses: () => ipcRenderer.invoke('expenses:list'),
  createExpense: (expense: any) => ipcRenderer.invoke('expenses:create', expense),
  getCashTransactions: () => ipcRenderer.invoke('cash:list'),
  createCashAdjustment: (transaction: any) => ipcRenderer.invoke('cash:createAdjustment', transaction),
  getOrderMaterialUsages: (orderId?: string) => ipcRenderer.invoke('orderMaterials:list', orderId),

  // System & Excel Reports
  exportBackup: () => ipcRenderer.invoke('system:backup'),
  importBackup: (jsonContent: string) => ipcRenderer.invoke('system:restore', jsonContent),
  exportExcelReport: (startDate?: string, endDate?: string) => ipcRenderer.invoke('reports:exportExcel', startDate, endDate),
  
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSetting: (key: string, value: any) => ipcRenderer.invoke('settings:update', key, value),

  sendWhatsAppNotice: (phone: string, customerName: string, orderNumber: string, statusText: string) =>
    ipcRenderer.invoke('whatsapp:send', phone, customerName, orderNumber, statusText),

  printDocument: () => window.print()
};

contextBridge.exposeInMainWorld('electronAPI', electronBridge);
