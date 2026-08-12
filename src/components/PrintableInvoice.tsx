import React from 'react';
import { Invoice, Order, UserPreferences } from '../types';
import { SahwaLogo } from './SahwaLogo';
import { NeckDrawing, PocketDrawing, JabzourDrawing, AdditionDrawing } from './InvoiceDrawings';

export interface PrintableInvoiceProps {
  invoice: Invoice;
  order?: Order | null;
  preferences?: UserPreferences | null;
  showOnScreen?: boolean;
}

const valueOf = (obj: Record<string, unknown> | undefined, key: string, fallback = '') => {
  const value = obj?.[key];
  return value === undefined || value === null || String(value).trim() === '' ? fallback : String(value);
};

const MeasurementCell = ({ label, value, className = "" }: { label: string; value: string; className?: string }) => {
  const isThobeType = label === 'نوع الثوب';
  return (
    <div className={`invoice-measure-cell-new ${className}`}>
      <span className="invoice-label-new">{label}</span>
      <span className={isThobeType ? "invoice-value-new bg-black text-white px-3" : "invoice-value-new"}>
        {value || '--'}
      </span>
    </div>
  );
};

const DrawingBox = ({ label, value, Drawing, subContent, neckShape }: { label: string; value: string; Drawing?: React.ComponentType<{ type?: string; neckType?: string; neckShape?: string }>; subContent?: React.ReactNode; neckShape?: string }) => (
  <div className="invoice-drawing-card">
    <div className="invoice-drawing-header">
      <span className="invoice-label-new">{label}</span>
      <span className="invoice-value-new">{value || '--'}</span>
    </div>
    <div className="invoice-drawing-body">
      {Drawing && (
        <div className="invoice-main-drawing">
          <Drawing 
            type={value} 
            neckType={label === 'الرقبة' ? value : undefined} 
            neckShape={label === 'الرقبة' ? neckShape : undefined} 
          />
        </div>
      )}
      {subContent}
    </div>
  </div>
);

export const PrintableInvoice: React.FC<PrintableInvoiceProps> = ({ invoice, order, preferences, showOnScreen = false }) => {
  if (!invoice) return null;

  const shopName = preferences?.shopName || 'صهوة للخياطة الرجالية';
  const shopLogoUrl = preferences?.shopLogoUrl;
  const m = (order?.measurements || {}) as unknown as Record<string, unknown>;
  const sd = (order?.styleDetails || {}) as unknown as Record<string, unknown>;

  const customerId = order?.customerId || '--';
  const customerPhone = order?.customerPhone || invoice.customerPhone || '--';
  const garmentCount = order?.garmentCount ?? 1;
  const invoiceDate = order?.orderDate || invoice.orderDate || '--';
  const deliveryDate = order?.deliveryDate || '--';
  const thobeType = order?.thobeTypeName || '--';
  const additionType = valueOf(sd, 'buttonsType', '--');

  const handType = valueOf(sd, 'sleeveType', '--');
  const handMeasure = valueOf(m, 'sleeveLength', '--');
  const handOptions = ['cuff1', 'cuff2', 'cuff3', 'cuff4', 'cuff5'].map((key, index) => ({
    key,
    number: index + 1,
    value: valueOf(sd, key, '--')
  }));

  const neckType = valueOf(sd, 'neckType', '--');
  const neckShape = valueOf(sd, 'neckShape', '--');
  const neckSize = valueOf(m, 'neckSize', '--');

  const notes = order?.notes || '';

  return (
    <div className={`invoice-luxury-container ${showOnScreen ? 'invoice-screen-preview' : ''}`} dir="rtl">
      {/* Header Section */}
      <div className="invoice-luxury-header">
        <div className="header-brand">
          {shopLogoUrl ? (
            <img src={shopLogoUrl} alt={shopName} className="header-logo" />
          ) : (
            <SahwaLogo className="header-logo" color="#000000" />
          )}
          <div className="header-titles">
            <h1 className="shop-name-title">{shopName}</h1>
            <p className="shop-subtitle">للخياطة الرجالية الراقية</p>
          </div>
        </div>
        <div className="header-meta-box">
          <div className="meta-item"><span className="meta-label">رقم الفاتورة:</span> <span className="meta-value">#{invoice.invoiceNumber}</span></div>
          <div className="meta-item"><span className="meta-label">التاريخ:</span> <span className="meta-value">{invoiceDate}</span></div>
          <div className="meta-item"><span className="meta-label">موعد التسليم:</span> <span className="meta-value">{deliveryDate}</span></div>
        </div>
      </div>

      {/* Customer & Payment Info */}
      <div className="invoice-info-grid-new">
        <div className="info-card">
          <div className="info-row-new"><span>اسم العميل</span><strong>{invoice.customerName || '--'}</strong></div>
          <div className="info-row-new"><span>رقم الجوال</span><strong>{customerPhone}</strong></div>
          <div className="info-row-new"><span>رقم العميل</span><strong>#{customerId}</strong></div>
        </div>
        <div className="info-card">
          <div className="info-row-new highlight-black"><span>إجمالي المبلغ</span><strong>{invoice.totalAmount} ر.س</strong></div>
          <div className="info-row-new"><span>المبلغ المدفوع</span><strong>{invoice.paidAmount} ر.س</strong></div>
          <div className="info-row-new highlight-gray"><span>المبلغ المتبقي</span><strong>{invoice.remainingAmount} ر.س</strong></div>
        </div>
      </div>

      {/* Main Content Columns */}
      <div className="invoice-main-layout">
        {/* Right Column: Body Measurements + Hand/Neck next to labels */}
        <section className="layout-column side-column">
          <h3 className="column-title">قياسات الجسم واليد والرقبة</h3>
          <div className="measurements-group">
            <MeasurementCell label="طول أمام" value={valueOf(m, 'frontLength')} />
            <MeasurementCell label="طول خلف" value={valueOf(m, 'backLength')} />
            <MeasurementCell label="قياس الكتف" value={valueOf(m, 'shoulderWidth')} />
            
            <div className="combined-measure-box">
              <div className="measure-row-inline">
                <span className="invoice-label-new">قياس اليد</span>
                <span className="invoice-value-new">{handMeasure}</span>
              </div>
              <div className="measure-row-inline border-t border-gray-100">
                <span className="invoice-label-new">نوع اليد</span>
                <span className="invoice-value-new">{handType}</span>
              </div>
              <div className="hand-cuffs-grid">
                {handOptions.map((opt) => (
                  <div key={opt.key} className="cuff-box">
                    <span className="cuff-num">{opt.number}</span>
                    <span className="cuff-val">{opt.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="combined-measure-box">
              <div className="measure-row-inline">
                <span className="invoice-label-new">قياس الرقبة</span>
                <span className="invoice-value-new">{neckSize}</span>
              </div>
              <div className="measure-row-inline border-t border-gray-100">
                <span className="invoice-label-new">نوع الرقبة</span>
                <span className="invoice-value-new">{neckType}</span>
              </div>
              <div className="measure-row-inline border-t border-gray-100">
                <span className="invoice-label-new">شكل الرقبة</span>
                <span className="invoice-value-new">{neckShape}</span>
              </div>
            </div>

            <MeasurementCell label="الوسع" value={valueOf(m, 'bottomSweep')} />
            <MeasurementCell label="نوع الثوب" value={thobeType} />
          </div>
        </section>

        {/* Center Column: Drawings & Details */}
        <section className="layout-column center-column">
          <h3 className="column-title">التفصيل والرسومات</h3>
          <div className="drawings-stack">
            {/* Jabzoor + Takhalis directly under it */}
            <div className="drawing-group-card">
              <DrawingBox label="الجبزور" value={valueOf(sd, 'habroorStyle')} Drawing={JabzourDrawing} />
              <div className="clearance-field-box">
                <span className="invoice-label-new">التخاليص</span>
                <span className="invoice-value-new">{valueOf(m, 'clearances')}</span>
              </div>
            </div>

            <DrawingBox label="الرقبة" value={neckType} Drawing={NeckDrawing} neckShape={neckShape} />
            <DrawingBox label="الجيب" value={valueOf(sd, 'chestPocketStyle')} Drawing={PocketDrawing} />
            <DrawingBox label="الإضافات" value={additionType} Drawing={AdditionDrawing} />
          </div>
        </section>

        {/* Left Column: Remaining Measurements */}
        <section className="layout-column side-column-slim">
          <h3 className="column-title">باقي القياسات</h3>
          <div className="measurements-group">
            <MeasurementCell label="ميلان الكتف" value={valueOf(m, 'shoulderSlope')} />
            <MeasurementCell label="الورك" value={valueOf(m, 'hipSize')} />
            <MeasurementCell label="الصدر" value={valueOf(m, 'chestSize')} />
            <div className="step-measure-card">
              <span className="invoice-label-new">الخطوة</span>
              <div className="step-value-large">{valueOf(m, 'stepSize', '--')}</div>
            </div>
          </div>
        </section>
      </div>

      {/* Notes Section */}
      {notes && (
        <div className="invoice-luxury-notes">
          <h3 className="column-title">الملاحظات الخاصة</h3>
          <div className="notes-content-box">{notes}</div>
        </div>
      )}

      {/* Footer Branding */}
      <div className="invoice-luxury-footer">
        <p>نظام صهوة للخياطة الرجالية الراقية - دقة في التنفيذ وفخامة في المظهر</p>
      </div>
    </div>
  );
};
