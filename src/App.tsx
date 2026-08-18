import React, { Suspense, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AppData, UserPreferences, Customer, Order, Invoice, FabricItem, AccessoryItem, ThobeType, ColorItem, PaymentRecord, OrderStatus, InventoryItemType, MeasurementHistoryRecord } from './types';
import { initElectronMock } from './services/electronMock';
import { formatIpcErrorMessage } from './utils/ipcError';
import { checkAndSyncStockAlerts } from './utils/stockAlerts';
import { VALIDATION_SCHEMAS, validateEntity, validateEntityErrors } from './domain/validation';
import { ALL_DATA_SLICES, DataSliceName, INITIAL_DATA_REVISION, bumpDataRevision, mergeDataSlices } from './state/appDataStore';

export { VALIDATION_SCHEMAS, validateEntity, validateEntityErrors } from './domain/validation';

// Layout & UI Components
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Toast, ToastState, LoadingSpinner } from './components/ui';
import { ornamentPatternSoft } from './components/Ornaments';

// Modals
import { BackupModal } from './components/BackupModal';
import { NotificationsModal } from './components/NotificationsModal';
import { AppErrorBoundary } from './components/AppErrorBoundary';

// Views — code-split to keep the initial bundle small
const DashboardView = React.lazy(() => import('./components/DashboardView').then((m) => ({ default: m.DashboardView })));
const CustomersView = React.lazy(() => import('./components/CustomersView').then((m) => ({ default: m.CustomersView })));
const OrdersView = React.lazy(() => import('./components/OrdersView').then((m) => ({ default: m.OrdersView })));
const InvoicesView = React.lazy(() => import('./components/InvoicesView').then((m) => ({ default: m.InvoicesView })));
const InventoryView = React.lazy(() => import('./components/InventoryView').then((m) => ({ default: m.InventoryView })));
const ReportsView = React.lazy(() => import('./components/ReportsView').then((m) => ({ default: m.ReportsView })));
const AccountingView = React.lazy(() => import('./components/AccountingView').then((m) => ({ default: m.AccountingView })));
const SettingsView = React.lazy(() => import('./components/SettingsView').then((m) => ({ default: m.SettingsView })));

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences>({ activeTab: 'dashboard', invoicePrintMode: 'detailed' });
  const [isLoading, setIsLoading] = useState(true);
  const [dataRevision, setDataRevision] = useState(INITIAL_DATA_REVISION);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [isDashboardRefreshing, setIsDashboardRefreshing] = useState(false);

  // CRUD Loading State for background operations
  const [crudProgress, setCrudProgress] = useState<{ isExecuting: boolean; label: string }>({
    isExecuting: false,
    label: ''
  });

  // Modals state
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);

  // Selected order for quick navigation
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<Order | null>(null);
  const [triggerNewOrderModal, setTriggerNewOrderModal] = useState(false);
  const [customerForNewOrder, setCustomerForNewOrder] = useState<Customer | null>(null);
  const [measurementForNewOrder, setMeasurementForNewOrder] = useState<MeasurementHistoryRecord | null>(null);

  // Toast notification
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'info' });
  const undoTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadInFlightRef = React.useRef<Promise<string[]> | null>(null);

  const showToast = (
    message: string,
    type: ToastState['type'] = 'info',
    action?: { label: string; onClick: () => void }
  ) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setToast({
      show: true,
      message,
      type,
      actionLabel: action?.label,
      onAction: action?.onClick,
    });
    undoTimerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false, actionLabel: undefined, onAction: undefined }));
    }, action ? 5000 : 4000);
  };

  // Helper to execute CRUD operations with a dedicated Loading Spinner
  const executeCrud = async <T,>(label: string, action: () => Promise<T>): Promise<T | undefined> => {
    setCrudProgress({ isExecuting: true, label });
    try {
      const result = await action();
      return result;
    } catch (err: any) {
      showToast(formatIpcErrorMessage(err), 'danger');
      return undefined;
    } finally {
      setCrudProgress({ isExecuting: false, label: '' });
    }
  };

  // Load Data on Mount
  const loadAppData = async (): Promise<string[]> => {
    if (loadInFlightRef.current) return loadInFlightRef.current;

    const request = (async () => {
      setIsLoading(true);
      initElectronMock();
      const [appData, appPrefs] = await Promise.all([
        window.electronAPI.getData(),
        window.electronAPI.getPreferences()
      ]);

      const { updatedData, alertMessages } = checkAndSyncStockAlerts(appData);
      if (updatedData !== appData) {
        await window.electronAPI.saveData(updatedData);
      }

      setData(updatedData);
      setDataRevision((current) => bumpDataRevision(current, ALL_DATA_SLICES));
      setLastUpdatedAt(Date.now());
      setPrefs(appPrefs);
      setIsLoading(false);
      return alertMessages;
    })();

    loadInFlightRef.current = request;
    try {
      return await request;
    } finally {
      if (loadInFlightRef.current === request) loadInFlightRef.current = null;
    }
  };

  useEffect(() => {
    void loadAppData();
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
    };
  }, []);

  const refreshSlices = async (slices: readonly DataSliceName[]): Promise<string[]> => {
    if (!data) return [];
    const patch: Partial<AppData> = {};
    await Promise.all(slices.map(async (slice) => {
      switch (slice) {
        case 'customers':
          if (window.electronAPI.getCustomers) patch.customers = await window.electronAPI.getCustomers();
          break;
        case 'orders':
          if (window.electronAPI.getOrders) patch.orders = await window.electronAPI.getOrders();
          break;
        case 'invoices':
          if (window.electronAPI.getInvoices) patch.invoices = await window.electronAPI.getInvoices();
          break;
        case 'fabrics':
          if (window.electronAPI.getFabrics) patch.fabrics = await window.electronAPI.getFabrics();
          break;
        case 'accessories':
          if (window.electronAPI.getAccessories) patch.accessories = await window.electronAPI.getAccessories();
          break;
        case 'purchases':
          if (window.electronAPI.getPurchases) patch.purchases = await window.electronAPI.getPurchases();
          break;
        case 'expenses':
          if (window.electronAPI.getExpenses) patch.expenses = await window.electronAPI.getExpenses();
          break;
        case 'cashTransactions':
          if (window.electronAPI.getCashTransactions) patch.cashTransactions = await window.electronAPI.getCashTransactions();
          break;
        case 'stockMovements':
          if (window.electronAPI.getStockMovements) patch.stockMovements = await window.electronAPI.getStockMovements();
          break;
        case 'orderMaterialUsages':
          if (window.electronAPI.getOrderMaterialUsages) patch.orderMaterialUsages = await window.electronAPI.getOrderMaterialUsages();
          break;
        case 'orderEvents':
          if (window.electronAPI.getOrderEvents) patch.orderEvents = await window.electronAPI.getOrderEvents();
          break;
        case 'notifications': {
          const snapshot = await window.electronAPI.getData();
          patch.notifications = snapshot.notifications;
          break;
        }
      }
    }));

    const mergedData = mergeDataSlices(data, patch);
    const { updatedData, alertMessages } = checkAndSyncStockAlerts(mergedData);
    if (updatedData !== mergedData) await window.electronAPI.saveData(updatedData);
    setData(updatedData);
    setDataRevision((current) => bumpDataRevision(current, slices));
    setLastUpdatedAt(Date.now());
    return alertMessages;
  };

  // Save Data Helper
  const persistData = async (updatedData: AppData): Promise<string[]> => {
    const { updatedData: syncedData, alertMessages } = checkAndSyncStockAlerts(updatedData);
    setData(syncedData);
    setDataRevision((current) => bumpDataRevision(current, ALL_DATA_SLICES));
    await window.electronAPI.saveData(syncedData);
    return alertMessages;
  };

  // Navigation Handler
  const handleTabChange = React.useCallback((tabId: string) => {
    setPrefs((prev) => ({ ...prev, activeTab: tabId }));
    void window.electronAPI.savePreferences({ activeTab: tabId });
    setSelectedOrderForDetail(null);
    setTriggerNewOrderModal(false);
    setCustomerForNewOrder(null);
    setMeasurementForNewOrder(null);
  }, []);

  const handleUseMeasurementForOrder = (customer: Customer, snapshot: MeasurementHistoryRecord | null) => {
    setCustomerForNewOrder(customer);
    setMeasurementForNewOrder(snapshot);
    setSelectedOrderForDetail(null);
    setPrefs((prev) => ({ ...prev, activeTab: 'orders' }));
    void window.electronAPI.savePreferences({ activeTab: 'orders' });
    setTriggerNewOrderModal(true);
    window.setTimeout(() => {
      setTriggerNewOrderModal(false);
      setCustomerForNewOrder(null);
      setMeasurementForNewOrder(null);
    }, 0);
    showToast(snapshot ? 'تم تجهيز الطلب بالمقاس التاريخي المختار فقط' : 'تم تجهيز الطلب بآخر مقاس محفوظ فقط', 'info');
  };

  // Update Invoice Mode
  const handleUpdateInvoiceMode = React.useCallback((mode: 'detailed' | 'summary') => {
    setPrefs((prev) => ({ ...prev, invoicePrintMode: mode }));
    void window.electronAPI.savePreferences({ invoicePrintMode: mode });
  }, []);

  // Save Shop Settings
  const handleSaveShopSettings = React.useCallback(async (shopPrefs: Partial<UserPreferences>) => {
    const saved = await window.electronAPI.savePreferences(shopPrefs);
    if (saved === false) throw new Error('تعذر حفظ إعدادات المحل');
    setPrefs((prev) => ({ ...prev, ...shopPrefs }));
  }, []);

  const handleRefreshDashboard = React.useCallback(async () => {
    setIsDashboardRefreshing(true);
    try {
      await refreshSlices(['orders', 'invoices', 'fabrics', 'accessories', 'notifications']);
    } finally {
      setIsDashboardRefreshing(false);
    }
  }, [data]);

  const handleOpenBackupModal = React.useCallback(() => setIsBackupModalOpen(true), []);
  const handleOpenNotifications = React.useCallback(() => setIsNotificationsModalOpen(true), []);
  const handlePrintScreen = React.useCallback(() => window.print(), []);
  const handleCloseToast = React.useCallback(() => setToast((prev) => ({ ...prev, show: false })), []);

  
  // Temporary undo support for destructive actions.
  // The snapshot is restored only if the database is still exactly in the
  // post-delete state, preventing an undo from overwriting newer changes.
  // NOTE: uses importBackup (the same primitive backing the Backup/Restore
  // feature) rather than saveData, because saveData only ever writes to
  // localStorage and is not connected to the real SQLite database when the
  // app is running as a real Electron build — importBackup correctly
  // delegates to the SQLite restore transaction in that case.
  const offerDeleteUndo = (before: AppData, message: string) => {
    const deletedSnapshot = JSON.parse(JSON.stringify(before)) as AppData;
    window.electronAPI.getData().then((afterDelete) => {
      showToast(message, 'success', {
        label: 'تراجع',
        onClick: async () => {
          try {
            const current = await window.electronAPI.getData();
            if (JSON.stringify(current) !== JSON.stringify(afterDelete)) {
              showToast('لا يمكن التراجع لأن بيانات أخرى تغيّرت بعد الحذف', 'warning');
              return;
            }
            const restoreResult = await window.electronAPI.importBackup(JSON.stringify(deletedSnapshot));
            if (restoreResult && restoreResult.success === false) {
              showToast(restoreResult.error || 'تعذر التراجع عن الحذف', 'danger');
              return;
            }
            await loadAppData();
            showToast('تم التراجع عن الحذف بنجاح', 'success');
          } catch (err: any) {
            showToast(formatIpcErrorMessage(err), 'danger');
          }
        }
      });
    });
  };

// DATA UPDATERS
  // 1. Customers
  const handleSaveCustomer = async (customer: Customer) => {
    const err = validateEntity('customer', customer);
    if (err) {
      showToast(err, 'danger');
      return;
    }

    await executeCrud('جاري حفظ بيانات العميل...', async () => {
      if (window.electronAPI.createCustomer && window.electronAPI.updateCustomer) {
        const exists = data?.customers.some((c) => c.id === customer.id);
        if (exists) {
          await window.electronAPI.updateCustomer(customer);
        } else {
          await window.electronAPI.createCustomer(customer);
        }
        await loadAppData();
        showToast('تم حفظ بيانات العميل بنجاح', 'success');
      } else {
        if (!data) return;
        const exists = data.customers.some((c) => c.id === customer.id);
        const updatedCustomers = exists
          ? data.customers.map((c) => (c.id === customer.id ? customer : c))
          : [customer, ...data.customers];
        await persistData({ ...data, customers: updatedCustomers });
        showToast('تم حفظ بيانات العميل بنجاح', 'success');
      }
    });
  };

  const handleDeleteCustomer = async (customerId: string) => {
    const beforeDelete = data ? JSON.parse(JSON.stringify(data)) as AppData : null;
    await executeCrud('جاري حذف العميل...', async () => {
      if (window.electronAPI.deleteCustomer) {
        await window.electronAPI.deleteCustomer(customerId);
        await loadAppData();
        if (beforeDelete) offerDeleteUndo(beforeDelete, 'تم حذف العميل');
      } else {
        if (!data) return;
        const hasOrders = data.orders.some((o) => o.customerId === customerId);
        if (hasOrders) {
          throw new Error('لا يمكن حذف هذا الصنف لارتباطه بطلبات موجودة');
        }
        const updatedCustomers = data.customers.filter((c) => c.id !== customerId);
        await persistData({ ...data, customers: updatedCustomers });
        offerDeleteUndo(beforeDelete || data, 'تم حذف العميل');
      }
    });
  };

  // 2. Orders
  const handleSaveOrder = async (order: Order) => {
    const validationErrors = validateEntityErrors('order', order);
    if (validationErrors.length > 0) {
      showToast(validationErrors.join('\n'), 'danger');
      return;
    }

    await executeCrud('جاري حفظ بيانات الطلب واستقطاع الأقمشة...', async () => {
      let alerts: string[] = [];
      if (window.electronAPI.createOrder && window.electronAPI.updateOrder) {
        const exists = data?.orders.some((o) => o.id === order.id);
        if (exists) {
          await window.electronAPI.updateOrder(order);
        } else {
          await window.electronAPI.createOrder(order);
        }
        alerts = await loadAppData();
      } else {
        if (!data) return;
        const exists = data.orders.some((o) => o.id === order.id);
        const updatedOrders = exists
          ? data.orders.map((o) => (o.id === order.id ? order : o))
          : [order, ...data.orders];

        // Automatically create or update corresponding invoice
        const invId = 'INV-' + order.orderNumber;
        const existingInvoice = data.invoices.find((i) => i.id === invId || i.orderId === order.id);

        const newInvoice: Invoice = {
          id: existingInvoice ? existingInvoice.id : invId,
          invoiceNumber: existingInvoice ? existingInvoice.invoiceNumber : invId,
          orderId: order.id,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          orderDate: order.orderDate,
          totalAmount: order.totalAmount,
          paidAmount: order.paidAmount,
          remainingAmount: order.remainingAmount,
          paymentStatus: order.remainingAmount === 0 ? 'paid' : order.paidAmount > 0 ? 'partial' : 'unpaid',
          payments: existingInvoice
            ? existingInvoice.payments
            : (order.paidAmount > 0
                ? [
                    {
                      id: 'PAY-' + Date.now(),
                      invoiceId: invId,
                      orderId: order.id,
                      amount: order.paidAmount,
                      paymentDate: order.orderDate,
                      method: 'cash',
                      note: 'دفعة أولى عند حجز الطلب'
                    }
                  ]
                : [])
        };

        const invoiceExists = data.invoices.some((i) => i.id === newInvoice.id);
        const updatedInvoices = invoiceExists
          ? data.invoices.map((i) => (i.id === newInvoice.id ? newInvoice : i))
          : [newInvoice, ...data.invoices];

        alerts = await persistData({ ...data, orders: updatedOrders, invoices: updatedInvoices });
      }

      if (alerts && alerts.length > 0) {
        showToast(`تم حفظ الطلب واستقطاع القماش. ⚠️ ${alerts[0]}`, 'warning');
      } else {
        showToast('تم حفظ الطلب بنجاح وخصم القماش من المخزون', 'success');
      }
    });
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    await executeCrud('جاري تحديث حالة الطلب...', async () => {
      if (window.electronAPI.updateOrderStatus) {
        await window.electronAPI.updateOrderStatus(orderId, newStatus);
        await loadAppData();
        showToast('تم تحديث حالة الطلب بنجاح', 'success');
      } else {
        if (!data) return;
        const updatedOrders = data.orders.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o));
        await persistData({ ...data, orders: updatedOrders });
        showToast('تم تحديث حالة الطلب بنجاح', 'success');
      }
    });
  };

  const handleDeleteOrder = async (orderId: string) => {
    const beforeDelete = data ? JSON.parse(JSON.stringify(data)) as AppData : null;
    await executeCrud('جاري حذف الطلب وإرجاع كمية القماش للمخزون...', async () => {
      if (window.electronAPI.deleteOrder) {
        await window.electronAPI.deleteOrder(orderId);
        await loadAppData();
        if (beforeDelete) offerDeleteUndo(beforeDelete, 'تم حذف الطلب وإرجاع القماش');
      } else {
        if (!data) return;
        const targetOrder = data.orders.find((o) => o.id === orderId);
        if (!targetOrder) throw new Error('الطلب غير موجود');

        const updatedFabrics = data.fabrics.map((f) => {
          if (f.id === targetOrder.fabricId && targetOrder.status !== 'cancelled') {
            return {
              ...f,
              quantityMeters: Number(
                (f.quantityMeters + (targetOrder.fabricConsumptionMeters || 0)).toFixed(2)
              )
            };
          }
          return f;
        });

        const updatedOrders = data.orders.filter((o) => o.id !== orderId);
        const updatedInvoices = data.invoices.filter((i) => i.orderId !== orderId);

        const alerts = await persistData({
          ...data,
          fabrics: updatedFabrics,
          orders: updatedOrders,
          invoices: updatedInvoices
        });

        if (alerts && alerts.length > 0) {
          showToast(`تم حذف الطلب وإرجاع القماش. ⚠️ ${alerts[0]}`, 'warning');
        } else {
          showToast('تم حذف الطلب وإرجاع كمية القماش للمخزون بنجاح', 'success');
        }
      }
    });
  };

  // 3. Invoices & Payments
  const handleAddPayment = async (invoiceId: string, payment: PaymentRecord) => {
    const targetInvoice = data?.invoices.find((i) => i.id === invoiceId);
    const err = validateEntity('payment', payment, { targetInvoice });
    if (err) {
      showToast(err, 'danger');
      return;
    }

    await executeCrud('جاري تسجيل الدفعة المالية...', async () => {
      if (window.electronAPI.addPayment) {
        await window.electronAPI.addPayment(invoiceId, payment.amount, payment.method, payment.note || '', payment.id);
        await refreshSlices(['orders', 'invoices', 'cashTransactions', 'orderEvents']);
        showToast('تم إضافة الدفعة بنجاح', 'success');
      } else {
        if (!data) return;
        const updatedInvoices = data.invoices.map((inv) => {
          if (inv.id !== invoiceId) return inv;

          const newPaidAmount = inv.paidAmount + payment.amount;
          const newRemainingAmount = Math.max(0, inv.totalAmount - newPaidAmount);
          const newStatus = newRemainingAmount === 0 ? 'paid' : 'partial';

          return {
            ...inv,
            paidAmount: newPaidAmount,
            remainingAmount: newRemainingAmount,
            paymentStatus: newStatus as any,
            payments: [...inv.payments, payment]
          };
        });

        // Also update order paid/remaining amount
        let updatedOrders = data.orders;
        if (targetInvoice) {
          updatedOrders = data.orders.map((ord) => {
            if (ord.id !== targetInvoice.orderId) return ord;
            const newPaid = ord.paidAmount + payment.amount;
            const newRemaining = Math.max(0, ord.totalAmount - newPaid);
            return { ...ord, paidAmount: newPaid, remainingAmount: newRemaining };
          });
        }

        await persistData({ ...data, invoices: updatedInvoices, orders: updatedOrders });
        showToast('تم إضافة الدفعة بنجاح', 'success');
      }
    });
  };

  // 4. Purchases, Expenses & Cash Ledger
  const handleCreatePurchase = async (payload: any) => {
    await executeCrud('جاري اعتماد المشتريات وتحديث المخزون والصندوق...', async () => {
      if (!window.electronAPI.createPurchase) throw new Error('وظيفة المشتريات غير متاحة في هذه النسخة');
      await window.electronAPI.createPurchase(payload);
      await refreshSlices(['purchases', 'stockMovements', 'cashTransactions', 'fabrics', 'accessories', 'notifications']);
      showToast('تم اعتماد المشتريات وتحديث المخزون والصندوق بنجاح', 'success');
    });
  };

  const handleCreateExpense = async (payload: any) => {
    await executeCrud('جاري تسجيل المصروف...', async () => {
      if (!window.electronAPI.createExpense) throw new Error('وظيفة المصروفات غير متاحة في هذه النسخة');
      await window.electronAPI.createExpense(payload);
      await refreshSlices(['expenses', 'cashTransactions']);
      showToast('تم تسجيل المصروف في الصندوق بنجاح', 'success');
    });
  };

  const handleCreateCashAdjustment = async (payload: any) => {
    await executeCrud('جاري تسجيل الحركة المالية...', async () => {
      if (!window.electronAPI.createCashAdjustment) throw new Error('وظيفة الصندوق غير متاحة في هذه النسخة');
      await window.electronAPI.createCashAdjustment(payload);
      await refreshSlices(['cashTransactions']);
      showToast('تم تسجيل الحركة المالية بنجاح', 'success');
    });
  };

  // 5. Inventory Updaters
  const handleSaveFabric = async (fabric: FabricItem) => {
    const err = validateEntity('fabric', fabric);
    if (err) {
      showToast(err, 'danger');
      return;
    }

    await executeCrud('جاري حفظ بيانات القماش...', async () => {
      let alerts: string[] = [];
      if (window.electronAPI.createFabric && window.electronAPI.updateFabric) {
        const exists = data?.fabrics.some((f) => f.id === fabric.id);
        if (exists) {
          await window.electronAPI.updateFabric(fabric);
        } else {
          await window.electronAPI.createFabric(fabric);
        }
        alerts = await refreshSlices(['fabrics', 'notifications']);
      } else {
        if (!data) return;
        const exists = data.fabrics.some((f) => f.id === fabric.id);
        const updatedFabrics = exists
          ? data.fabrics.map((f) => (f.id === fabric.id ? fabric : f))
          : [fabric, ...data.fabrics];
        alerts = await persistData({ ...data, fabrics: updatedFabrics });
      }

      if (alerts && alerts.length > 0) {
        showToast(`تم حفظ القماش. ⚠️ ${alerts[0]}`, 'warning');
      } else {
        showToast('تم حفظ صنف القماش بنجاح', 'success');
      }
    });
  };

  const handleDeleteFabric = async (id: string) => {
    const beforeDelete = data ? JSON.parse(JSON.stringify(data)) as AppData : null;
await executeCrud('جاري حذف القماش من المخزون...', async () => {
      if (window.electronAPI.deleteFabric) {
        await window.electronAPI.deleteFabric(id);
        await refreshSlices(['fabrics', 'notifications']);
        showToast('تم حذف القماش بنجاح', 'success');
      } else {
        if (!data) return;
        const isUsed = data.orders.some((o) => o.fabricId === id && o.status !== 'cancelled');
        if (isUsed) {
          throw new Error('لا يمكن حذف هذا الصنف لارتباطه بطلبات موجودة');
        }
        await persistData({ ...data, fabrics: data.fabrics.filter((f) => f.id !== id) });
        offerDeleteUndo(beforeDelete || data, 'تم حذف القماش');
      }
    });
  };

  const handleSaveAccessory = async (accessory: AccessoryItem) => {
    const err = validateEntity('accessory', accessory);
    if (err) {
      showToast(err, 'danger');
      return;
    }

    await executeCrud('جاري حفظ صنف الإكسسوار...', async () => {
      let alerts: string[] = [];
      if (window.electronAPI.createAccessory && window.electronAPI.updateAccessory) {
        const exists = data?.accessories.some((a) => a.id === accessory.id);
        if (exists) {
          await window.electronAPI.updateAccessory(accessory);
        } else {
          await window.electronAPI.createAccessory(accessory);
        }
        alerts = await refreshSlices(['accessories', 'notifications']);
      } else {
        if (!data) return;
        const exists = data.accessories.some((a) => a.id === accessory.id);
        const updatedAccessories = exists
          ? data.accessories.map((a) => (a.id === accessory.id ? accessory : a))
          : [accessory, ...data.accessories];
        alerts = await persistData({ ...data, accessories: updatedAccessories });
      }

      if (alerts && alerts.length > 0) {
        showToast(`تم حفظ الإكسسوار. ⚠️ ${alerts[0]}`, 'warning');
      } else {
        showToast('تم حفظ صنف الإكسسوار بنجاح', 'success');
      }
    });
  };

  const handleDeleteAccessory = async (id: string) => {
    const beforeDelete = data ? JSON.parse(JSON.stringify(data)) as AppData : null;
await executeCrud('جاري حذف الإكسسوار...', async () => {
      if (window.electronAPI.deleteAccessory) {
        await window.electronAPI.deleteAccessory(id);
        await refreshSlices(['accessories', 'notifications']);
        showToast('تم حذف الإكسسوار بنجاح', 'success');
      } else {
        if (!data) return;
        await persistData({ ...data, accessories: data.accessories.filter((a) => a.id !== id) });
        offerDeleteUndo(beforeDelete || data, 'تم حذف الإكسسوار');
      }
    });
    };

  const handleAdjustStock = async (itemType: InventoryItemType, itemId: string, quantity: number, reason: string, direction: 'adjustment' | 'return') => {
    await executeCrud('جاري تسجيل تسوية المخزون...', async () => {
      if (!window.electronAPI.adjustStock) throw new Error('وظيفة حركة المخزون غير متاحة في هذه النسخة');
      await window.electronAPI.adjustStock(itemType, itemId, quantity, reason, direction);
      await loadAppData();
    });
  };

  const handleSaveThobeType = async (thobeType: ThobeType) => {
    const err = validateEntity('thobeType', thobeType);
    if (err) {
      showToast(err, 'danger');
      return;
    }

    await executeCrud('جاري حفظ نوع الثوب...', async () => {
      if (!data) return;
      if (window.electronAPI.createThobeType) {
        const exists = data.thobeTypes.some((t) => t.id === thobeType.id);
        if (exists && window.electronAPI.updateThobeType) {
          await window.electronAPI.updateThobeType(thobeType);
        } else {
          await window.electronAPI.createThobeType(thobeType);
        }
        await loadAppData();
      } else {
        const exists = data.thobeTypes.some((t) => t.id === thobeType.id);
        const updated = exists
          ? data.thobeTypes.map((t) => (t.id === thobeType.id ? thobeType : t))
          : [thobeType, ...data.thobeTypes];
        await persistData({ ...data, thobeTypes: updated });
      }
      showToast('تم حفظ نوع الثوب بنجاح', 'success');
    });
  };

  const handleSaveColor = async (color: ColorItem) => {
    const err = validateEntity('color', color);
    if (err) {
      showToast(err, 'danger');
      return;
    }

    await executeCrud('جاري حفظ اللون...', async () => {
      if (!data) return;
      if (window.electronAPI.createColor) {
        const exists = data.colors.some((c) => c.id === color.id);
        if (exists && window.electronAPI.updateColor) {
          await window.electronAPI.updateColor(color);
        } else {
          await window.electronAPI.createColor(color);
        }
        await loadAppData();
      } else {
        const exists = data.colors.some((c) => c.id === color.id);
        const updated = exists
          ? data.colors.map((c) => (c.id === color.id ? color : c))
          : [color, ...data.colors];
        await persistData({ ...data, colors: updated });
      }
      showToast('تم حفظ اللون بنجاح', 'success');
    });
  };

  const handleDeleteThobeType = async (id: string) => {
    await executeCrud('جاري حذف نوع الثوب...', async () => {
      if (!data) return;
      if (window.electronAPI.deleteThobeType) {
        await window.electronAPI.deleteThobeType(id);
        await loadAppData();
      } else {
        await persistData({ ...data, thobeTypes: data.thobeTypes.filter((t) => t.id !== id) });
      }
      showToast('تم حذف نوع الثوب بنجاح', 'success');
    });
  };

  const handleDeleteColor = async (id: string) => {
    await executeCrud('جاري حذف اللون...', async () => {
      if (!data) return;
      if (window.electronAPI.deleteColor) {
        await window.electronAPI.deleteColor(id);
        await loadAppData();
      } else {
        await persistData({ ...data, colors: data.colors.filter((c) => c.id !== id) });
      }
      showToast('تم حذف اللون بنجاح', 'success');
    });
  };

  // WhatsApp Sender
  const handleSendWhatsAppNotice = async (phone: string, name: string, orderNum: string, statusText: string) => {
    await executeCrud('جاري إرسال إشعار الواتساب...', async () => {
      const opened = await window.electronAPI.sendWhatsAppNotice(phone, name, orderNum, statusText);
      if (opened === false) {
        throw new Error('تعذر فتح واتساب. تحقق من اتصال الإنترنت ثم حاول مرة أخرى.');
      }
      showToast(`تم توجيه إشعار واتساب للعميل ${name}`, 'success');
      await loadAppData();
    });
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!data) return;
    await executeCrud('جاري تحديث التنبيهات...', async () => {
      const updated = data.notifications.map((n) => ({ ...n, read: true }));
      await persistData({ ...data, notifications: updated });
    });
  };

  const handleClearNotifications = async () => {
    if (!data) return;
    await executeCrud('جاري مسح التنبيهات...', async () => {
      await persistData({ ...data, notifications: [] });
    });
  };

  const unreadNotifCount = React.useMemo(
    () => data?.notifications.reduce((count, notification) => count + (notification.read ? 0 : 1), 0) ?? 0,
    [data?.notifications]
  );

  const headerInfo = React.useMemo(() => {
    switch (prefs.activeTab) {
      case 'dashboard': return { title: 'لوحة التحكم والمتابعة', description: 'نظرة عامة على الطلبات، التنبيهات، ونواقص المخزون' };
      case 'customers': return { title: 'إدارة العملاء والمقاسات', description: 'سجل كامل لمقاسات وتفاصيل موديلات خياطة كل عميل' };
      case 'orders': return { title: 'إدارة طلبات الخياطة', description: 'متابعة مراحل التنفيذ، التسليم، وطباعة الكروت' };
      case 'invoices': return { title: 'الفواتير وسجل الحسابات', description: 'تسديد الدفعات، متابعة المتبقي، ومعاينة الفواتير' };
      case 'inventory': return { title: 'إدارة المخزون والأصناف', description: 'أصول الأقمشة، الإكسسوارات، موديلات الثياب، والألوان' };
      case 'accounting': return { title: 'المحاسبة والمشتريات والصندوق', description: 'ربط المشتريات والمصروفات والدفعات بالرصيد والتقارير' };
      case 'reports': return { title: 'التقارير والإحصائيات المالية', description: 'متابعة المبيعات، الإيرادات، وتصدير التقارير لـ Excel' };
      case 'settings': return { title: 'إعدادات المحل والطباعة', description: 'بيانات المحل التي تظهر في ترويسة الفواتير وكروت الطباعة' };
      default: return { title: 'صهوة للخياطة', description: 'نظام إدارة الخياطة الرجالية' };
    }
  }, [prefs.activeTab]);

  if (isLoading || !data) {
    return (
      <div className="h-screen bg-[var(--ui-charcoal)] flex items-center justify-center">
        <LoadingSpinner label="جاري تحميل نظام صهوة للخياطة..." />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[var(--ui-ivory)] text-slate-900 flex flex-row dir-rtl font-['Tajawal']">
      {/* Toast Notification Banner */}
      <Toast toast={toast} onClose={handleCloseToast} />

      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={prefs.activeTab}
        onTabChange={handleTabChange}
        onOpenBackupModal={handleOpenBackupModal}
        unreadNotifCount={unreadNotifCount}
        managerName={prefs.managerName}
      />

      {/* Main Content Area */}
      <main
        className="flex-1 flex flex-col min-w-0 overflow-y-auto h-full"
        style={{ backgroundImage: ornamentPatternSoft, backgroundSize: '96px 96px' }}
      >
        <Header
          title={headerInfo.title}
          description={headerInfo.description}
          unreadNotifCount={unreadNotifCount}
          onOpenNotifications={handleOpenNotifications}
          onPrintScreen={handlePrintScreen}
        />

        <div className="p-6">
          <AppErrorBoundary>
            <Suspense fallback={<div className="flex items-center justify-center py-20"><LoadingSpinner label="جاري تحميل الصفحة..." /></div>}>
          {prefs.activeTab === 'dashboard' && (
            <DashboardView
              data={data}
              dataRevision={dataRevision}
              onNavigateTab={handleTabChange}
              onRefreshDashboard={handleRefreshDashboard}
              isRefreshing={isDashboardRefreshing}
              lastUpdatedAt={lastUpdatedAt}
              onSelectOrder={(ord) => {
                setSelectedOrderForDetail(ord);
                handleTabChange('orders');
              }}
              onOpenNewOrderModal={() => {
                handleTabChange('orders');
                setTriggerNewOrderModal(true);
              }}
            />
          )}

          {prefs.activeTab === 'customers' && (
            <CustomersView
              customers={data.customers}
              onSaveCustomer={handleSaveCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              onUseMeasurementForOrder={handleUseMeasurementForOrder}
              showToast={showToast}
            />
          )}

          {prefs.activeTab === 'orders' && (
            <OrdersView
              orders={data.orders}
              customers={data.customers}
              fabrics={data.fabrics}
              accessories={data.accessories}
              thobeTypes={data.thobeTypes}
              userPreferences={prefs}
              onSaveOrder={handleSaveOrder}
              onSaveCustomer={handleSaveCustomer}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onDeleteOrder={handleDeleteOrder}
              onSendWhatsAppNotice={handleSendWhatsAppNotice}
              showToast={showToast}
              initialSelectedOrder={selectedOrderForDetail}
              openNewOrderTrigger={triggerNewOrderModal}
              initialCustomerForOrder={customerForNewOrder}
              initialMeasurementForOrder={measurementForNewOrder}
            />
          )}

          {prefs.activeTab === 'invoices' && (
            <InvoicesView
              invoices={data.invoices}
              orders={data.orders}
              invoicePrintMode={prefs.invoicePrintMode}
              userPreferences={prefs}
              onUpdateInvoiceMode={handleUpdateInvoiceMode}
              onNavigateTab={handleTabChange}
              onAddPayment={handleAddPayment}
              showToast={showToast}
            />
          )}

          {prefs.activeTab === 'inventory' && (
            <InventoryView
              fabrics={data.fabrics}
              accessories={data.accessories}
              thobeTypes={data.thobeTypes}
              colors={data.colors}
              onSaveFabric={handleSaveFabric}
              onDeleteFabric={handleDeleteFabric}
              onSaveAccessory={handleSaveAccessory}
              onDeleteAccessory={handleDeleteAccessory}
              onSaveThobeType={handleSaveThobeType}
              onDeleteThobeType={handleDeleteThobeType}
              onSaveColor={handleSaveColor}
              onDeleteColor={handleDeleteColor}
              stockMovements={data.stockMovements || []}
              onAdjustStock={handleAdjustStock}
              showToast={showToast}
            />
          )}

          {prefs.activeTab === 'reports' && (
            <ReportsView data={data} dataRevision={dataRevision} showToast={showToast} />
          )}

          {prefs.activeTab === 'accounting' && (
            <AccountingView
              fabrics={data.fabrics}
              accessories={data.accessories}
              purchases={data.purchases || []}
              expenses={data.expenses || []}
              cashTransactions={data.cashTransactions || []}
              onCreatePurchase={handleCreatePurchase}
              onCreateExpense={handleCreateExpense}
              onCreateCashAdjustment={handleCreateCashAdjustment}
              showToast={showToast}
            />
          )}

          {prefs.activeTab === 'settings' && (
            <SettingsView
              preferences={prefs}
              onSaveShopSettings={handleSaveShopSettings}
              showToast={showToast}
            />
          )}
            </Suspense>
          </AppErrorBoundary>
        </div>
      </main>

      {/* Global Modals */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onRefreshData={loadAppData}
        showToast={showToast}
      />

      <NotificationsModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
        notifications={data.notifications}
        onMarkAllAsRead={handleMarkAllNotificationsRead}
        onClearNotifications={handleClearNotifications}
      />

      {/* Global CRUD Operations Loading Spinner */}
      {crudProgress.isExecuting && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 transition-all no-print">
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-2xl flex flex-col items-center justify-center gap-3 min-w-[280px] max-w-sm text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">{crudProgress.label}</h4>
              <p className="text-xs text-slate-500 mt-1 font-semibold">جاري تنفيذ العملية والتواصل مع قاعدة البيانات...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
