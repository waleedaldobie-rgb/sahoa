import React, { useRef, useState } from 'react';
import { Invoice, Order, PaymentRecord, UserPreferences } from '../types';
import { createSafeId } from '../domain/idGenerator';
import { Card, Button, Input, Select, Modal, EmptyState, Badge, SortHeader, SortDirection, getInvoiceStatusBadgeVariant } from './ui';
import { PrintableInvoice } from './PrintableInvoice';
export { PrintableInvoice };
import {
  Receipt,
  Search,
  Printer,
  DollarSign,
  CheckCircle2,
  Eye,
  Wallet
} from 'lucide-react';

export interface InvoicesViewProps {
  invoices: Invoice[];
  orders: Order[];
  invoicePrintMode: 'detailed' | 'summary';
  userPreferences?: UserPreferences;
  onUpdateInvoiceMode: (mode: 'detailed' | 'summary') => void;
  onNavigateTab?: (tabId: string) => void;
  onAddPayment: (invoiceId: string, payment: PaymentRecord) => Promise<void> | void;
  showToast: (msg: string, type: 'success' | 'danger' | 'warning' | 'info') => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices,
  orders,
  userPreferences,
  onNavigateTab,
  onAddPayment,
  showToast
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [invoiceSort, setInvoiceSort] = useState<{ key: 'invoiceNumber' | 'customerName' | 'orderDate' | 'totalAmount' | 'remainingAmount' | 'paymentStatus'; direction: SortDirection }>({ key: 'invoiceNumber', direction: 'asc' });
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // New Payment Form
  const [paymentAmount, setPaymentAmount] = useState<number>(100);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer'>('cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const paymentSubmitLock = useRef(false);

  const displayInvoiceNumber = (invoice: Invoice) => invoice.visibleInvoiceNumber ? `INV-${invoice.visibleInvoiceNumber}` : invoice.invoiceNumber;
  const filteredInvoices = invoices.filter(
    (inv) =>
      (inv.invoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      displayInvoiceNumber(inv).toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customerPhone.includes(searchTerm)
  );
  const toggleInvoiceSort = (key: typeof invoiceSort.key) => {
    setInvoiceSort((current) => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' });
  };
  const invoiceSortNumber = (invoice: Invoice) => invoice.visibleInvoiceNumber ?? (Number.parseInt((invoice.invoiceNumber || '').replace(/\D/g, ''), 10) || Number.MAX_SAFE_INTEGER);
  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    let comparison = 0;
    if (invoiceSort.key === 'invoiceNumber') comparison = invoiceSortNumber(a) - invoiceSortNumber(b);
    else if (invoiceSort.key === 'customerName') comparison = a.customerName.localeCompare(b.customerName, 'ar');
    else if (invoiceSort.key === 'orderDate') comparison = a.orderDate.localeCompare(b.orderDate);
    else if (invoiceSort.key === 'totalAmount') comparison = a.totalAmount - b.totalAmount;
    else if (invoiceSort.key === 'remainingAmount') comparison = a.remainingAmount - b.remainingAmount;
    else comparison = a.paymentStatus.localeCompare(b.paymentStatus, 'ar');
    if (comparison === 0) comparison = a.id.localeCompare(b.id);
    return invoiceSort.direction === 'asc' ? comparison : -comparison;
  });

  const handleOpenPaymentModal = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setPaymentAmount(inv.remainingAmount > 0 ? inv.remainingAmount : 50);
    setPaymentNote('تسديد دفعة حساب جديدة');
    setIsPaymentModalOpen(true);
  };

  const handleOpenPreviewModal = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setIsPreviewModalOpen(true);
  };

  const handleRegisterPayment = async () => {
    if (!selectedInvoice || paymentSubmitLock.current) return;
    if (paymentAmount <= 0) {
      showToast('يرجى أدخال مبلغ دفعة صحيح أكبر من صفر', 'danger');
      return;
    }

    if (paymentAmount > selectedInvoice.remainingAmount) {
      showToast('مبلغ الدفعة لا يمكن أن يتجاوز المبلغ المتبقي المستحق', 'danger');
      return;
    }

    paymentSubmitLock.current = true;
    setIsSubmittingPayment(true);
    const newPayment: PaymentRecord = {
      id: createSafeId('PAY'),
      invoiceId: selectedInvoice.id,
      orderId: selectedInvoice.orderId,
      amount: paymentAmount,
      paymentDate: new Date().toISOString().split('T')[0],
      method: paymentMethod,
      note: paymentNote
    };

    try {
      await onAddPayment(selectedInvoice.id, newPayment);
      showToast(`تم تسجيل دفعة جديدة بمبلغ ${paymentAmount} ر.س بنجاح!`, 'success');
      setIsPaymentModalOpen(false);
    } finally {
      paymentSubmitLock.current = false;
      setIsSubmittingPayment(false);
    }
  };

  const handlePrintInvoice = () => {
    window.print();
  };

  const getStatusBadge = (status: Invoice['paymentStatus']) => {
    const label = status === 'paid'
      ? 'مدفوع بالكامل'
      : status === 'partial'
        ? 'دفعة جزئية'
        : status === 'unpaid'
          ? 'غير مدفوع'
          : 'مُسوّى بالإلغاء';
    return <Badge variant={getInvoiceStatusBadgeVariant(status)}>{label}</Badge>;
  };

  const matchedOrderForInvoice = selectedInvoice
    ? orders.find((o) => o.id === selectedInvoice.orderId || o.orderNumber === selectedInvoice.orderId)
    : null;

  return (
    <div className="view-wrapper animate-in fade-in duration-300">
      {/* Printable Area */}
      {selectedInvoice && (
        <div className="hidden-on-screen">
          <PrintableInvoice
            invoice={selectedInvoice}
            order={matchedOrderForInvoice}
            preferences={userPreferences}
          />
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <h2 className="page-title flex items-center gap-3">
          <Receipt className="w-7 h-7 text-[#111111]" />
          الفواتير والحسابات المالية
        </h2>
        <p className="page-subtitle">إدارة المدفوعات، التحصيل، ومعاينة فواتير العملاء</p>
      </div>

      {/* Filters Bar */}
      <Card className="p-4 bg-[#F9FAFB]/50 border-dashed">
        <div className="relative max-w-lg">
          <Input
            placeholder="بحث برقم الفاتورة، اسم العميل، أو الجوال..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search className="w-5 h-5" />}
            className="h-11 border-dashed"
          />
        </div>
      </Card>

      {/* Invoices Table */}
      <Card className="p-0 overflow-hidden">
        {filteredInvoices.length === 0 ? (
          <EmptyState
            compact
            icon={<Receipt className="w-8 h-8" />}
            title={searchTerm.trim() ? 'لا توجد فواتير مطابقة لبحثك' : 'لا توجد فواتير بعد'}
            description={searchTerm.trim() ? 'جرّب رقم فاتورة أو اسم عميل مختلفًا، أو امسح البحث.' : 'ستظهر الفواتير هنا تلقائيًا عند تسجيل طلبات جديدة للعملاء.'}
            action={searchTerm.trim() ? <Button size="sm" variant="secondary" onClick={() => setSearchTerm('')}>مسح البحث</Button> : onNavigateTab ? <Button size="sm" variant="primary" onClick={() => onNavigateTab('orders')} icon={<Receipt className="w-4 h-4" />}>الانتقال إلى الطلبات</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="premium-table">
              <thead>
                <tr>
                  <th className="w-24 text-center" aria-sort={invoiceSort.key === 'invoiceNumber' ? invoiceSort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><SortHeader label="رقم الفاتورة" active={invoiceSort.key === 'invoiceNumber'} direction={invoiceSort.direction} onClick={() => toggleInvoiceSort('invoiceNumber')} align="center" /></th>
                  <th className="w-24 text-center">رقم العميل</th>
                  <th aria-sort={invoiceSort.key === 'customerName' ? invoiceSort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><SortHeader label="العميل" active={invoiceSort.key === 'customerName'} direction={invoiceSort.direction} onClick={() => toggleInvoiceSort('customerName')} /></th>
                  <th aria-sort={invoiceSort.key === 'orderDate' ? invoiceSort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><SortHeader label="تاريخ الفاتورة" active={invoiceSort.key === 'orderDate'} direction={invoiceSort.direction} onClick={() => toggleInvoiceSort('orderDate')} /></th>
                  <th className="text-center" aria-sort={invoiceSort.key === 'totalAmount' ? invoiceSort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><SortHeader label="الإجمالي" active={invoiceSort.key === 'totalAmount'} direction={invoiceSort.direction} onClick={() => toggleInvoiceSort('totalAmount')} align="center" /></th>
                  <th className="text-center">المدفوع</th>
                  <th className="text-center" aria-sort={invoiceSort.key === 'remainingAmount' ? invoiceSort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><SortHeader label="المتبقي" active={invoiceSort.key === 'remainingAmount'} direction={invoiceSort.direction} onClick={() => toggleInvoiceSort('remainingAmount')} align="center" /></th>
                  <th aria-sort={invoiceSort.key === 'paymentStatus' ? invoiceSort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><SortHeader label="الحالة" active={invoiceSort.key === 'paymentStatus'} direction={invoiceSort.direction} onClick={() => toggleInvoiceSort('paymentStatus')} /></th>
                  <th className="text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {sortedInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="text-center">
                      <span title={displayInvoiceNumber(inv)} className="font-black text-[#111111] bg-[#F3F4F6] px-2.5 py-1 rounded-lg text-xs">#{displayInvoiceNumber(inv)}</span>
                    </td>
                    <td className="text-center">
                      <span className="font-mono text-xs font-black text-slate-600">{inv.customerNumber ? `#${inv.customerNumber}` : '—'}</span>
                    </td>
                    <td>
                      <div title={inv.customerName} className="font-black text-[#111111]">{inv.customerName}</div>
                      <div title={inv.customerPhone} className="text-[10px] text-[#9CA3AF] font-mono font-bold mt-0.5">{inv.customerPhone}</div>
                    </td>
                    <td className="text-[#4B5563] font-bold font-mono">{inv.orderDate}</td>
                    <td className="text-center font-black text-[#111111] font-mono">{inv.totalAmount} ر.س</td>
                    <td className="text-center font-black text-emerald-600 font-mono">
                      <div>{inv.paidAmount} ر.س</div>
                      {inv.payments.filter((payment) => payment.method === 'customer_credit').reduce((sum, payment) => sum + Number(payment.amount || 0), 0) > 0 && (
                        <span data-testid={`invoice-credit-applied-${inv.id}`} className="mt-1 inline-flex rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-700">يتضمن تطبيق رصيد غير نقدي</span>
                      )}
                    </td>
                    <td className="text-center font-mono">
                      {inv.remainingAmount > 0 ? (
                        <span className="text-rose-600 font-black">{inv.remainingAmount} ر.س</span>
                      ) : (
                        <Badge variant="emerald">مكتمل</Badge>
                      )}
                    </td>
                    <td>{getStatusBadge(inv.paymentStatus)}</td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenPaymentModal(inv)}
                          icon={<Wallet className="w-3.5 h-3.5" />}
                          disabled={inv.remainingAmount <= 0}
                        >
                          تحصيل
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenPreviewModal(inv)}
                          icon={<Eye className="w-3.5 h-3.5" />}
                        >
                          معاينة
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* REGISTER PAYMENT MODAL */}
      {selectedInvoice && (
        <Modal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          title={`تحصيل دفعة - فاتورة #${displayInvoiceNumber(selectedInvoice)}`}
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsPaymentModalOpen(false)}>إلغاء</Button>
              <Button variant="primary" onClick={handleRegisterPayment} isLoading={isSubmittingPayment} icon={<CheckCircle2 className="w-4 h-4" />}>
                تأكيد العملية
              </Button>
            </div>
          }
        >
          <div className="space-y-6">
            <div className="p-5 bg-[#111111] text-white rounded-2xl shadow-lg">
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
                 <span className="text-xs font-bold opacity-60">العميل:</span>
                 <span className="text-sm font-black">{selectedInvoice.customerName}</span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-xs font-bold opacity-60">المبلغ المتبقي:</span>
                 <span className="text-2xl font-black font-mono text-amber-400">{selectedInvoice.remainingAmount} ر.س</span>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label="مبلغ التحصيل (ر.س) *"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
                icon={<DollarSign className="w-4 h-4" />}
              />

              <Select
                label="طريقة الدفع *"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
              >
                <option value="cash">نقداً (كاش)</option>
                <option value="card">مدى / بطاقة ائتمان (شبكة)</option>
                <option value="transfer">تحويل بنكي</option>
              </Select>

              <Input
                label="ملاحظات العملية"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="مثال: تسديد المتبقي"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* INVOICE PREVIEW MODAL */}
      {selectedInvoice && (
        <Modal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          title={`معاينة الفاتورة #${displayInvoiceNumber(selectedInvoice)}`}
          maxWidth="full"
          allowPrint
          footer={
            <div className="flex flex-col md:flex-row items-center justify-between w-full gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" onClick={handlePrintInvoice} icon={<Printer className="w-4 h-4" />}>
                  طباعة الفاتورة (15×21 سم)
                </Button>
                <p className="text-[10px] text-[#6B7280] font-bold">
                  * لحفظها كـ PDF، اختر (Save as PDF) من نافذة الطباعة.
                </p>
              </div>
              <Button variant="secondary" onClick={() => setIsPreviewModalOpen(false)}>إغلاق المعاينة</Button>
            </div>
          }
        >
          <div className="bg-[#F3F4F6] p-4 md:p-10 rounded-3xl border-2 border-dashed border-[#E5E7EB] min-h-[80vh] flex justify-center">
            <div className="w-full max-w-[210mm] shadow-2xl scale-[0.9] md:scale-100 origin-top">
              <PrintableInvoice
                invoice={selectedInvoice}
                order={matchedOrderForInvoice}
                preferences={userPreferences}
                showOnScreen={true}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
