import React, { useState, useEffect, useRef } from 'react';
import { Order, Invoice, Customer, FabricItem, AccessoryItem, ThobeType, OrderStatus, CustomerMeasurements, CustomerStyleDetails, UserPreferences, MeasurementHistoryRecord } from '../types';
import { EMPTY_MEASUREMENTS, EMPTY_STYLE_DETAILS } from '../services/electronMock';
import { Card, Button, Input, Select, Modal, EmptyState, Badge } from './ui';
import { ConfirmModal } from './ConfirmModal';
import { MeasurementsTableForm, draftKeyFor } from './MeasurementsTableForm';
import { PrintableInvoice } from './PrintableInvoice';
import {
  Scissors,
  Search,
  Plus,
  Printer,
  Calendar,
  History,
  Ruler,
  Trash2,
  Save,
  User,
  Hash,
  ShoppingBag,
  CreditCard,
  Notebook
} from 'lucide-react';

export interface OrdersViewProps {
  orders: Order[];
  customers: Customer[];
  fabrics: FabricItem[];
  accessories?: AccessoryItem[];
  thobeTypes: ThobeType[];
  userPreferences?: UserPreferences;
  onSaveOrder: (order: Order) => void;
  onSaveCustomer?: (customer: Customer) => Promise<void> | void;
  onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
  onDeleteOrder?: (orderId: string) => void;
  onSendWhatsAppNotice: (phone: string, name: string, orderNum: string, statusText: string) => void;
  showToast: (msg: string, type: 'success' | 'danger' | 'warning' | 'info') => void;
  initialSelectedOrder?: Order | null;
  openNewOrderTrigger?: boolean;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  customers,
  fabrics,
  accessories = [],
  thobeTypes,
  userPreferences,
  onSaveOrder,
  onSaveCustomer,
  onUpdateOrderStatus,
  onDeleteOrder,
  showToast,
  initialSelectedOrder,
  openNewOrderTrigger
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(initialSelectedOrder || null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(!!initialSelectedOrder);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(!!openNewOrderTrigger);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Print Mode State
  const [printableOrder, setPrintableOrder] = useState<Order | null>(null);

  // New Order Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [isCreatingCustomerInline, setIsCreatingCustomerInline] = useState(false);
  const [isMeasurementHistoryOpen, setIsMeasurementHistoryOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [inlineCustomer, setInlineCustomer] = useState<Customer | null>(null);
  const [selectedThobeTypeId, setSelectedThobeTypeId] = useState('');
  const [selectedFabricId, setSelectedFabricId] = useState('');
  const [orderDate] = useState(new Date().toISOString().split('T')[0]);
  
  const defaultDelivery = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [deliveryDate, setDeliveryDate] = useState(defaultDelivery);
  
  const [totalAmount, setTotalAmount] = useState<number>(220);
  const [paidAmount, setPaidAmount] = useState<number>(100);
  const [isTotalAmountManuallyEdited, setIsTotalAmountManuallyEdited] = useState(false);
  const [garmentCount, setGarmentCount] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [selectedAccessoryId, setSelectedAccessoryId] = useState('');
  const [accessoryQuantity, setAccessoryQuantity] = useState('1');
  const [selectedMaterials, setSelectedMaterials] = useState<Array<{ itemType: 'accessory'; itemId: string; itemName: string; quantity: number; unit: string; unitCostAtUsage: number }>>([]);

  const remainingAmount = Math.max(0, totalAmount - paidAmount);
  const selectedCustomer = selectedCustomerId ? customers.find((customer) => customer.id === selectedCustomerId) : undefined;
  const selectedCustomerHistory = selectedCustomer?.measurementHistory || [];

  const handleUseHistoryForOrder = (historyRecord: MeasurementHistoryRecord) => {
    setNewOrderMeasurements({ ...historyRecord.measurements });
    setNewOrderStyleDetails({ ...historyRecord.styleDetails });
    setIsMeasurementHistoryOpen(false);
    setHasUnsavedChanges(true);
    showToast(`تم تطبيق نسخة ${historyRecord.savedAt} على هذا الطلب فقط`, 'info');
  };

  // Filtered Orders
  const filteredOrders = orders.filter((ord) => {
    const matchesSearch =
      ord.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ord.customerPhone.includes(searchTerm) ||
      ord.orderNumber.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || ord.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const [detailTab, setDetailTab] = useState<'info' | 'measurements'>('info');
  const [newOrderMeasurements, setNewOrderMeasurements] = useState<CustomerMeasurements>(EMPTY_MEASUREMENTS);
  const [newOrderStyleDetails, setNewOrderStyleDetails] = useState<CustomerStyleDetails>(EMPTY_STYLE_DETAILS);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const skipNextDirtyCheck = useRef(true);

  useEffect(() => {
    if (skipNextDirtyCheck.current) {
      skipNextDirtyCheck.current = false;
      return;
    }
    setHasUnsavedChanges(true);
  }, [
    selectedCustomerId,
    selectedThobeTypeId,
    selectedFabricId,
    orderDate,
    deliveryDate,
    totalAmount,
    paidAmount,
    garmentCount,
    notes,
    newOrderMeasurements,
    newOrderStyleDetails,
    selectedMaterials,
  ]);

  useEffect(() => {
    if (selectedCustomerId && customers.length > 0) {
      const cust = customers.find((c) => c.id === selectedCustomerId);
      if (cust) {
        setInlineCustomer(cust);
        setNewOrderMeasurements({ ...cust.measurements });
        setNewOrderStyleDetails({ ...cust.styleDetails });
      }
    }
  }, [selectedCustomerId, customers]);

  const handleOpenNewOrder = () => {
    setIsSubmittingOrder(false);
    setIsTotalAmountManuallyEdited(false);
    setGarmentCount(1);
    setSelectedCustomerId('');
    setInlineCustomer(null);
    setIsMeasurementHistoryOpen(false);
    setIsCreatingCustomerInline(false);
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewOrderMeasurements({ ...EMPTY_MEASUREMENTS });
    setNewOrderStyleDetails({ ...EMPTY_STYLE_DETAILS });
    setSelectedAccessoryId('');
    setAccessoryQuantity('1');
    setSelectedMaterials([]);
    if (thobeTypes.length > 0) {
      setSelectedThobeTypeId(thobeTypes[0].id);
      setTotalAmount(thobeTypes[0].defaultPrice);
    }
    if (fabrics.length > 0) {
      setSelectedFabricId(fabrics[0].id);
    }
    skipNextDirtyCheck.current = true;
    setHasUnsavedChanges(false);
    setIsNewOrderModalOpen(true);
  };

  const handleThobeTypeChange = (thobeId: string) => {
    setSelectedThobeTypeId(thobeId);
    const found = thobeTypes.find((t) => t.id === thobeId);
    if (found) {
      setTotalAmount(found.defaultPrice * garmentCount);
      setIsTotalAmountManuallyEdited(false);
    }
  };

  const handleAddAccessoryMaterial = () => {
    const accessory = accessories.find((item) => item.id === selectedAccessoryId);
    const quantity = Number(accessoryQuantity);
    if (!accessory || !Number.isFinite(quantity) || quantity <= 0) {
      showToast('اختر المستلزم وأدخل كمية صحيحة', 'danger');
      return;
    }
    const alreadyAdded = selectedMaterials.find((material) => material.itemId === accessory.id);
    const nextQuantity = (alreadyAdded?.quantity || 0) + quantity;
    if (nextQuantity > accessory.quantity) {
      showToast(`الكمية المتاحة من ${accessory.name} هي ${accessory.quantity} ${accessory.unit}`, 'danger');
      return;
    }
    setSelectedMaterials((current) => [
      ...current.filter((material) => material.itemId !== accessory.id),
      { itemType: 'accessory', itemId: accessory.id, itemName: accessory.name, quantity: nextQuantity, unit: accessory.unit, unitCostAtUsage: accessory.purchasePrice || 0 }
    ]);
    setAccessoryQuantity('1');
  };

  const handleRemoveAccessoryMaterial = (itemId: string) => {
    setSelectedMaterials((current) => current.filter((material) => material.itemId !== itemId));
  };

  const handleCreateOrder = async () => {
    if (isSubmittingOrder) return;

    let customer = inlineCustomer || customers.find((c) => c.id === selectedCustomerId);

    if (isCreatingCustomerInline) {
      const name = newCustomerName.trim();
      const phone = newCustomerPhone.trim();
      if (!name || !phone) {
        showToast('يرجى إدخال اسم العميل ورقم الجوال للعميل الجديد', 'danger');
        return;
      }

      const existingCustomer = customers.find((c) => c.phone.trim() === phone);
      customer = existingCustomer
        ? { ...existingCustomer, measurements: { ...newOrderMeasurements }, styleDetails: { ...newOrderStyleDetails } }
        : {
            id: `CUS-${Date.now()}`,
            name,
            phone,
            createdAt: new Date().toISOString(),
            measurements: { ...newOrderMeasurements },
            styleDetails: { ...newOrderStyleDetails },
            measurementHistory: []
          };
    } else if (customer) {
      customer = { ...customer, measurements: { ...newOrderMeasurements }, styleDetails: { ...newOrderStyleDetails } };
    }

    if (!customer) {
      showToast('يرجى اختيار العميل أو إدخال بيانات العميل الجديد', 'danger');
      return;
    }

    if (totalAmount < 0 || paidAmount < 0) {
      showToast('المبالغ المالية لا يمكن أن تكون سالبة', 'danger');
      return;
    }

    if (paidAmount > totalAmount) {
      showToast('مبلغ العربون لا يمكن أن يتجاوز السعر الكلي للطلب', 'danger');
      return;
    }

    if (garmentCount < 1) {
      showToast('عدد الثياب لا يمكن أن يكون أقل من 1', 'danger');
      return;
    }

    const thobe = thobeTypes.find((t) => t.id === selectedThobeTypeId) || null;
    if (!thobe) {
      showToast('يرجى اختيار نوع الثوب أولاً', 'danger');
      return;
    }

    const fabric = fabrics.find((f) => f.id === selectedFabricId);
    if (!fabric) {
      showToast('يرجى اختيار القماش واللون أولاً', 'danger');
      return;
    }

    const requiredMeasurements: Array<[keyof CustomerMeasurements, string]> = [
      ['frontLength', 'طول أمام'],
      ['backLength', 'طول خلف'],
      ['shoulderWidth', 'الكتف']
    ];
    const missingMeasurements = requiredMeasurements
      .filter(([key]) => !String(newOrderMeasurements[key] || '').trim())
      .map(([, label]) => label);
    if (missingMeasurements.length > 0) {
      showToast(`يرجى إدخال القياسات الأساسية قبل الحفظ: ${missingMeasurements.join('، ')}`, 'danger');
      return;
    }

    setIsSubmittingOrder(true);
    const newOrderNumber = String(1000 + orders.length + 1);
    const newOrder: Order = {
      id: 'ORD-' + Date.now(),
      orderNumber: newOrderNumber,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      thobeTypeId: thobe.id,
      thobeTypeName: thobe.name,
      fabricId: fabric.id,
      fabricName: fabric.name,
      fabricColor: fabric.color,
      garmentCount,
      orderDate,
      deliveryDate,
      status: 'new',
      totalAmount,
      paidAmount,
      remainingAmount,
      isCustomMeasurement: true,
      measurements: newOrderMeasurements,
      styleDetails: newOrderStyleDetails,
      notes,
      materialUsages: selectedMaterials,
      createdAt: new Date().toISOString()
    };

    try {
      await onSaveCustomer?.(customer);
      await onSaveOrder(newOrder);
      try {
        localStorage.removeItem(draftKeyFor(customer.name, customer.phone, 'new-order'));
      } catch { }
      showToast(`تم تسجيل الطلب الجديد رقم (#${newOrderNumber}) بنجاح!`, 'success');
      setHasUnsavedChanges(false);
      setIsNewOrderModalOpen(false);
    } catch {
      showToast('تعذر حفظ الطلب. يرجى المحاولة مرة أخرى.', 'danger');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleCloseNewOrder = () => {
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
      return;
    }
    setIsNewOrderModalOpen(false);
  };

  useEffect(() => {
    if (!isNewOrderModalOpen) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleCreateOrder();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const getStatusText = (status: OrderStatus) => {
    switch (status) {
      case 'new': return 'جديد';
      case 'processing': return 'تحت التنفيذ';
      case 'ready': return 'جاهز للتسليم';
      case 'delivered': return 'تم التسليم';
    }
  };

  const handlePrintOrderSheet = (order: Order) => {
    setPrintableOrder(order);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="view-wrapper">
      {/* Printable Area */}
      {printableOrder && (() => {
        const printableInvoice: Invoice = {
          id: `INV-${printableOrder.id}`,
          invoiceNumber: printableOrder.orderNumber,
          orderId: printableOrder.id,
          customerName: printableOrder.customerName,
          customerPhone: printableOrder.customerPhone,
          orderDate: printableOrder.orderDate,
          totalAmount: printableOrder.totalAmount,
          paidAmount: printableOrder.paidAmount,
          remainingAmount: printableOrder.remainingAmount,
          paymentStatus: printableOrder.remainingAmount <= 0 ? 'paid' : printableOrder.paidAmount > 0 ? 'partial' : 'unpaid',
          payments: []
        };
        return (
          <div className="hidden-on-screen">
            <PrintableInvoice invoice={printableInvoice} order={printableOrder} preferences={userPreferences} />
          </div>
        );
      })()}

      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="page-header">
          <h2 className="page-title flex items-center gap-3">
            <Scissors className="w-7 h-7 text-[#111111]" />
            إدارة طلبات الخياطة
          </h2>
          <p className="page-subtitle">متابعة مراحل التنفيذ، التسليم، وطباعة الكروت</p>
        </div>
        <Button
          variant="primary"
          onClick={handleOpenNewOrder}
          icon={<Plus className="w-5 h-5" />}
          size="lg"
        >
          تسجيل طلب جديد
        </Button>
      </div>

      {/* Filters Bar */}
      <Card className="p-4 bg-[#F9FAFB]/50 border-dashed">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="relative w-full lg:w-96">
            <Input
              placeholder="بحث برقم الطلب، اسم العميل، أو الجوال..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search className="w-5 h-5" />}
              className="h-11 border-dashed"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-white border border-[#E5E7EB] rounded-xl overflow-x-auto w-full lg:w-auto">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'new', label: 'جديد' },
              { id: 'processing', label: 'تحت التنفيذ' },
              { id: 'ready', label: 'جاهز' },
              { id: 'delivered', label: 'مُسلم' }
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-5 py-2 rounded-lg text-xs font-black transition-all duration-200 whitespace-nowrap ${
                  statusFilter === st.id
                    ? 'bg-[#111111] text-white shadow-md'
                    : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111111]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Orders Table */}
      <Card className="p-0 overflow-hidden">
        {filteredOrders.length === 0 ? (
          <EmptyState
            icon={<Scissors className="w-8 h-8" />}
            title="لا توجد طلبات مطابقة"
            description="يمكنك تغيير خيارات البحث أو إضافة طلب جديد للبدء."
            action={
              <Button variant="primary" size="md" onClick={handleOpenNewOrder} icon={<Plus className="w-4 h-4" />}>
                إضافة طلب جديد
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="premium-table">
              <thead>
                <tr>
                  <th className="w-24 text-center">رقم الطلب</th>
                  <th>العميل</th>
                  <th>التفاصيل</th>
                  <th>موعد التسليم</th>
                  <th>المالية</th>
                  <th>الحالة</th>
                  <th className="text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((ord) => (
                  <tr key={ord.id} className="group">
                    <td className="text-center">
                      <span className="font-black text-[#111111] bg-[#F3F4F6] px-2.5 py-1 rounded-lg text-xs">#{ord.orderNumber}</span>
                    </td>
                    <td>
                      <div className="font-black text-[#111111]">{ord.customerName}</div>
                      <div className="text-[10px] text-[#9CA3AF] font-mono font-bold mt-0.5">{ord.customerPhone}</div>
                    </td>
                    <td>
                      <div className="text-xs font-black text-[#111111]">{ord.thobeTypeName}</div>
                      <div className="text-[10px] text-[#6B7280] font-bold mt-0.5">{ord.fabricName} ({ord.fabricColor})</div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 text-rose-600 font-black text-xs font-mono">
                        <Calendar className="w-3.5 h-3.5" />
                        {ord.deliveryDate}
                      </div>
                    </td>
                    <td>
                      <div className="text-xs font-black text-[#111111]">{ord.totalAmount} ر.س</div>
                      <div className="mt-1">
                        {ord.remainingAmount > 0 ? (
                          <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">متبقي: {ord.remainingAmount}</span>
                        ) : (
                          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">مدفوع كامل</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <Badge
                        variant={
                          ord.status === 'delivered' || ord.status === 'ready'
                            ? 'emerald'
                            : ord.status === 'processing'
                            ? 'amber'
                            : 'slate'
                        }
                      >
                        {getStatusText(ord.status)}
                      </Badge>
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedOrder(ord);
                            setIsDetailModalOpen(true);
                          }}
                          title="عرض التفاصيل"
                        >
                          عرض
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handlePrintOrderSheet(ord)}
                          icon={<Printer className="w-3.5 h-3.5" />}
                          title="طباعة"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* NEW ORDER FULL SCREEN MODAL */}
      <Modal
        isOpen={isNewOrderModalOpen}
        onClose={handleCloseNewOrder}
        title="تسجيل طلب جديد"
        maxWidth="full"
        footer={
          <div className="flex items-center justify-between w-full">
             <div className="flex items-center gap-4 text-[#6B7280]">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${hasUnsavedChanges ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                  <span className="text-[11px] font-black">{hasUnsavedChanges ? 'تعديلات غير محفوظة' : 'جاهز للحفظ النهائي'}</span>
                </div>
             </div>
             <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={handleCloseNewOrder}>إلغاء</Button>
                <Button 
                  variant="primary" 
                  onClick={handleCreateOrder} 
                  icon={<Save className="w-4 h-4" />}
                  isLoading={isSubmittingOrder}
                  size="lg"
                >
                  حفظ الطلب والقياسات (Ctrl+S)
                </Button>
             </div>
          </div>
        }
      >
        <div className="space-y-10 pb-10">
          {/* Section 1: Customer & Basic Info */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Customer Info Card */}
            <Card 
              title="بيانات العميل" 
              headerIcon={<User className="w-5 h-5" />}
              className="xl:col-span-1"
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-2 mb-2">
                   <label className="text-[13px] font-black text-[#111111]">العميل المستهدف *</label>
                   <button 
                    onClick={() => setIsCreatingCustomerInline(!isCreatingCustomerInline)}
                    className="text-[11px] font-black text-[#111111] hover:underline flex items-center gap-1"
                   >
                     {isCreatingCustomerInline ? 'إلغاء الإضافة' : 'إضافة عميل جديد +'}
                   </button>
                </div>

                {isCreatingCustomerInline ? (
                  <div className="space-y-4 p-4 bg-[#F9FAFB] rounded-xl border-2 border-dashed border-[#E5E7EB] animate-in fade-in slide-in-from-top-2">
                    <Input
                      label="اسم العميل الجديد *"
                      placeholder="أدخل الاسم الثلاثي"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      icon={<User className="w-4 h-4" />}
                    />
                    <Input
                      label="رقم الجوال *"
                      placeholder="05xxxxxxxx"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      icon={<Hash className="w-4 h-4" />}
                    />
                    <p className="text-[10px] text-[#6B7280] font-bold leading-relaxed">سيتم إنشاء سجل للعميل الجديد تلقائياً عند حفظ هذا الطلب.</p>
                  </div>
                ) : (
                  <Select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    icon={<User className="w-4 h-4" />}
                  >
                    <option value="">-- اختر عميلاً موجوداً --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} - ({c.phone})
                      </option>
                    ))}
                  </Select>
                )}

                {!isCreatingCustomerInline && selectedCustomer && selectedCustomerHistory.length > 0 && (
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAF8] p-3.5">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <History className="w-4 h-4 text-[#111111] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-black text-[#111111] truncate">سجل المقاسات القديمة</p>
                          <p className="text-[10px] text-[#6B7280] font-bold truncate">اختر نسخة سابقة لهذا الطلب فقط</p>
                        </div>
                      </div>
                      <Badge variant="slate">{selectedCustomerHistory.length} نسخ</Badge>
                    </div>
                    <div className="space-y-2">
                      {selectedCustomerHistory.slice(0, 3).map((historyRecord) => (
                        <div key={historyRecord.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Calendar className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
                            <div className="min-w-0">
                              <span className="block text-[10px] font-black text-[#111111]">نسخة محفوظة</span>
                              <span className="block text-[10px] font-mono font-bold text-[#6B7280] truncate">{historyRecord.savedAt}</span>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => handleUseHistoryForOrder(historyRecord)}
                          >
                            استخدام لهذا الطلب فقط
                          </Button>
                        </div>
                      ))}
                    </div>
                    {selectedCustomerHistory.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setIsMeasurementHistoryOpen((open) => !open)}
                        className="mt-2 text-[10px] font-black text-[#111111] hover:underline"
                      >
                        {isMeasurementHistoryOpen ? 'إخفاء بقية السجل' : `عرض بقية السجل (${selectedCustomerHistory.length - 3})`}
                      </button>
                    )}
                    {isMeasurementHistoryOpen && selectedCustomerHistory.length > 3 && (
                      <div className="mt-2 space-y-2 border-t border-[#E5E7EB] pt-2">
                        {selectedCustomerHistory.slice(3).map((historyRecord) => (
                          <div key={historyRecord.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Calendar className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
                              <span className="text-[10px] font-mono font-bold text-[#6B7280] truncate">{historyRecord.savedAt}</span>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleUseHistoryForOrder(historyRecord)}
                            >
                              استخدام لهذا الطلب فقط
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Order Details Card */}
            <Card 
              title="تفاصيل الطلب" 
              headerIcon={<ShoppingBag className="w-5 h-5" />}
              className="xl:col-span-2"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Select
                  label="نوع الثوب *"
                  value={selectedThobeTypeId}
                  onChange={(e) => handleThobeTypeChange(e.target.value)}
                >
                  <option value="">-- اختر النوع --</option>
                  {thobeTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.defaultPrice} ر.س)</option>
                  ))}
                </Select>

                <div>
                  <Select
                    label="القماش واللون *"
                    value={selectedFabricId}
                    onChange={(e) => setSelectedFabricId(e.target.value)}
                  >
                    <option value="">-- اختر القماش --</option>
                    {fabrics.map((f) => (
                      <option key={f.id} value={f.id}>{f.name} - {f.color} ({f.quantityMeters} متر)</option>
                    ))}
                  </Select>
                  {fabrics.length === 0 && <p className="mt-1 text-[10px] font-bold text-amber-700">لا توجد أقمشة مسجلة. أضف قماشاً من صفحة المخزون قبل حفظ الطلب.</p>}
                </div>

                <Input
                  label="تاريخ موعد التسليم *"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  icon={<Calendar className="w-4 h-4" />}
                />

                <Input
                  label="عدد الثياب *"
                  type="number"
                  min="1"
                  value={garmentCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setGarmentCount(val);
                    const found = thobeTypes.find(t => t.id === selectedThobeTypeId);
                    if (found && !isTotalAmountManuallyEdited) {
                      setTotalAmount(found.defaultPrice * val);
                    }
                  }}
                />

                <Input
                  label="السعر الكلي (ر.س) *"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={totalAmount === 0 ? '' : totalAmount}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => {
                    const value = e.target.value;
                    setIsTotalAmountManuallyEdited(true);
                    setTotalAmount(value === '' ? 0 : Number(value));
                  }}
                  icon={<CreditCard className="w-4 h-4" />}
                />

                <Input
                  label="المبلغ المدفوع (عربون) *"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={paidAmount === 0 ? '' : paidAmount}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setPaidAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                  icon={<CreditCard className="w-4 h-4" />}
                />
              </div>

              <div className="mt-5 pt-5 border-t border-[#F3F4F6] space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div><h4 className="text-sm font-black text-[#111111]">مواد مرتبطة بالطلب</h4><p className="text-[11px] text-[#6B7280] font-bold mt-1">اختياري — تُخصم من المخزون وتدخل بسعر الشراء التاريخي في التكلفة</p></div>
                  <Badge variant="slate">{selectedMaterials.length} أصناف</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-3 items-end">
                  <Select label="المستلزم / الإكسسوار" value={selectedAccessoryId} onChange={(e) => setSelectedAccessoryId(e.target.value)}>
                    <option value="">-- اختر مستلزماً --</option>
                    {accessories.map((accessory) => <option key={accessory.id} value={accessory.id}>{accessory.name} ({accessory.quantity} {accessory.unit})</option>)}
                  </Select>
                  <Input label="الكمية" type="number" min="0.01" step="0.01" value={accessoryQuantity} onChange={(e) => setAccessoryQuantity(e.target.value)} />
                  <Button type="button" variant="secondary" onClick={handleAddAccessoryMaterial}>إضافة</Button>
                </div>
                {selectedMaterials.length > 0 && <div className="flex flex-wrap gap-2">{selectedMaterials.map((material) => <div key={material.itemId} className="inline-flex items-center gap-2 rounded-lg border border-[#D9D9D9] bg-[#F9FAFB] px-3 py-2 text-xs font-black"><span>{material.itemName} × {material.quantity} {material.unit}</span><span className="text-[#6B7280]">{material.quantity * material.unitCostAtUsage} ر.س</span><button type="button" className="text-rose-600 hover:underline" onClick={() => handleRemoveAccessoryMaterial(material.itemId)}>حذف</button></div>)}</div>}
              </div>
              
              <div className="mt-5 pt-5 border-t border-[#F3F4F6] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-black text-[#6B7280]">المبلغ المتبقي:</span>
                  <span className={`text-xl font-black font-mono ${remainingAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {remainingAmount} ر.س
                  </span>
                </div>
                <div className="w-1/2">
                   <Input 
                    placeholder="ملاحظات إضافية للطلب..." 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-11 border-dashed"
                   />
                </div>
              </div>
            </Card>
          </div>

          {/* Section 2: Measurements Worksheet */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-2">
               <div className="w-10 h-10 rounded-xl bg-[#111111] text-white flex items-center justify-center shadow-lg">
                  <Ruler className="w-5 h-5" />
               </div>
               <div>
                  <h3 className="text-lg font-black text-[#111111] tracking-tight">جدول القياسات والرسومات</h3>
                  <p className="text-[12px] text-[#6B7280] font-bold">يرجى تعبئة كافة القياسات الفنية بدقة (جميع القياسات بالإنش)</p>
               </div>
            </div>
            
            <MeasurementsTableForm
              measurements={newOrderMeasurements}
              onChange={setNewOrderMeasurements}
              styleDetails={newOrderStyleDetails}
              onStyleChange={setNewOrderStyleDetails}
              customerName={isCreatingCustomerInline ? newCustomerName : inlineCustomer?.name}
              customerPhone={isCreatingCustomerInline ? newCustomerPhone : inlineCustomer?.phone}
              draftScope="new-order"
            />

            <div className="mt-6 rounded-2xl border border-[#D9D9D9] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Notebook className="w-4 h-4 text-[#111111]" />
                <label className="text-sm font-black text-[#111111]">ملاحظات الخياط</label>
              </div>
              <textarea
                value={newOrderStyleDetails.tailorNotes || ''}
                onChange={(e) => setNewOrderStyleDetails((prev) => ({ ...prev, tailorNotes: e.target.value }))}
                placeholder="اكتب التعليمات الفنية الخاصة بالخياط أو المقص دار..."
                rows={4}
                className="w-full rounded-xl border-2 border-[#E5E7EB] bg-[#FAFAF8] px-4 py-3 text-sm font-bold text-[#111111] outline-none transition focus:border-[#111111] resize-y"
              />
              <p className="mt-2 text-[11px] font-bold text-[#6B7280]">تظهر هذه الملاحظات في أسفل الفاتورة المطبوعة.</p>
            </div>
          </div>
        </div>
      </Modal>

      {/* DETAIL MODAL */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`تفاصيل الطلب #${selectedOrder?.orderNumber}`}
        maxWidth={detailTab === 'measurements' ? 'full' : '2xl'}
        footer={
          <div className="flex items-center justify-between w-full">
            <Button variant="danger" size="sm" onClick={() => setOrderToDelete(selectedOrder)} icon={<Trash2 className="w-4 h-4" />}>حذف الطلب</Button>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => handlePrintOrderSheet(selectedOrder!)} icon={<Printer className="w-4 h-4" />}>طباعة الفاتورة</Button>
              <Button variant="primary" onClick={() => setIsDetailModalOpen(false)}>إغلاق</Button>
            </div>
          </div>
        }
      >
        {selectedOrder && (
          <div className="space-y-6">
            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-xl w-fit">
              <button
                onClick={() => setDetailTab('info')}
                className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${
                  detailTab === 'info' ? 'bg-white text-[#111111] shadow-sm' : 'text-[#6B7280] hover:text-[#111111]'
                }`}
              >
                بيانات الطلب
              </button>
              <button
                onClick={() => setDetailTab('measurements')}
                className={`px-6 py-2 rounded-lg text-xs font-black transition-all ${
                  detailTab === 'measurements' ? 'bg-white text-[#111111] shadow-sm' : 'text-[#6B7280] hover:text-[#111111]'
                }`}
              >
                المقاسات والتصميم
              </button>
            </div>

            {detailTab === 'info' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB]">
                    <h4 className="text-[11px] font-black text-[#9CA3AF] uppercase mb-3 tracking-wider">بيانات العميل</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs font-bold text-[#6B7280]">الاسم:</span>
                        <span className="text-xs font-black text-[#111111]">{selectedOrder.customerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs font-bold text-[#6B7280]">الجوال:</span>
                        <span className="text-xs font-black text-[#111111] font-mono">{selectedOrder.customerPhone}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-[#F9FAFB] rounded-2xl border border-[#E5E7EB]">
                    <h4 className="text-[11px] font-black text-[#9CA3AF] uppercase mb-3 tracking-wider">تفاصيل الثوب</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs font-bold text-[#6B7280]">النوع:</span>
                        <span className="text-xs font-black text-[#111111]">{selectedOrder.thobeTypeName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs font-bold text-[#6B7280]">القماش:</span>
                        <span className="text-xs font-black text-[#111111]">{selectedOrder.fabricName} ({selectedOrder.fabricColor})</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                   <div className="p-4 bg-[#111111] rounded-2xl text-white shadow-lg">
                    <h4 className="text-[11px] font-black text-white/50 uppercase mb-3 tracking-wider">المالية والحالة</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold opacity-80">الإجمالي:</span>
                        <span className="text-lg font-black font-mono">{selectedOrder.totalAmount} ر.س</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold opacity-80">المتبقي:</span>
                        <span className={`text-lg font-black font-mono ${selectedOrder.remainingAmount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {selectedOrder.remainingAmount} ر.س
                        </span>
                      </div>
                      <div className="pt-2 border-t border-white/10">
                        <Select
                          value={selectedOrder.status}
                          onChange={(e) => onUpdateOrderStatus(selectedOrder.id, e.target.value as OrderStatus)}
                          className="bg-white/10 border-white/20 text-white h-10"
                        >
                          <option value="new">جديد</option>
                          <option value="processing">تحت التنفيذ</option>
                          <option value="ready">جاهز</option>
                          <option value="delivered">مُسلم</option>
                        </Select>
                      </div>
                    </div>
                  </div>
                  
                  {selectedOrder.notes && (
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                      <h4 className="text-[11px] font-black text-amber-800 uppercase mb-2 flex items-center gap-1.5">
                        <Notebook className="w-3.5 h-3.5" />
                        ملاحظات
                      </h4>
                      <p className="text-xs font-bold text-amber-900 leading-relaxed">{selectedOrder.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <MeasurementsTableForm
                  measurements={selectedOrder.measurements}
                  onChange={(m) => onSaveOrder({ ...selectedOrder, measurements: m })}
                  styleDetails={selectedOrder.styleDetails}
                  onStyleChange={(s) => onSaveOrder({ ...selectedOrder, styleDetails: s })}
                  customerName={selectedOrder.customerName}
                  customerPhone={selectedOrder.customerPhone}
                  draftScope={selectedOrder.id}
                  saveLabel="تحديث المقاسات"
                  onSave={() => showToast('تم تحديث المقاسات بنجاح', 'success')}
                />

                <div className="mt-6 rounded-2xl border border-[#D9D9D9] bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Notebook className="w-4 h-4 text-[#111111]" />
                    <label className="text-sm font-black text-[#111111]">ملاحظات الخياط</label>
                  </div>
                  <textarea
                    value={selectedOrder.styleDetails?.tailorNotes || ''}
                    onChange={(e) => onSaveOrder({
                      ...selectedOrder,
                      styleDetails: { ...selectedOrder.styleDetails, tailorNotes: e.target.value }
                    })}
                    placeholder="اكتب التعليمات الفنية الخاصة بالخياط أو المقص دار..."
                    rows={4}
                    className="w-full rounded-xl border-2 border-[#E5E7EB] bg-[#FAFAF8] px-4 py-3 text-sm font-bold text-[#111111] outline-none transition focus:border-[#111111] resize-y"
                  />
                  <p className="mt-2 text-[11px] font-bold text-[#6B7280]">تظهر هذه الملاحظات في أسفل الفاتورة المطبوعة.</p>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* DELETE CONFIRMATION */}
      <ConfirmModal
        isOpen={!!orderToDelete}
        onClose={() => setOrderToDelete(null)}
        onConfirm={() => {
          if (orderToDelete && onDeleteOrder) {
            onDeleteOrder(orderToDelete.id);
            setOrderToDelete(null);
            setIsDetailModalOpen(false);
            showToast('تم حذف الطلب بنجاح', 'success');
          }
        }}
        title="حذف الطلب"
        message={`هل أنت متأكد من حذف الطلب رقم #${orderToDelete?.orderNumber}؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="نعم، احذف الطلب"
        variant="danger"
      />

      <ConfirmModal
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={() => {
          setShowDiscardConfirm(false);
          setIsNewOrderModalOpen(false);
        }}
        title="تجاهل التعديلات؟"
        message="يوجد تعديلات غير محفوظة على هذا الطلب. إذا رجعت الآن سيتم فقدانها. هل تريد المتابعة؟"
        confirmLabel="تجاهل والرجوع"
        variant="danger"
      />
    </div>
  );
};
