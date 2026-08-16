import React, { useState } from 'react';
import { Customer, CustomerMeasurements, CustomerStyleDetails, MeasurementHistoryRecord } from '../types';
import { EMPTY_MEASUREMENTS, EMPTY_STYLE_DETAILS } from '../services/shared/measurementDefaults';
import { Card, Button, Input, EmptyState } from './ui';
import { ConfirmModal } from './ConfirmModal';
import { MeasurementsTableForm } from './MeasurementsTableForm';
import {
  Users,
  Search,
  Ruler,
  History,
  Save,
  Phone,
  User,
  Trash2,
  ArrowLeft,
  Calendar,
  Eye
} from 'lucide-react';

export interface CustomersViewProps {
  customers: Customer[];
  onSaveCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  onUseMeasurementForOrder?: (customer: Customer, snapshot: MeasurementHistoryRecord | null) => void;
  showToast: (msg: string, type: 'success' | 'danger' | 'warning' | 'info') => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  onSaveCustomer,
  onDeleteCustomer,
  onUseMeasurementForOrder,
  showToast
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<'measurements' | 'history'>('measurements');

  // Form State
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    phone: string;
    measurements: CustomerMeasurements;
    styleDetails: CustomerStyleDetails;
  }>({
    name: '',
    phone: '',
    measurements: { ...EMPTY_MEASUREMENTS },
    styleDetails: { ...EMPTY_STYLE_DETAILS }
  });

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(normalizedSearch) ||
      c.phone.includes(searchTerm.trim())
  );

  const formatDate = (value?: string) => {
    if (!value) return '--';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('ar-SA');
  };

  const handleOpenEditModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      measurements: { ...customer.measurements },
      styleDetails: { ...customer.styleDetails }
    });
    setActiveFormTab('measurements');
    setIsFormOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      showToast('يرجى تعبئة اسم العميل ورقم الجوال', 'danger');
      return;
    }

    const phoneTrim = formData.phone.trim();
    const isDuplicatePhone = customers.some((c) => c.phone === phoneTrim && c.id !== formData.id);
    if (isDuplicatePhone) {
      showToast('عذراً، رقم الجوال هذا مسجل بالفعل لعميل آخر', 'danger');
      return;
    }

    const nowStr = new Date().toISOString();
    const newCust: Customer = {
      id: formData.id || 'CUST-' + Date.now(),
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      createdAt: selectedCustomer ? selectedCustomer.createdAt : nowStr,
      updatedAt: nowStr,
      measurements: formData.measurements,
      styleDetails: formData.styleDetails,
      measurementHistory: selectedCustomer?.measurementHistory || []
    };

    onSaveCustomer(newCust);
    showToast(selectedCustomer ? 'تم حفظ المقاس الجديد مع الاحتفاظ بالمقاس السابق' : 'تم حفظ بيانات العميل بنجاح', 'success');
    setIsFormOpen(false);
  };

  if (isFormOpen) {
    return (
      <div className="view-wrapper animate-in fade-in duration-300">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="page-header">
            <button
              onClick={() => setIsFormOpen(false)}
              className="text-[13px] font-black text-[#6B7280] hover:text-[#111111] flex items-center gap-2 transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4 rotate-180" />
              العودة لقائمة العملاء
            </button>
            <h2 className="page-title flex items-center gap-3">
              <User className="w-7 h-7 text-[#111111]" />
              {selectedCustomer ? `تعديل ملف: ${selectedCustomer.name}` : 'تسجيل عميل جديد'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {selectedCustomer && (
              <Button
                variant="danger"
                size="md"
                onClick={() => setIsDeleteConfirmOpen(true)}
                icon={<Trash2 className="w-4 h-4" />}
              >
                حذف العميل
              </Button>
            )}
            <Button variant="primary" onClick={handleSave} icon={<Save className="w-5 h-5" />} size="lg">
              حفظ التغييرات
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card title="البيانات الأساسية" className="lg:col-span-1 h-fit">
            <div className="space-y-5">
              <Input
                label="اسم العميل الكامل *"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="مثال: محمد عبدالله"
                icon={<User className="w-4 h-4" />}
              />
              <Input
                label="رقم الجوال *"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="05xxxxxxxx"
                icon={<Phone className="w-4 h-4" />}
              />
              {selectedCustomer && (
                <div className="pt-4 mt-4 border-t border-[#F3F4F6] flex items-center justify-between text-[11px] font-bold text-[#9CA3AF]">
                  <span>تاريخ الانضمام:</span>
                  <span className="font-mono text-[#111111]">{selectedCustomer.createdAt}</span>
                </div>
              )}
            </div>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-xl w-fit">
              <button
                onClick={() => setActiveFormTab('measurements')}
                className={`px-6 py-2.5 rounded-lg text-xs font-black transition-all duration-200 flex items-center gap-2 ${
                  activeFormTab === 'measurements' ? 'bg-white text-[#111111] shadow-sm' : 'text-[#6B7280] hover:text-[#111111]'
                }`}
              >
                <Ruler className="w-4 h-4" />
                المقاسات الحالية
              </button>
              {selectedCustomer && (
                <button
                  onClick={() => setActiveFormTab('history')}
                  className={`px-6 py-2.5 rounded-lg text-xs font-black transition-all duration-200 flex items-center gap-2 ${
                    activeFormTab === 'history' ? 'bg-white text-[#111111] shadow-sm' : 'text-[#6B7280] hover:text-[#111111]'
                  }`}
                >
                  <History className="w-4 h-4" />
                  سجل التعديلات ({selectedCustomer.measurementHistory.length})
                </button>
              )}
            </div>

            {activeFormTab === 'measurements' ? (
              <>
                {selectedCustomer && (
                  <Card className="border-[#E5E7EB] bg-[#FAFAF8]">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Ruler className="w-4 h-4 text-[#111111]" />
                          <h3 className="text-sm font-black text-[#111111]">آخر مقاس محفوظ</h3>
                        </div>
                        <p className="text-[11px] font-bold text-[#6B7280]">
                          آخر تحديث للمقاس: <span className="text-[#111111]">{formatDate(selectedCustomer.updatedAt || selectedCustomer.createdAt)}</span>
                        </p>
                        <p className="mt-2 text-xs font-bold text-[#4B5563]">
                          طول أمام {selectedCustomer.measurements.frontLength || '--'} · الكتف {selectedCustomer.measurements.shoulderWidth || '--'} · الرقبة {selectedCustomer.measurements.neckSize || '--'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onUseMeasurementForOrder?.(selectedCustomer, null)}
                        disabled={!onUseMeasurementForOrder}
                      >
                        استخدام آخر مقاس
                      </Button>
                    </div>
                  </Card>
                )}
                <MeasurementsTableForm
                measurements={formData.measurements}
                styleDetails={formData.styleDetails}
                  onChange={(updated) => setFormData({ ...formData, measurements: updated })}
                  onStyleChange={(updated) => setFormData({ ...formData, styleDetails: updated })}
                  customerName={formData.name}
                  customerPhone={formData.phone}
                  draftScope={selectedCustomer?.id || 'customer'}
                />
              </>
            ) : (
              <div className="space-y-4">
                {selectedCustomer?.measurementHistory.length === 0 ? (
                  <EmptyState
                    icon={<History className="w-8 h-8" />}
                    title="لا يوجد سجل سابق"
                    description="يتم حفظ نسخة احتياطية تلقائياً لكل تعديل تجريه على مقاسات العميل."
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {selectedCustomer?.measurementHistory.map((hist) => (
                      <Card key={hist.id} className="hover:border-[#111111] transition-colors group">
                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#F3F4F6]">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#F9FAFB] flex items-center justify-center text-[#111111]">
                              <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                              <span className="text-xs font-black text-[#111111] block">نسخة محفوظة</span>
                              <span className="text-[10px] text-[#9CA3AF] font-bold font-mono">{hist.savedAt}</span>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => onUseMeasurementForOrder?.(selectedCustomer, hist)}
                            disabled={!onUseMeasurementForOrder}
                          >
                            استخدام لهذا الطلب فقط
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="bg-[#F9FAFB] p-2.5 rounded-lg border border-[#F3F4F6]">
                            <span className="text-[10px] font-bold text-[#6B7280] block mb-1">طول أمام</span>
                            <span className="text-sm font-black text-[#111111] font-mono">{hist.measurements.frontLength || '--'}</span>
                          </div>
                          <div className="bg-[#F9FAFB] p-2.5 rounded-lg border border-[#F3F4F6]">
                            <span className="text-[10px] font-bold text-[#6B7280] block mb-1">الكتف</span>
                            <span className="text-sm font-black text-[#111111] font-mono">{hist.measurements.shoulderWidth || '--'}</span>
                          </div>
                          <div className="bg-[#F9FAFB] p-2.5 rounded-lg border border-[#F3F4F6]">
                            <span className="text-[10px] font-bold text-[#6B7280] block mb-1">الكم</span>
                            <span className="text-sm font-black text-[#111111] font-mono">{hist.measurements.sleeveLength || '--'}</span>
                          </div>
                          <div className="bg-[#F9FAFB] p-2.5 rounded-lg border border-[#F3F4F6]">
                            <span className="text-[10px] font-bold text-[#6B7280] block mb-1">الرقبة</span>
                            <span className="text-sm font-black text-[#111111] font-mono">{hist.measurements.neckSize || '--'}</span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="view-wrapper animate-in fade-in duration-300">
      <div className="page-header">
        <h2 className="page-title flex items-center gap-3">
          <Users className="w-7 h-7 text-[#111111]" />
          إدارة العملاء والمقاسات
        </h2>
        <p className="page-subtitle">قاعدة بيانات العملاء المسجلين وتاريخ مقاساتهم</p>
      </div>

      <Card className="p-4 bg-[#F9FAFB]/50 border-dashed">
        <div className="relative max-w-lg">
          <Input
            placeholder="بحث باسم العميل أو رقم الجوال..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search className="w-5 h-5" />}
            className="h-11 border-dashed"
          />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <EmptyState
            icon={<Users className="w-8 h-8" />}
            title={searchTerm.trim() ? 'لا يوجد عميل مطابق لبحثك' : 'لا يوجد عملاء'}
            description={searchTerm.trim() ? 'جرّب البحث باسم العميل أو رقم الجوال بطريقة مختلفة.' : 'يتم إنشاء العميل تلقائياً من شاشة تسجيل طلب جديد عند حفظ الاسم والجوال والمقاسات.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>اسم العميل</th>
                  <th>رقم الجوال</th>
                  <th className="text-center">الطول الأمامي</th>
                  <th className="text-center">عرض الكتف</th>
                  <th className="text-center">نوع الرقبة</th>
                  <th className="text-center">تاريخ التسجيل</th>
                  <th className="text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((cust) => (
                  <tr key={cust.id}>
                    <td>
                      <div className="font-black text-[#111111] text-sm">{cust.name}</div>
                      <div className="text-[10px] text-[#9CA3AF] font-bold mt-0.5">#{cust.id.split('-').pop()}</div>
                    </td>
                    <td className="font-black font-mono text-[#4B5563]">{cust.phone}</td>
                    <td className="text-center font-black text-[#111111]">
                      {cust.measurements.frontLength ? (
                        <span className="bg-[#F3F4F6] px-2 py-1 rounded text-xs font-mono">{cust.measurements.frontLength}"</span>
                      ) : '--'}
                    </td>
                    <td className="text-center font-black text-[#111111]">
                      {cust.measurements.shoulderWidth ? (
                        <span className="bg-[#F3F4F6] px-2 py-1 rounded text-xs font-mono">{cust.measurements.shoulderWidth}"</span>
                      ) : '--'}
                    </td>
                    <td className="text-center font-bold text-[#6B7280]">
                      {cust.styleDetails.neckType || '--'}
                    </td>
                    <td className="text-center text-[#9CA3AF] font-mono text-[11px] font-bold">{cust.createdAt}</td>
                    <td className="text-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenEditModal(cust)}
                        icon={<Eye className="w-3.5 h-3.5" />}
                      >
                        عرض التفاصيل
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={() => {
          if (selectedCustomer) {
            onDeleteCustomer(selectedCustomer.id);
            setIsDeleteConfirmOpen(false);
            setIsFormOpen(false);
            showToast('تم حذف ملف العميل بنجاح', 'success');
          }
        }}
        title="حذف ملف عميل"
        message={`هل أنت متأكد من حذف العميل "${selectedCustomer?.name}"؟ سيؤدي هذا لحذف كافة سجلات مقاساته أيضاً.`}
        confirmLabel="نعم، احذف العميل"
        variant="danger"
      />
    </div>
  );
};
