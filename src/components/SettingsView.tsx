import React, { useState } from 'react';
import { UserPreferences } from '../types';
import { Card, Button, Input } from './ui';
import { Store, Phone, MapPin, ImageUp, Trash2, Save, Printer } from 'lucide-react';

export interface SettingsViewProps {
  preferences: UserPreferences;
  onSaveShopSettings: (prefs: Partial<UserPreferences>) => void;
  showToast: (msg: string, type: 'success' | 'danger' | 'warning' | 'info') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  preferences,
  onSaveShopSettings,
  showToast
}) => {
  const [shopName, setShopName] = useState(preferences?.shopName || 'مَشْغَلْ صَهْوَةْ لِلْخِيَاطَةِ الرَّجَالِيَّةِ');
  const [shopAddress, setShopAddress] = useState(preferences?.shopAddress || 'نجران شارع الفيصليه');
  const [shopPhone, setShopPhone] = useState(preferences?.shopPhone || '0500000000');
  const [shopLogoUrl, setShopLogoUrl] = useState<string | undefined>(preferences?.shopLogoUrl);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setShopLogoUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    onSaveShopSettings({
      shopName: shopName.trim(),
      shopAddress: shopAddress.trim(),
      shopPhone: shopPhone.trim(),
      shopLogoUrl
    });
    showToast('تم حفظ بيانات المحل بنجاح', 'success');
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
      {/* Shop Settings Form */}
      <Card
        title="بيانات المحل المطبوعة"
        subtitle="تظهر هذه البيانات في ترويسة الفاتورة A4 وكرت الطباعة A5"
        headerIcon={<Store className="w-4 h-4" />}
        accentBorder="amber"
        className="xl:col-span-3"
      >
        <div className="space-y-5">
          <Input
            label="اسم المحل (بالتفصيل)"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="مثال: مَشْغَلْ صَهْوَةْ لِلْخِيَاطَةِ الرَّجَالِيَّةِ"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="العنوان"
              value={shopAddress}
              onChange={(e) => setShopAddress(e.target.value)}
              placeholder="مثال: نجران شارع الفيصليه"
              icon={<MapPin className="w-4 h-4" />}
            />
            <Input
              label="رقم التواصل"
              value={shopPhone}
              onChange={(e) => setShopPhone(e.target.value)}
              placeholder="مثال: 0500000000"
              icon={<Phone className="w-4 h-4" />}
              dir="ltr"
            />
          </div>

          {/* Logo upload */}
          <div>
            <span className="block text-xs font-bold text-[#242424] mb-1.5">شعار المحل (اختياري)</span>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="border-2 border-black bg-[#F0F0EE] flex items-center justify-center w-16 h-16 shrink-0 overflow-hidden">
                {shopLogoUrl ? (
                  <img src={shopLogoUrl} alt="شعار المحل" className="w-full h-full object-contain" />
                ) : (
                  <span className="bg-black text-white font-black text-[13px] leading-none w-full h-full flex items-center justify-center px-0.5">
                    صهوة
                  </span>
                )}
              </div>

              <label className="inline-flex items-center justify-center font-bold transition-all duration-200 cursor-pointer rounded-lg border border-slate-200 bg-white text-[#242424] hover:bg-[#F0F0EE] h-9 px-3.5 text-xs gap-1.5">
                <ImageUp className="w-4 h-4" />
                رفع شعار جديد
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </label>

              {shopLogoUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 className="w-4 h-4" />}
                  onClick={() => setShopLogoUrl(undefined)}
                >
                  إزالة الشعار
                </Button>
              )}
            </div>
            <p className="text-[10.5px] text-slate-400 font-semibold mt-2">
              بدون شعار سيظهر الشعار النصي الرسمي «صهوة» تلقائياً.
            </p>
          </div>

          <div className="pt-2 border-t border-[#DEDEDA] flex justify-end">
            <Button icon={<Save className="w-4 h-4" />} onClick={handleSave}>
              حفظ بيانات المحل
            </Button>
          </div>
        </div>
      </Card>

      {/* Live Print Preview */}
      <Card
        title="معاينة الترويسة المطبوعة"
        subtitle="نفس الشكل الذي سيظهر في كرت الطباعة A5"
        headerIcon={<Printer className="w-4 h-4" />}
        className="xl:col-span-2"
      >
        <div className="bg-[#F0F0EE] border border-slate-200 rounded-xl p-4">
          <div className="border-2 border-black bg-white p-3">
            <div className="flex items-center justify-between border-b-2 border-black pb-2 gap-3">
              <div className="flex items-center gap-3 text-center sm:text-right">
                <div className="border-2 border-black bg-[#F0F0EE] shrink-0 flex items-center justify-center w-12 h-12">
                  {shopLogoUrl ? (
                    <img src={shopLogoUrl} alt={shopName} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="bg-black text-white font-black text-[13px] leading-none w-full h-full flex items-center justify-center px-0.5">
                      صهوة
                    </span>
                  )}
                </div>
                <div className="space-y-0.5">
                  <div className="text-[13px] font-black text-black leading-tight">{shopName}</div>
                  <div className="text-[9px] text-[#242424] font-bold leading-tight">{shopAddress}</div>
                  <div className="text-[9px] text-[#242424] font-bold leading-tight">
                    رقم التواصل: <span className="font-mono dir-ltr inline-block">{shopPhone}</span>
                  </div>
                </div>
              </div>
              <div className="text-center shrink-0">
                <div className="bg-black text-white font-mono px-2.5 py-1 text-xs font-black tracking-widest">
                  #1001
                </div>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold text-center mt-3">
            الترويسة تتحدث مباشرة مع ما تكتبه أعلاه
          </p>
        </div>
      </Card>
    </div>
  );
};
