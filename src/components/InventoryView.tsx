import React, { useState } from 'react';
import { FabricItem, AccessoryItem, ThobeType, ColorItem, StockMovement, InventoryItemType } from '../types';
import { Card, Button, Input, Select, Modal, Badge, EmptyState } from './ui';
import { ConfirmModal } from './ConfirmModal';
import {
  Package,
  Layers,
  Plus,
  Palette,
  Scissors,
  Database,
  ClipboardList,
  Edit2,
  Trash2
} from 'lucide-react';

export interface InventoryViewProps {
  fabrics: FabricItem[];
  accessories: AccessoryItem[];
  thobeTypes: ThobeType[];
  colors: ColorItem[];
  onSaveFabric: (fabric: FabricItem) => void;
  onDeleteFabric: (id: string) => void;
  onSaveAccessory: (accessory: AccessoryItem) => void;
  onDeleteAccessory: (id: string) => void;
  onSaveThobeType: (thobeType: ThobeType) => void;
  onDeleteThobeType: (id: string) => void;
  onSaveColor: (color: ColorItem) => void;
  onDeleteColor: (id: string) => void;
  stockMovements?: StockMovement[];
  onAdjustStock?: (itemType: InventoryItemType, itemId: string, quantity: number, reason: string, direction: 'adjustment' | 'return') => Promise<void> | void;
  showToast: (msg: string, type: 'success' | 'danger' | 'warning' | 'info') => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  fabrics,
  accessories,
  thobeTypes,
  colors,
  onSaveFabric,
  onDeleteFabric,
  onSaveAccessory,
  onDeleteAccessory,
  onSaveThobeType,
  onDeleteThobeType,
  onSaveColor,
  onDeleteColor,
  stockMovements = [],
  onAdjustStock,
  showToast
}) => {
  const [activeTab, setActiveTab] = useState<'fabrics' | 'accessories' | 'models' | 'movements'>('fabrics');
  const [movementType, setMovementType] = useState<InventoryItemType>('fabric');
  const [movementItemId, setMovementItemId] = useState('');
  const [movementQuantity, setMovementQuantity] = useState('');
  const [movementDirection, setMovementDirection] = useState<'adjustment' | 'return'>('adjustment');
  const [movementReason, setMovementReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'fabric' | 'accessory' | 'thobeType' | 'color'; id: string; name: string } | null>(null);

  // Fabric Modal State
  const [isFabricModalOpen, setIsFabricModalOpen] = useState(false);
  const [fabricForm, setFabricForm] = useState<FabricItem>({
    id: '',
    name: '',
    color: 'أبيض نص لمعة',
    purchasePrice: 40,
    sellingPrice: 100,
    quantityMeters: 50,
    minStockMeters: 20
  });

  // Accessory Modal State
  const [isAccessoryModalOpen, setIsAccessoryModalOpen] = useState(false);
  const [accessoryForm, setAccessoryForm] = useState<AccessoryItem>({
    id: '',
    name: '',
    category: 'أزرار',
    quantity: 10,
    minStock: 5,
    unit: 'حبة'
  });

  // Thobe Type Modal State
  const [isThobeTypeModalOpen, setIsThobeTypeModalOpen] = useState(false);
  const [thobeTypeForm, setThobeTypeForm] = useState<ThobeType>({
    id: '',
    name: '',
    defaultPrice: 220,
    description: ''
  });

  // Color Modal State
  const [isColorModalOpen, setIsColorModalOpen] = useState(false);
  const [colorForm, setColorForm] = useState<ColorItem>({
    id: '',
    name: '',
    hex: '#ffffff'
  });

  // HANDLERS
  const handleOpenAddFabric = () => {
    setFabricForm({ id: '', name: '', color: 'أبيض نص لمعة', purchasePrice: 40, sellingPrice: 110, quantityMeters: 50, minStockMeters: 20 });
    setIsFabricModalOpen(true);
  };

  const handleOpenEditFabric = (f: FabricItem) => {
    setFabricForm({ ...f });
    setIsFabricModalOpen(true);
  };

  const handleSaveFabricSubmit = () => {
    if (!fabricForm.name.trim()) {
      showToast('يرجى أدخال اسم القماش', 'danger');
      return;
    }
    onSaveFabric({ ...fabricForm, id: fabricForm.id || 'FAB-' + Date.now() });
    showToast('تم حفظ القماش بنجاح', 'success');
    setIsFabricModalOpen(false);
  };

  const handleOpenAddAccessory = () => {
    setAccessoryForm({ id: '', name: '', category: 'أزرار', quantity: 50, minStock: 10, unit: 'حبة' });
    setIsAccessoryModalOpen(true);
  };

  const handleOpenEditAccessory = (acc: AccessoryItem) => {
    setAccessoryForm({ ...acc });
    setIsAccessoryModalOpen(true);
  };

  const handleOpenAddThobeType = () => {
    setThobeTypeForm({ id: '', name: '', defaultPrice: 220, description: '' });
    setIsThobeTypeModalOpen(true);
  };

  const handleOpenEditThobeType = (t: ThobeType) => {
    setThobeTypeForm({ ...t });
    setIsThobeTypeModalOpen(true);
  };

  const handleOpenAddColor = () => {
    setColorForm({ id: '', name: '', hex: '#ffffff' });
    setIsColorModalOpen(true);
  };

  const handleOpenEditColor = (c: ColorItem) => {
    setColorForm({ ...c });
    setIsColorModalOpen(true);
  };

  const handleSaveAccessorySubmit = () => {
    if (!accessoryForm.name.trim()) {
      showToast('يرجى كتابة اسم الصنف', 'danger');
      return;
    }
    onSaveAccessory({ ...accessoryForm, id: accessoryForm.id || 'ACC-' + Date.now() });
    showToast('تم حفظ صنف الإكسسوار بنجاح', 'success');
    setIsAccessoryModalOpen(false);
  };

  const handleSaveThobeTypeSubmit = () => {
    if (!thobeTypeForm.name.trim()) {
      showToast('يرجى كتابة اسم الموديل', 'danger');
      return;
    }
    onSaveThobeType({ ...thobeTypeForm, id: thobeTypeForm.id || 'THB-' + Date.now() });
    showToast('تم حفظ موديل الثوب بنجاح', 'success');
    setIsThobeTypeModalOpen(false);
  };

  const handleSaveColorSubmit = () => {
    if (!colorForm.name.trim()) return;
    onSaveColor({ ...colorForm, id: colorForm.id || 'COL-' + Date.now() });
    showToast('تم حفظ اللون بنجاح', 'success');
    setIsColorModalOpen(false);
  };

  const handleAdjustStockSubmit = async () => {
    const quantity = Number(movementQuantity);
    if (!movementItemId || !movementReason.trim() || !Number.isFinite(quantity) || quantity === 0) {
      showToast('اختر الصنف وأدخل كمية وسبباً صحيحاً للتسوية', 'danger');
      return;
    }
    if (!onAdjustStock) return;
    await onAdjustStock(movementType, movementItemId, quantity, movementReason, movementDirection);
    setMovementQuantity('');
    setMovementReason('');
    showToast('تم تسجيل حركة التسوية بنجاح', 'success');
  };

  const movementItems = movementType === 'fabric' ? fabrics : accessories;

  return (
    <div className="view-wrapper animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="page-header">
          <h2 className="page-title flex items-center gap-3">
            <Database className="w-7 h-7 text-[#111111]" />
            المخزون والأصناف
          </h2>
          <p className="page-subtitle">إدارة الأقمشة، الإكسسوارات، وموديلات الثياب</p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'fabrics' && (
            <Button variant="primary" onClick={handleOpenAddFabric} icon={<Plus className="w-4 h-4" />} size="lg">
              إضافة قماش جديد
            </Button>
          )}
          {activeTab === 'accessories' && (
            <Button variant="primary" onClick={handleOpenAddAccessory} icon={<Plus className="w-4 h-4" />} size="lg">
              إضافة إكسسوار
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-xl w-fit">
        {[
          { id: 'fabrics', label: 'الأقمشة', icon: <Layers className="w-4 h-4" /> },
          { id: 'accessories', label: 'الإكسسوارات', icon: <Package className="w-4 h-4" /> },
          { id: 'models', label: 'الموديلات والألوان', icon: <Scissors className="w-4 h-4" /> },
          { id: 'movements', label: 'حركة المخزون', icon: <Database className="w-4 h-4" /> }
        ].map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            aria-pressed={activeTab === tab.id}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            className={`px-6 py-2.5 rounded-lg text-xs font-black transition-all duration-200 flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b08a4a] focus-visible:ring-offset-2 ${
              activeTab === tab.id ? 'bg-white text-[#111111] shadow-sm' : 'text-[#6B7280] hover:text-[#111111]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'fabrics' && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>اسم القماش</th>
                  <th>اللون</th>
                  <th className="text-center">سعر البيع</th>
                  <th className="text-center">المخزون</th>
                  <th>الحالة</th>
                  <th className="text-center">إجراءات</th>
                </tr>
              </thead>
                <tbody>
                {fabrics.length === 0 ? (
                  <tr><td colSpan={6}><EmptyState icon={<Layers className="w-7 h-7" />} title="لا توجد أقمشة بعد" description="أضف أول قماش لتبدأ متابعة الأسعار والكميات وحالة المخزون." action={<Button size="sm" variant="primary" onClick={handleOpenAddFabric} icon={<Plus className="w-4 h-4" />}>إضافة قماش</Button>} className="my-4" /></td></tr>
                ) : fabrics.map((fab) => {
                  const isLowStock = fab.quantityMeters <= fab.minStockMeters;
                  return (
                    <tr key={fab.id}>
                      <td className="font-black text-[#111111]">{fab.name}</td>
                      <td className="font-bold text-[#4B5563]">{fab.color}</td>
                      <td className="text-center font-black text-emerald-600 font-mono">{fab.sellingPrice} ر.س</td>
                      <td className="text-center font-black font-mono">
                        <span className={isLowStock ? 'text-rose-600' : 'text-[#111111]'}>{fab.quantityMeters} متر</span>
                      </td>
                      <td>
                        <Badge variant={isLowStock ? 'amber' : 'emerald'}>
                          {isLowStock ? 'مخزون منخفض' : 'متوفر'}
                        </Badge>
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="secondary" size="sm" onClick={() => handleOpenEditFabric(fab)}>تعديل</Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget({ type: 'fabric', id: fab.id, name: fab.name })} className="text-rose-600 hover:bg-rose-50">حذف</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'accessories' && (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>اسم الإكسسوار</th>
                  <th>الفئة</th>
                  <th className="text-center">الكمية</th>
                  <th>الحالة</th>
                  <th className="text-center">إجراءات</th>
                </tr>
              </thead>
                <tbody>
                {accessories.length === 0 ? (
                  <tr><td colSpan={5}><EmptyState icon={<Package className="w-7 h-7" />} title="لا توجد إكسسوارات بعد" description="أضف أول إكسسوار لتسجيل الكميات والحد الأدنى للمخزون." action={<Button size="sm" variant="primary" onClick={handleOpenAddAccessory} icon={<Plus className="w-4 h-4" />}>إضافة إكسسوار</Button>} className="my-4" /></td></tr>
                ) : accessories.map((acc) => {
                  const isLowStock = acc.quantity <= acc.minStock;
                  return (
                    <tr key={acc.id}>
                      <td className="font-black text-[#111111]">{acc.name}</td>
                      <td className="font-bold text-[#4B5563]">{acc.category}</td>
                      <td className="text-center font-black font-mono">
                        <span className={isLowStock ? 'text-rose-600' : 'text-[#111111]'}>{acc.quantity} {acc.unit}</span>
                      </td>
                      <td>
                        <Badge variant={isLowStock ? 'amber' : 'emerald'}>
                          {isLowStock ? 'كمية منخفضة' : 'متوفر'}
                        </Badge>
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button variant="secondary" size="sm" onClick={() => handleOpenEditAccessory(acc)}>تعديل</Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget({ type: 'accessory', id: acc.id, name: acc.name })} className="text-rose-600 hover:bg-rose-50">حذف</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'models' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card title="موديلات الثياب" headerIcon={<Scissors className="w-5 h-5" />}>
             <div className="space-y-4">
                {thobeTypes.length === 0 && <EmptyState icon={<Scissors className="w-7 h-7" />} title="لا توجد موديلات بعد" description="أضف موديل الثوب الأول لتظهر خياراته في الطلبات." className="my-0" />}
                {thobeTypes.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
                    <div className="flex-1">
                      <div className="font-black text-[#111111]">{t.name}</div>
                      <div className="text-[10px] text-[#6B7280] font-bold">{t.description || 'لا يوجد وصف'}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm font-black font-mono text-emerald-600">{t.defaultPrice} ر.س</div>
                      <div className="flex gap-1">
                        <button type="button" title={`تعديل موديل ${t.name}`} aria-label={`تعديل موديل ${t.name}`} onClick={() => handleOpenEditThobeType(t)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button type="button" title={`حذف موديل ${t.name}`} aria-label={`حذف موديل ${t.name}`} onClick={() => setDeleteTarget({ type: 'thobeType', id: t.id, name: t.name })} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline-dark" className="w-full border-dashed" onClick={handleOpenAddThobeType}>+ إضافة موديل جديد</Button>
             </div>
          </Card>

          <Card title="الألوان المتاحة" headerIcon={<Palette className="w-5 h-5" />}>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {colors.length === 0 && <div className="sm:col-span-2"><EmptyState icon={<Palette className="w-7 h-7" />} title="لا توجد ألوان بعد" description="أضف لونًا لتسهيل اختيار القماش في الطلبات." className="my-0" /></div>}
                {colors.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full border border-[#E5E7EB] shadow-sm" style={{ backgroundColor: c.hex }}></div>
                      <span className="text-xs font-black text-[#111111]">{c.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" title={`تعديل لون ${c.name}`} aria-label={`تعديل لون ${c.name}`} onClick={() => handleOpenEditColor(c)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button type="button" title={`حذف لون ${c.name}`} aria-label={`حذف لون ${c.name}`} onClick={() => setDeleteTarget({ type: 'color', id: c.id, name: c.name })} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  aria-label="إضافة لون جديد"
                  onClick={handleOpenAddColor}
                  className="flex items-center justify-center gap-2 p-3 bg-white border-2 border-dashed border-[#E5E7EB] rounded-xl text-xs font-black text-[#6B7280] hover:border-[#111111] hover:text-[#111111] transition-all"
                >
                  + إضافة لون
                </button>
             </div>
          </Card>
        </div>
      )}

      {activeTab === 'movements' && (
        <div className="space-y-6">
          <Card title="تسوية مخزون مصرح بها" subtitle="تستخدم للزيادة أو النقص بعد التحقق الفعلي من الكمية" headerIcon={<Database className="w-5 h-5" />}>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <Select label="نوع الصنف" value={movementType} onChange={(e) => { setMovementType(e.target.value as InventoryItemType); setMovementItemId(''); }}><option value="fabric">قماش</option><option value="accessory">مستلزم / إكسسوار</option></Select>
              <Select label="الصنف" value={movementItemId} onChange={(e) => setMovementItemId(e.target.value)}><option value="">اختر الصنف</option>{movementItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
              <Input label="الكمية" type="number" step="0.01" value={movementQuantity} onChange={(e) => setMovementQuantity(e.target.value)} placeholder="النقص بالسالب" />
              <Select label="نوع الحركة" value={movementDirection} onChange={(e) => setMovementDirection(e.target.value as 'adjustment' | 'return')}><option value="adjustment">تسوية زيادة / نقص</option><option value="return">إرجاع</option></Select>
              <div className="flex gap-2"><Input label="السبب" value={movementReason} onChange={(e) => setMovementReason(e.target.value)} placeholder="جرد فعلي" /><Button type="button" className="h-12" onClick={handleAdjustStockSubmit}>حفظ</Button></div>
            </div>
          </Card>
          <Card title="سجل حركة كل صنف" subtitle="شراء، صرف للطلبات، إرجاع وتسويات مع الرصيد قبل وبعد الحركة" headerIcon={<ClipboardList className="w-5 h-5" />}>
            <div className="overflow-x-auto"><table className="premium-table"><caption className="sr-only">سجل حركة المخزون</caption><thead><tr><th>التاريخ والوقت</th><th>الصنف</th><th>الحركة</th><th>الكمية</th><th>قبل</th><th>بعد</th><th>السبب</th><th>المرجع</th></tr></thead><tbody>{stockMovements.length === 0 ? <tr><td colSpan={8} className="p-10 text-center text-slate-400 font-bold"><div className="space-y-2"><ClipboardList className="w-8 h-8 mx-auto text-slate-300" /><p>لا توجد حركات مخزون بعد</p><p className="text-xs font-medium">ستظهر هنا عمليات الشراء والصرف والإرجاع والتسوية.</p></div></td></tr> : stockMovements.map((movement) => <tr key={movement.id}><td className="text-xs font-bold">{new Date(movement.createdAt).toLocaleString('ar-SA')}</td><td className="font-black">{movement.itemName}</td><td><Badge variant={movement.direction === 'purchase' || movement.direction === 'return' ? 'emerald' : movement.direction === 'sale' ? 'red' : 'slate'}>{movement.direction === 'purchase' ? 'شراء' : movement.direction === 'sale' ? 'صرف طلب' : movement.direction === 'return' ? 'إرجاع' : 'تسوية'}</Badge></td><td className="font-black">{movement.quantity} {movement.unit}</td><td>{movement.quantityBefore}</td><td className="font-black">{movement.quantityAfter}</td><td>{movement.reason}</td><td className="text-xs">{movement.referenceNumber || movement.referenceId || '—'}</td></tr>)}</tbody></table></div>
          </Card>
        </div>
      )}

      {/* Modals */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            if (deleteTarget.type === 'fabric') onDeleteFabric(deleteTarget.id);
            else if (deleteTarget.type === 'accessory') onDeleteAccessory(deleteTarget.id);
            else if (deleteTarget.type === 'thobeType') onDeleteThobeType(deleteTarget.id);
            else if (deleteTarget.type === 'color') onDeleteColor(deleteTarget.id);
            setDeleteTarget(null);
            showToast('تم الحذف بنجاح', 'success');
          }
        }}
        title="تأكيد الحذف"
        message={`هل أنت متأكد من حذف "${deleteTarget?.name}"؟`}
      />
      
      <Modal isOpen={isFabricModalOpen} onClose={() => setIsFabricModalOpen(false)} title={fabricForm.id ? 'تعديل قماش' : 'إضافة قماش جديد'}>
        <div className="space-y-4">
          <Input label="اسم القماش *" value={fabricForm.name} onChange={e => setFabricForm({...fabricForm, name: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="اللون" value={fabricForm.color} onChange={e => setFabricForm({...fabricForm, color: e.target.value})} />
            <Input label="المخزون (متر)" type="number" value={fabricForm.quantityMeters} onChange={e => setFabricForm({...fabricForm, quantityMeters: Number(e.target.value)})} />
          </div>
          <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-[#F3F4F6]"><Button variant="ghost" onClick={() => setIsFabricModalOpen(false)}>إلغاء</Button><Button variant="primary" onClick={handleSaveFabricSubmit}>حفظ البيانات</Button></div>
        </div>
      </Modal>

      <Modal isOpen={isAccessoryModalOpen} onClose={() => setIsAccessoryModalOpen(false)} title={accessoryForm.id ? 'تعديل إكسسوار' : 'إضافة إكسسوار جديد'}>
        <div className="space-y-4">
          <Input label="اسم الصنف *" value={accessoryForm.name} onChange={e => setAccessoryForm({...accessoryForm, name: e.target.value})} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="الفئة" value={accessoryForm.category} onChange={e => setAccessoryForm({...accessoryForm, category: e.target.value as any})}>
              <option value="أزرار">أزرار</option>
              <option value="خيوط">خيوط</option>
              <option value="إكسسوارات أخرى">إكسسوارات أخرى</option>
            </Select>
            <Input label="الكمية" type="number" value={accessoryForm.quantity} onChange={e => setAccessoryForm({...accessoryForm, quantity: Number(e.target.value)})} />
          </div>
          <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-[#F3F4F6]"><Button variant="ghost" onClick={() => setIsAccessoryModalOpen(false)}>إلغاء</Button><Button variant="primary" onClick={handleSaveAccessorySubmit}>حفظ الإكسسوار</Button></div>
        </div>
      </Modal>

      <Modal isOpen={isThobeTypeModalOpen} onClose={() => setIsThobeTypeModalOpen(false)} title={thobeTypeForm.id ? "تعديل موديل ثوب" : "إضافة موديل ثوب جديد"}>
        <div className="space-y-4">
          <Input label="اسم الموديل *" value={thobeTypeForm.name} onChange={e => setThobeTypeForm({...thobeTypeForm, name: e.target.value})} />
          <Input label="السعر الافتراضي (ر.س)" type="number" value={thobeTypeForm.defaultPrice} onChange={e => setThobeTypeForm({...thobeTypeForm, defaultPrice: Number(e.target.value)})} />
          <Input label="الوصف" value={thobeTypeForm.description || ''} onChange={e => setThobeTypeForm({...thobeTypeForm, description: e.target.value})} />
          <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-[#F3F4F6]"><Button variant="ghost" onClick={() => setIsThobeTypeModalOpen(false)}>إلغاء</Button><Button variant="primary" onClick={handleSaveThobeTypeSubmit}>{thobeTypeForm.id ? 'حفظ التغييرات' : 'إضافة الموديل'}</Button></div>
        </div>
      </Modal>

      <Modal isOpen={isColorModalOpen} onClose={() => setIsColorModalOpen(false)} title={colorForm.id ? "تعديل لون" : "إضافة لون جديد"}>
        <div className="space-y-4">
          <Input label="اسم اللون *" value={colorForm.name} onChange={e => setColorForm({...colorForm, name: e.target.value})} />
          <Input label="كود اللون (Hex)" value={colorForm.hex} onChange={e => setColorForm({...colorForm, hex: e.target.value})} />
          <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-[#F3F4F6]"><Button variant="ghost" onClick={() => setIsColorModalOpen(false)}>إلغاء</Button><Button variant="primary" onClick={handleSaveColorSubmit}>{colorForm.id ? 'حفظ التغييرات' : 'إضافة اللون'}</Button></div>
        </div>
      </Modal>
    </div>
  );
};
