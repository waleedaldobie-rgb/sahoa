import React, { useEffect, useMemo, useState } from 'react';
import { CustomerMeasurements, CustomerStyleDetails } from '../types';
import { Check, Ruler, Scissors } from 'lucide-react';
import { NeckDrawing, JabzourDrawing, HemDrawing, PocketDrawing } from './InvoiceDrawings';

interface MeasurementsTableFormProps {
  measurements: CustomerMeasurements;
  onChange: (updated: CustomerMeasurements) => void;
  styleDetails?: CustomerStyleDetails;
  onStyleChange?: (updated: CustomerStyleDetails) => void;
  customerName?: string;
  customerPhone?: string;
  draftScope?: string;
  thobeTypeName?: string;
  onThobeTypeNameChange?: (value: string) => void;
  garmentCount?: number;
  title?: string;
  subtitle?: string;
  showSyncCheckbox?: boolean;
  syncWithCustomer?: boolean;
  onSyncChange?: (sync: boolean) => void;
  onSave?: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  isSaving?: boolean;
}

const CONTROL_H = 'h-10'; 
const inputClass = `${CONTROL_H} bg-white border-2 border-[#111111] rounded-xl px-2 text-center text-[15px] font-black text-[#111111] focus:outline-none focus:bg-[#111111] focus:text-white focus:ring-4 focus:ring-[#111111]/5 transition-all duration-200 shadow-sm`;

const rowClass = 'flex items-center gap-3 flex-wrap sm:flex-nowrap py-3 border-b border-[#F3F4F6] last:border-b-0 min-w-0 group';
const labelClass = 'text-[13px] font-black text-[#111111] whitespace-nowrap shrink-0 transition-all group-hover:translate-x-[-2px]';

const emptyStyleDetails = (): CustomerStyleDetails => ({
  neckSizeHeader: '', neckHeightHeader: '', neckType: '', neckShape: '', neckPadding: '', neckLining: '', neckNotes: '',
  buttonsType: '', habroorType: '', habroorPadding: '', habroorLining: '', habroorStyle: '', habroorBottom: '',
  sleeveCuffLength: '', sleevePlainLength: '', sleeveType: '', sleevePadding: '', sleeveShape: '', sleeveLining: '', pleatsStyle: '', sleeveNotes: '',
  chestPocketDrop: '', chestPocketWidth: '', chestPocketPadding: '', chestPocketStyle: '', chestLining: '', pocketNotes: '',
  sidePockets: '', mobilePocketRight: '', mobilePocketLeft: '', penPocketStyle: '', rightSide: '', leftSide: '', bottomHemShape: '',
  cuff1: '', cuff2: '', cuff3: '', cuff4: '', cuff5: '', stitchingType: '', richieMark: '', generalNotes: '', additionalNotes: '',
});

const OptionChip: React.FC<{ label: string; selected: boolean; onClick: () => void }> = ({ label, selected, onClick }) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onClick}
    className={`${CONTROL_H} px-4 rounded-xl border-2 text-[11px] font-black whitespace-nowrap inline-flex items-center gap-2 transition-all duration-200 active:scale-95 cursor-pointer ${
      selected
        ? 'bg-[#111111] border-[#111111] text-white shadow-md'
        : 'bg-white border-[#E5E7EB] text-[#6B7280] hover:border-[#111111] hover:text-[#111111]'
    }`}
  >
    {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
    {label}
  </button>
);

const DrawingBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="shrink-0 w-20 h-24 rounded-2xl border-2 border-[#111111] bg-[#F9FAFB] flex items-center justify-center p-2 text-[#111111] shadow-sm group-hover:bg-white transition-colors">
    {children}
  </div>
);

const Section: React.FC<{ title: string; icon?: React.ReactNode; className?: string; children: React.ReactNode }> = ({
  title,
  icon,
  className = '',
  children,
}) => (
  <section className={`min-w-0 border-2 border-[#111111] bg-white rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 ${className}`}>
    <h4 className="flex items-center gap-3 text-[14px] font-black text-white bg-[#111111] p-4">
      {icon}
      {title}
    </h4>
    <div className="p-6 space-y-1">{children}</div>
  </section>
);

export const draftKeyFor = (customerName?: string, customerPhone?: string, scope: string = 'new') =>
  `sahwa_measurements_draft:${scope}:${(customerName || 'new').trim()}:${(customerPhone || '').trim()}`;

export const MeasurementsTableForm: React.FC<MeasurementsTableFormProps> = ({
  measurements,
  onChange,
  styleDetails,
  onStyleChange,
  thobeTypeName,
  onThobeTypeNameChange,
  customerName,
  customerPhone,
  draftScope = 'new',
  title = 'جدول القياسات',
  subtitle = 'جميع القياسات بالإنش',
  onSave,
  onCancel,
  saveLabel = 'حفظ',
  isSaving = false,
}) => {
  const details = styleDetails || emptyStyleDetails();
  const draftKey = useMemo(
    () => draftKeyFor(customerName, customerPhone, draftScope),
    [customerName, customerPhone, draftScope]
  );
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        measurements?: CustomerMeasurements;
        styleDetails?: CustomerStyleDetails;
        savedAt?: number;
      };
      if (draft.measurements) onChange(draft.measurements);
      if (draft.styleDetails && onStyleChange) onStyleChange(draft.styleDetails);
      setIsDirty(true);
    } catch (err) { }
  }, [draftKey]);

  useEffect(() => {
    if (!isDirty) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          measurements,
          styleDetails: details,
          savedAt: Date.now(),
        }));
      } catch (err) { }
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [measurements, details, draftKey, isDirty]);

  const markChanged = () => setIsDirty(true);

  const updateField = (field: keyof CustomerMeasurements, value: string) => {
    markChanged();
    onChange({ ...measurements, [field]: value });
  };

  const updateStyle = (field: keyof CustomerStyleDetails, value: string) => {
    markChanged();
    onStyleChange?.({ ...details, [field]: value });
  };

  const updateStyleMany = (patch: Partial<CustomerStyleDetails>) => {
    markChanged();
    onStyleChange?.({ ...details, ...patch });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    if (target.tagName !== 'INPUT') return;
    e.preventDefault();
    const inputs = Array.from(e.currentTarget.querySelectorAll('input')) as HTMLInputElement[];
    const index = inputs.indexOf(target as HTMLInputElement);
    if (index >= 0 && index + 1 < inputs.length) inputs[index + 1].focus();
  };

  const NumberRow = (label: string, field: keyof CustomerMeasurements, tooltip?: string) => (
    <div className={rowClass}>
      <label className={labelClass} title={tooltip}>{label}</label>
      <input
        type="text"
        inputMode="decimal"
        value={measurements[field] || ''}
        onChange={(e) => updateField(field, e.target.value)}
        className={`${inputClass} w-24 mx-2`}
      />
      <div className="flex-1 border-b-2 border-dotted border-[#111111]/20 group-hover:border-[#111111]/40 transition-colors mt-1" />
    </div>
  );

  const neckType = details.neckType || '';
  const neckSubOptions =
    neckType === 'قلاب' ? ['ملكي', 'فرنسي', 'عادي'] : neckType === 'سادة' ? ['مدور دائري', 'مدور بيضاوي'] : [];

  const jabzourOptions: { value: string; label: string }[] = [
    { value: 'باين', label: 'باين' },
    { value: 'وزار مخفي', label: 'وزار مخفي' },
    { value: 'سحاب مخفي', label: 'سحاب مخفي' },
    { value: 'وزرار', label: 'وزرار' },
  ];
  const hemOptions: { value: string; label: string }[] = [
    { value: 'جبزور مثلث', label: 'جبزور مثلث' },
    { value: 'جبزور مربع', label: 'جبزور مربع' },
  ];
  const pocketOptions: { value: string; label: string }[] = [
    { value: 'مربع كلاسيك', label: 'مربع كلاسيك' },
    { value: 'زاوية مسحوبة', label: 'زاوية مسحوبة' },
    { value: 'جيب بغطاء', label: 'جيب بغطاء' },
  ];

  return (
    <div onKeyDown={handleKeyDown} dir="rtl" className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 xl:grid-cols-[2.5fr_1.5fr_1fr] gap-8 items-start">
        {/* RIGHT COLUMN — القياسات الأساسية */}
        <Section title="القياسات الأساسية" icon={<Ruler className="w-5 h-5" />}>
          {NumberRow('طول أمام', 'frontLength')}
          {NumberRow('طول خلف', 'backLength')}
          {NumberRow('قياس الكتف', 'shoulderWidth')}

          <div className={rowClass}>
            <label className={labelClass}>قياس اليد</label>
            <input
              type="text"
              inputMode="decimal"
              value={measurements.sleeveLength || ''}
              onChange={(e) => updateField('sleeveLength', e.target.value)}
              className={`${inputClass} w-20 mx-2`}
            />
            <div className="flex-1 border-b-2 border-dotted border-[#111111]/20 mt-1" />
            <div className="flex items-center gap-1.5 shrink-0 px-2">
              {(['سادة', 'كبك'] as const).map((type) => (
                <OptionChip key={type} label={type} selected={details.sleeveType === type} onClick={() => updateStyle('sleeveType', type)} />
              ))}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {(['cuff1', 'cuff2', 'cuff3', 'cuff4', 'cuff5'] as const).map((field, index) => (
                <div key={field} className="w-10 shrink-0">
                  <label className="block text-[9px] font-black text-[#9CA3AF] text-center mb-1">{index + 1}</label>
                  <input
                    type="text"
                    value={details[field] || ''}
                    onChange={(e) => updateStyle(field, e.target.value)}
                    className={`${inputClass} w-full px-1 text-xs`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className={rowClass}>
            <label className={labelClass}>قياس الرقبة</label>
            <input
              type="text"
              inputMode="decimal"
              value={measurements.neckSize || ''}
              onChange={(e) => updateField('neckSize', e.target.value)}
              className={`${inputClass} w-20 mx-2`}
            />
            <div className="flex-1 border-b-2 border-dotted border-[#111111]/20 mt-1" />
            <div className="flex items-center gap-1.5 shrink-0 px-2">
              {(['سادة', 'قلاب'] as const).map((type) => (
                <OptionChip
                  key={type}
                  label={type}
                  selected={neckType === type}
                  onClick={() => updateStyleMany({ neckType: type, neckShape: '' })}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {neckSubOptions.map((sub) => (
                <OptionChip key={sub} label={sub} selected={details.neckShape === sub} onClick={() => updateStyle('neckShape', sub)} />
              ))}
            </div>
            <DrawingBox>
              <NeckDrawing neckType={neckType} neckShape={details.neckShape} />
            </DrawingBox>
          </div>

          <div className={rowClass}>
            <label className={labelClass}>الوسع</label>
            <input
              type="text"
              inputMode="decimal"
              value={measurements.bottomSweep || ''}
              onChange={(e) => updateField('bottomSweep', e.target.value)}
              className={`${inputClass} w-24 mx-2`}
            />
            <div className="flex-1 border-b-2 border-dotted border-[#111111]/20 mt-1" />
            <div className="flex items-center gap-3 mr-4">
               <span className="text-[11px] font-black text-[#6B7280]">نوع الثوب:</span>
               <input 
                value={thobeTypeName} 
                onChange={(e) => onThobeTypeNameChange?.(e.target.value)}
                className="bg-[#F9FAFB] border-2 border-[#E5E7EB] rounded-xl px-4 h-10 text-xs font-black text-[#111111] focus:border-[#111111] outline-none min-w-[180px]"
                placeholder="ثوب سعودي كلاسيك..."
               />
            </div>
          </div>
        </Section>

        {/* MIDDLE COLUMN — تفاصيل التفصيل والرسومات */}
        <Section title="تفاصيل التفصيل" icon={<Scissors className="w-5 h-5" />}>
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-[#6B7280] uppercase tracking-wider">الجبزور</label>
                <div className="flex gap-1.5">
                  {jabzourOptions.map((opt) => (
                    <OptionChip key={opt.value} label={opt.label} selected={details.habroorType === opt.value} onClick={() => updateStyle('habroorType', opt.value)} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <DrawingBox><JabzourDrawing type={details.habroorType} /></DrawingBox>
                <div className="flex-1 space-y-2">
                   <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-[#111111]">شكل الجبزور:</span>
                      <div className="flex gap-1.5">
                        {hemOptions.map((opt) => (
                          <OptionChip key={opt.value} label={opt.label} selected={details.bottomHemShape === opt.value} onClick={() => updateStyle('bottomHemShape', opt.value)} />
                        ))}
                      </div>
                   </div>
                   <div className={rowClass}>
                      <label className="text-[11px] font-black text-[#111111]">التخاليص:</label>
                      <input
                        type="text"
                        value={measurements.clearances || ''}
                        onChange={(e) => updateField('clearances', e.target.value)}
                        className={`${inputClass} w-16 mx-2`}
                      />
                      <div className="flex-1 border-b-2 border-dotted border-[#111111]/20 mt-1" />
                   </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-[#F3F4F6]">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-[#6B7280] uppercase tracking-wider">الجيب</label>
                <div className="flex gap-1.5">
                  {pocketOptions.map((opt) => (
                    <OptionChip key={opt.value} label={opt.label} selected={details.chestPocketStyle === opt.value} onClick={() => updateStyle('chestPocketStyle', opt.value)} />
                  ))}
                </div>
              </div>
              <DrawingBox><PocketDrawing type={details.chestPocketStyle} /></DrawingBox>
            </div>
          </div>
        </Section>

        {/* LEFT COLUMN — باقي القياسات */}
        <Section title="باقي القياسات" className="h-full">
          <div className="flex flex-col h-full">
            {NumberRow('ميلان الكتف', 'shoulderSlope')}
            {NumberRow('الورك', 'hipSize')}
            {NumberRow('الصدر', 'chestSize')}
            
            <div className="mt-auto pt-6">
              <div className="bg-[#111111] text-white p-5 rounded-2xl text-center shadow-lg transform hover:scale-[1.02] transition-transform">
                <label className="block text-[11px] font-black opacity-60 uppercase tracking-widest mb-2">الخطوة</label>
                <input
                  type="text"
                  value={measurements.stepSize || ''}
                  onChange={(e) => updateField('stepSize', e.target.value)}
                  className="bg-white/10 border-2 border-white/20 rounded-xl w-full h-12 text-center text-2xl font-black text-white focus:bg-white focus:text-[#111111] focus:border-white outline-none transition-all"
                  placeholder="00"
                />
              </div>
            </div>
          </div>
        </Section>
      </div>

      {onSave && (
        <div className="flex items-center justify-end gap-4 pt-6 border-t-4 border-[#111111]">
          {onCancel && <Button variant="ghost" onClick={onCancel}>إلغاء</Button>}
          <Button variant="primary" size="lg" onClick={onSave} isLoading={isSaving} icon={<Check className="w-5 h-5" />}>
            {saveLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
