import React from 'react';
import { AppData, Order } from '../types';
import { Card, Badge, Button, EmptyState } from './ui';
import {
  Scissors,
  Clock,
  CheckCircle2,
  PackageCheck,
  AlertTriangle,
  Calendar,
  Package,
  Plus,
  LayoutDashboard
} from 'lucide-react';

export interface DashboardViewProps {
  data: AppData;
  onNavigateTab: (tab: string) => void;
  onSelectOrder: (order: Order) => void;
  onOpenNewOrderModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  onNavigateTab,
  onSelectOrder,
  onOpenNewOrderModal
}) => {
  const { orders, fabrics, accessories } = data;

  // Stat Counters
  const newCount = orders.filter((o) => o.status === 'new').length;
  const processingCount = orders.filter((o) => o.status === 'processing').length;
  const readyCount = orders.filter((o) => o.status === 'ready').length;
  const deliveredCount = orders.filter((o) => o.status === 'delivered').length;

  // Inventory Alerts
  const lowStockFabrics = fabrics.filter((f) => f.quantityMeters <= f.minStockMeters);
  const lowStockAccessories = accessories.filter((a) => a.quantity <= a.minStock);

  // Due / Overdue Orders (Delivery date <= today and not delivered)
  const todayStr = new Date().toISOString().split('T')[0];
  const dueOrders = orders.filter((o) => o.status !== 'delivered' && o.deliveryDate <= todayStr);

  // Recent 6 orders
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'new':
        return <Badge variant="amber">جديد</Badge>;
      case 'processing':
        return <Badge variant="slate">تحت التنفيذ</Badge>;
      case 'ready':
        return <Badge variant="emerald">جاهز للتسليم</Badge>;
      case 'delivered':
        return <Badge variant="slate">تم التسليم</Badge>;
    }
  };

  return (
    <div className="view-wrapper">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="page-header">
          <h2 className="page-title flex items-center gap-3">
            <LayoutDashboard className="w-7 h-7 text-[#111111]" />
            لوحة التحكم
          </h2>
          <p className="page-subtitle">نظرة عامة على حالة الطلبات والمخزون في المحل</p>
        </div>
        <Button
          variant="primary"
          onClick={onOpenNewOrderModal}
          icon={<Plus className="w-5 h-5" />}
          size="lg"
        >
          تسجيل طلب جديد
        </Button>
      </div>

      {/* 1. Stat Cards Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'طلبات جديدة', count: newCount, desc: 'بانتظار التجهيز والقص', icon: <Scissors className="w-6 h-6" />, color: 'bg-[#F9FAFB] text-[#111111]' },
          { label: 'تحت التنفيذ', count: processingCount, desc: 'عند الخياطين للتنفيذ', icon: <Clock className="w-6 h-6" />, color: 'bg-amber-50 text-amber-600' },
          { label: 'جاهزة للتسليم', count: readyCount, desc: 'في انتظار حضور العميل', icon: <CheckCircle2 className="w-6 h-6" />, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'تم تسليمها', count: deliveredCount, desc: 'طلبات مكتملة ومسلمة', icon: <PackageCheck className="w-6 h-6" />, color: 'bg-slate-50 text-slate-500' }
        ].map((stat, idx) => (
          <div key={idx} className="bg-white border border-[#E5E7EB] p-6 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[13px] font-black text-[#6B7280] block mb-1">{stat.label}</span>
                <span className="text-3xl font-black text-[#111111] font-mono leading-none">{stat.count}</span>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
                {stat.icon}
              </div>
            </div>
            <p className="text-[11px] text-[#9CA3AF] font-bold mt-4 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40"></span>
              {stat.desc}
            </p>
          </div>
        ))}
      </div>

      {/* 2. Alerts Section (Low Stock & Due Orders) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Due / Overdue Deliveries */}
        <Card
          title="طلبات تسليم اليوم / متأخرة"
          subtitle={`تستحق التسليم بحد أقصى ${todayStr}`}
          headerIcon={<Calendar className="w-5 h-5" />}
          action={
            <Button variant="secondary" size="sm" onClick={() => onNavigateTab('orders')}>
              عرض الكل
            </Button>
          }
        >
          {dueOrders.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="w-6 h-6" />}
              title="لا توجد طلبات متأخرة"
              description="جميع الطلبات تسير وفق جدول التسليم المحدد."
              className="my-0"
            />
          ) : (
            <div className="space-y-3">
              {dueOrders.map((ord) => (
                <div
                  key={ord.id}
                  onClick={() => onSelectOrder(ord)}
                  className="p-4 bg-white hover:bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#111111] rounded-xl flex items-center justify-between cursor-pointer transition-all duration-200 group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#F3F4F6] text-[#111111] flex items-center justify-center text-xs font-black shrink-0 group-hover:bg-[#111111] group-hover:text-white transition-colors">
                      #{ord.orderNumber}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-[#111111]">{ord.customerName}</h4>
                      <p className="text-[11px] text-[#6B7280] mt-0.5 font-bold">
                        {ord.thobeTypeName} • {ord.fabricName}
                      </p>
                    </div>
                  </div>
                  <div className="text-left flex flex-col items-end gap-2">
                    <span className="text-[11px] font-black text-rose-600 font-mono bg-rose-50 px-2 py-0.5 rounded-md">{ord.deliveryDate}</span>
                    {getStatusBadge(ord.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Low Inventory Alerts */}
        <Card
          title="نواقص المخزون"
          subtitle="الأصناف التي وصلت إلى الحد الأدنى"
          headerIcon={<AlertTriangle className="w-5 h-5 text-rose-500" />}
          action={
            <Button variant="secondary" size="sm" onClick={() => onNavigateTab('inventory')}>
              إدارة المخزون
            </Button>
          }
        >
          {lowStockFabrics.length === 0 && lowStockAccessories.length === 0 ? (
            <EmptyState
              icon={<Package className="w-6 h-6" />}
              title="المخزون بمستوى ممتاز"
              description="جميع الأقمشة والإكسسوارات متوفرة بنسب كافية."
              className="my-0"
            />
          ) : (
            <div className="space-y-3">
              {lowStockFabrics.map((f) => (
                <div
                  key={f.id}
                  className="p-4 bg-[#FEF2F2]/40 border border-rose-100 rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white border border-rose-100 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <span className="text-sm font-black text-[#111111] block">قماش: {f.name}</span>
                      <span className="text-[11px] text-[#6B7280] font-bold">اللون: {f.color}</span>
                    </div>
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-black text-rose-600 block font-mono">
                      {f.quantityMeters} متر
                    </span>
                    <span className="text-[10px] text-[#9CA3AF] font-bold">الحد: {f.minStockMeters} متر</span>
                  </div>
                </div>
              ))}

              {lowStockAccessories.map((a) => (
                <div
                  key={a.id}
                  className="p-4 bg-[#FEF2F2]/40 border border-rose-100 rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white border border-rose-100 flex items-center justify-center shrink-0">
                      <Scissors className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <span className="text-sm font-black text-[#111111] block">{a.name}</span>
                      <span className="text-[11px] text-[#6B7280] font-bold">{a.category}</span>
                    </div>
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-black text-rose-600 block font-mono">
                      {a.quantity} {a.unit}
                    </span>
                    <span className="text-[10px] text-[#9CA3AF] font-bold">الحد: {a.minStock} {a.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 3. Recent Orders Table */}
      <Card
        title="آخر الطلبات المسجلة"
        subtitle="متابعة سريعة لأحدث العمليات"
        headerIcon={<Scissors className="w-5 h-5" />}
        className="p-0" // Remove padding to let table be full width
      >
        {recentOrders.length === 0 ? (
          <EmptyState
            icon={<Scissors className="w-6 h-6" />}
            title="لا توجد طلبات مسجلة"
            description="ابدأ بإضافة طلب جديد من الزر أعلاه."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="premium-table">
              <thead>
                <tr>
                  <th className="w-24 text-center">رقم الطلب</th>
                  <th>العميل</th>
                  <th>نوع الثوب</th>
                  <th>تاريخ التسليم</th>
                  <th>المبلغ المتبقي</th>
                  <th>الحالة</th>
                  <th className="text-center">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((ord) => (
                  <tr key={ord.id}>
                    <td className="text-center font-black text-[#111111]">
                      <span className="bg-[#F3F4F6] px-2.5 py-1 rounded-lg text-xs">#{ord.orderNumber}</span>
                    </td>
                    <td>
                      <div className="font-black text-[#111111]">{ord.customerName}</div>
                      <div className="text-[10px] text-[#9CA3AF] font-mono font-bold mt-0.5">{ord.customerPhone}</div>
                    </td>
                    <td className="text-[#4B5563] font-bold">{ord.thobeTypeName}</td>
                    <td className="text-[#4B5563] font-mono font-black">{ord.deliveryDate}</td>
                    <td className="font-black">
                      {ord.remainingAmount > 0 ? (
                        <span className="text-rose-600 font-mono">{ord.remainingAmount} ر.س</span>
                      ) : (
                        <Badge variant="emerald">مدفوع بالكامل</Badge>
                      )}
                    </td>
                    <td>{getStatusBadge(ord.status)}</td>
                    <td className="text-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onSelectOrder(ord)}
                      >
                        عرض
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
