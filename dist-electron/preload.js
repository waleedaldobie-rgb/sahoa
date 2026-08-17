var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/electron/preload.ts
var preload_exports = {};
__export(preload_exports, {
  electronBridge: () => electronBridge
});
module.exports = __toCommonJS(preload_exports);
var import_electron = require("electron");
var electronBridge = {
  // Compatibility data facade used by the existing React state layer.
  getData: () => import_electron.ipcRenderer.invoke("data:get"),
  saveData: (data) => import_electron.ipcRenderer.invoke("data:save", data),
  getPreferences: () => import_electron.ipcRenderer.invoke("preferences:get"),
  savePreferences: (preferences) => import_electron.ipcRenderer.invoke("preferences:save", preferences),
  // Customers
  getCustomers: () => import_electron.ipcRenderer.invoke("customers:list"),
  createCustomer: (customer) => import_electron.ipcRenderer.invoke("customers:create", customer),
  updateCustomer: (customer) => import_electron.ipcRenderer.invoke("customers:update", customer),
  deleteCustomer: (id) => import_electron.ipcRenderer.invoke("customers:delete", id),
  saveCustomerMeasurementHistory: (id, note) => import_electron.ipcRenderer.invoke("customers:saveMeasurementHistory", id, note),
  // Fabrics & Accessories
  getFabrics: () => import_electron.ipcRenderer.invoke("fabrics:list"),
  createFabric: (fabric) => import_electron.ipcRenderer.invoke("fabrics:create", fabric),
  updateFabric: (fabric) => import_electron.ipcRenderer.invoke("fabrics:update", fabric),
  deleteFabric: (id) => import_electron.ipcRenderer.invoke("fabrics:delete", id),
  getAccessories: () => import_electron.ipcRenderer.invoke("accessories:list"),
  createAccessory: (acc) => import_electron.ipcRenderer.invoke("accessories:create", acc),
  updateAccessory: (acc) => import_electron.ipcRenderer.invoke("accessories:update", acc),
  deleteAccessory: (id) => import_electron.ipcRenderer.invoke("accessories:delete", id),
  // Thobe Types & Colors
  getThobeTypes: () => import_electron.ipcRenderer.invoke("thobeTypes:list"),
  createThobeType: (type) => import_electron.ipcRenderer.invoke("thobeTypes:create", type),
  updateThobeType: (type) => import_electron.ipcRenderer.invoke("thobeTypes:update", type),
  deleteThobeType: (id) => import_electron.ipcRenderer.invoke("thobeTypes:delete", id),
  getColors: () => import_electron.ipcRenderer.invoke("colors:list"),
  createColor: (color) => import_electron.ipcRenderer.invoke("colors:create", color),
  updateColor: (color) => import_electron.ipcRenderer.invoke("colors:update", color),
  deleteColor: (id) => import_electron.ipcRenderer.invoke("colors:delete", id),
  // Orders
  getOrders: () => import_electron.ipcRenderer.invoke("orders:list"),
  createOrder: (order) => import_electron.ipcRenderer.invoke("orders:create", order),
  updateOrder: (order) => import_electron.ipcRenderer.invoke("orders:update", order),
  deleteOrder: (id) => import_electron.ipcRenderer.invoke("orders:delete", id),
  updateOrderStatus: (id, status) => import_electron.ipcRenderer.invoke("orders:updateStatus", id, status),
  getOrderEvents: (orderId) => import_electron.ipcRenderer.invoke("orders:events:list", orderId),
  // Invoices & Payments
  getInvoices: () => import_electron.ipcRenderer.invoke("invoices:list"),
  addPayment: (invoiceId, amount, method, note, paymentId) => import_electron.ipcRenderer.invoke("invoices:addPayment", invoiceId, amount, method, note, paymentId),
  // Inventory movements, purchases, expenses & cash ledger
  getStockMovements: (itemType, itemId) => import_electron.ipcRenderer.invoke("stockMovements:list", itemType, itemId),
  adjustStock: (itemType, itemId, quantity, reason, direction = "adjustment") => import_electron.ipcRenderer.invoke("stock:adjust", itemType, itemId, quantity, reason, direction),
  getPurchases: () => import_electron.ipcRenderer.invoke("purchases:list"),
  createPurchase: (purchase) => import_electron.ipcRenderer.invoke("purchases:create", purchase),
  getExpenses: () => import_electron.ipcRenderer.invoke("expenses:list"),
  createExpense: (expense) => import_electron.ipcRenderer.invoke("expenses:create", expense),
  getCashTransactions: () => import_electron.ipcRenderer.invoke("cash:list"),
  createCashAdjustment: (transaction) => import_electron.ipcRenderer.invoke("cash:createAdjustment", transaction),
  getOrderMaterialUsages: (orderId) => import_electron.ipcRenderer.invoke("orderMaterials:list", orderId),
  // System & Excel Reports
  exportBackup: () => import_electron.ipcRenderer.invoke("system:backup"),
  importBackup: (jsonContent) => import_electron.ipcRenderer.invoke("system:restore", jsonContent),
  clearAllData: () => import_electron.ipcRenderer.invoke("system:clearAllData"),
  exportExcelReport: (startDate, endDate) => import_electron.ipcRenderer.invoke("reports:exportExcel", startDate, endDate),
  getSettings: () => import_electron.ipcRenderer.invoke("settings:get"),
  updateSetting: (key, value) => import_electron.ipcRenderer.invoke("settings:update", key, value),
  sendWhatsAppNotice: (phone, customerName, orderNumber, statusText) => import_electron.ipcRenderer.invoke("whatsapp:send", phone, customerName, orderNumber, statusText),
  printDocument: () => window.print()
};
import_electron.contextBridge.exposeInMainWorld("electronAPI", electronBridge);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  electronBridge
});
//# sourceMappingURL=preload.js.map
