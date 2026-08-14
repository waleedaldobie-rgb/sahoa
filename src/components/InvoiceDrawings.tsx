import React from 'react';

// ============================================================================
// Apparel Tech Pack Flat Sketches (Professional Tailoring Style)
// ----------------------------------------------------------------------------
// Conventions:
//   - Black #000000 for all strokes.
//   - Outer edges: 2px solid.
//   - Topstitch (Dashed): 1px, dasharray="3 2".
//   - Professional proportions for Thobe elements.
// ============================================================================

export interface InvoiceDrawingProps {
  type?: string;
  neckType?: string;
  neckShape?: string;
  pocketWidth?: string;
  pocketDrop?: string;
  showDimensions?: boolean;
  shape?: string;
  highlighted?: boolean;
}

const SvgContainer = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <svg
    viewBox="0 0 100 100"
    preserveAspectRatio="xMidYMid meet"
    shapeRendering="geometricPrecision"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`svg-drawing w-full h-full fill-none stroke-black ${className}`}
  >
    {children}
  </svg>
);

// --- NECK DRAWINGS ---

export const NeckDrawing = ({ neckType, neckShape, highlighted }: InvoiceDrawingProps) => {
  const type = (neckType || '').trim();
  const shape = (neckShape || '').trim();
  const selectedNeck = type.includes('ملكي') || shape.includes('ملكي')
    ? 'ملكي'
    : type.includes('فرنسي') || shape.includes('فرنسي')
      ? 'فرنسي'
      : type.includes('قلاب')
        ? 'ملكي'
        : type.includes('سادة مدور') || shape.includes('سادة مدور')
          ? 'سادة مدور'
          : 'سادة مربع';
  const drawingTitle = `رسم رقبة ${selectedNeck}`;

  return (
    <SvgContainer className={highlighted ? 'svg-drawing-highlighted' : ''}>
      <title>{drawingTitle}</title>

      {selectedNeck === 'ملكي' && (
        <g aria-label="رقبة قلاب ملكي">
          <g stroke="#111111" fill="none">
            <path d="M14 29 C18 12 82 12 86 29" strokeWidth="2.2" />
            <path d="M18 30 C23 18 77 18 82 30" strokeWidth="1.1" />
            <path d="M14 29 C23 35 33 40 43 49 L50 57 L57 49 C67 40 77 35 86 29" strokeWidth="2.15" />
          </g>
          <g stroke="#111111" fill="none">
            <path d="M14 29 L12 63 L26 88 L45 96 L50 57 L43 49 Z" strokeWidth="2.2" />
            <path d="M86 29 L88 63 L74 88 L55 96 L50 57 L57 49 Z" strokeWidth="2.2" />
            <path d="M18 33 L17 61 L29 83 L42 90 L46 56" strokeWidth="0.9" stroke="#4B5563" strokeDasharray="3 2" />
            <path d="M82 33 L83 61 L71 83 L58 90 L54 56" strokeWidth="0.9" stroke="#4B5563" strokeDasharray="3 2" />
          </g>
          <g stroke="#111111" fill="none">
            <path d="M50 57 L50 94" strokeWidth="1.25" />
            <path d="M46.5 56 L50 60 L53.5 56" strokeWidth="1" stroke="#4B5563" />
            <path d="M47.5 73 H52.5 M47.5 86 H52.5" strokeWidth="0.9" stroke="#4B5563" />
          </g>
        </g>
      )}

      {selectedNeck === 'فرنسي' && (
        <g aria-label="رقبة قلاب فرنسي">
          <g stroke="#111111" fill="none">
            <path d="M15 28 C20 13 80 13 85 28" strokeWidth="2.2" />
            <path d="M19 30 C25 19 75 19 81 30" strokeWidth="1.1" />
            <path d="M15 28 L36 40 L50 54 L64 40 L85 28" strokeWidth="2.15" />
          </g>
          <g stroke="#111111" fill="none">
            <path d="M15 28 L11 61 L30 91 L50 54 L36 40 Z" strokeWidth="2.2" />
            <path d="M85 28 L89 61 L70 91 L50 54 L64 40 Z" strokeWidth="2.2" />
            <path d="M19 32 L16 59 L30 84 L46 54" strokeWidth="0.9" stroke="#4B5563" strokeDasharray="3 2" />
            <path d="M81 32 L84 59 L70 84 L54 54" strokeWidth="0.9" stroke="#4B5563" strokeDasharray="3 2" />
          </g>
          <g stroke="#4B5563" fill="none" strokeWidth="0.9">
            <path d="M32 88 L35 84 M68 88 L65 84" />
            <path d="M47.5 55 H52.5" />
          </g>
        </g>
      )}

      {selectedNeck === 'سادة مدور' && (
        <g aria-label="رقبة سادة مدور">
          <g stroke="#111111" fill="none">
            <path d="M12 40 C12 22 29 12 50 12 C71 12 88 22 88 40" strokeWidth="2.2" />
            <path d="M17 40 C18 28 32 19 50 19 C68 19 82 28 83 40" strokeWidth="1.15" />
            <path d="M12 40 C17 54 33 64 50 66 C67 64 83 54 88 40" strokeWidth="2.2" />
          </g>
          <g stroke="#111111" fill="none">
            <path d="M12 40 L14 68 C15 80 30 88 50 90 C70 88 85 80 86 68 L88 40" strokeWidth="2.2" />
            <path d="M16 44 L18 67 C20 76 33 83 50 85 C67 83 80 76 82 67 L84 44" strokeWidth="0.9" stroke="#4B5563" strokeDasharray="3 2" />
            <path d="M16 42 C22 53 35 60 50 62 C65 60 78 53 84 42" strokeWidth="0.9" stroke="#4B5563" strokeDasharray="3 2" />
          </g>
          <g stroke="#111111" fill="white">
            <path d="M50 63 C58 63 64 68 64 76 C64 84 58 88 50 90 L50 69 Z" strokeWidth="1.9" />
            <path d="M53 67 C59 69 61 72 61 77 C61 81 58 84 53 86" stroke="#4B5563" strokeWidth="0.85" strokeDasharray="3 2" fill="none" />
          </g>
        </g>
      )}

      {selectedNeck === 'سادة مربع' && (
        <g aria-label="رقبة سادة مربع">
          <g stroke="#111111" fill="none">
            <path d="M15 26 Q16 18 24 18 H76 Q84 18 85 26 L88 47" strokeWidth="2.2" />
            <path d="M15 26 L12 47 C12 52 16 55 21 56" strokeWidth="2.2" />
            <path d="M20 46 L22 33 Q23 29 28 29 H72 Q77 29 78 33 L80 46" strokeWidth="2" />
            <path d="M24 45 L26 35 Q27 33 30 33 H70 Q73 33 74 35 L76 45" strokeWidth="0.9" stroke="#4B5563" strokeDasharray="3 2" />
          </g>
          <g stroke="#111111" fill="none">
            <path d="M12 47 L14 70 Q15 78 25 82 L50 90 L85 78 Q85 78 88 47" strokeWidth="2.2" />
            <path d="M16 51 L18 68 Q19 75 27 78 L50 85 L81 75 L84 51" strokeWidth="0.9" stroke="#4B5563" strokeDasharray="3 2" />
            <path d="M12 47 L50 58 L88 47" strokeWidth="1.9" />
          </g>
          <g stroke="#111111">
            <path d="M50 58 V90 L66 84 V58 Z" strokeWidth="1.9" fill="white" />
            <path d="M53 61 V85 L62 81.5 V61" stroke="#4B5563" strokeWidth="0.85" strokeDasharray="3 2" fill="none" />
          </g>
        </g>
      )}
    </SvgContainer>
  );
};

// --- JABZOUR DRAWINGS ---

// رسم صناعي مستقل لنوع إغلاق الجبزور: سحاب، زرار باين، أو وزار مخفي.
export const JabzourTypeDrawing = ({ type }: InvoiceDrawingProps) => {
  const typeText = (type || '').trim();
  const selectedType = typeText.includes('سحاب')
    ? 'سحاب مخفي'
    : typeText.includes('مخفي')
      ? 'وزار مخفي'
      : 'زرار باين';

  return (
    <SvgContainer>
      <title>{`رسم جبزور ${selectedType}`}</title>
      <g stroke="#111111" fill="white">
        <path d="M31 8 H69 V92 H31 Z" strokeWidth="2.2" />
        <path d="M35 12 H65 V88 H35 Z" stroke="#4B5563" strokeWidth="0.9" strokeDasharray="3 2" fill="none" />
        <path d="M42 16 H58" stroke="#4B5563" strokeWidth="1" fill="none" />
      </g>

      {selectedType === 'سحاب مخفي' && (
        <g stroke="#111111" fill="none">
          <path d="M46.5 19 V82 M53.5 19 V82" strokeWidth="1.2" />
          {Array.from({ length: 14 }, (_, index) => (
            <path key={index} d={`M46.5 ${24 + index * 4} H53.5`} strokeWidth="0.65" />
          ))}
          <rect x="46" y="16" width="8" height="8" rx="1.5" strokeWidth="1.15" fill="white" />
          <path d="M48 16 V11 C48 8 52 8 52 11 V16" strokeWidth="1.25" />
          <path d="M46 84 H54" stroke="#4B5563" strokeWidth="1" />
        </g>
      )}

      {selectedType === 'زرار باين' && (
        <g stroke="#111111">
          <path d="M50 18 V82" stroke="#4B5563" strokeWidth="1.1" fill="none" />
          {[27, 43, 59, 75].map((cy) => (
            <g key={cy}>
              <circle cx="50" cy={cy} r="2.6" strokeWidth="1" fill="white" />
              <circle cx="50" cy={cy} r="0.95" fill="#111111" stroke="none" />
            </g>
          ))}
        </g>
      )}

      {selectedType === 'وزار مخفي' && (
        <g stroke="#111111" fill="white">
          <path d="M44 17 H56 V84 H44 Z" strokeWidth="1.65" />
          <path d="M47 21 V80" stroke="#4B5563" strokeWidth="0.85" strokeDasharray="3 2" fill="none" />
          <path d="M44 17 L47 21 M56 17 L53 21" stroke="#4B5563" strokeWidth="0.85" fill="none" />
        </g>
      )}
    </SvgContainer>
  );
};

// رسم صناعي مستقل لشكل نهاية الجبزور: مثلث أو مربع.
export const JabzourShapeDrawing = ({ shape }: InvoiceDrawingProps) => {
  const isTriangle = (shape || '').trim().includes('مثلث');
  const selectedShape = isTriangle ? 'مثلث' : 'مربع';
  const outerPath = isTriangle
    ? 'M31 8 H69 V64 L50 94 L31 64 Z'
    : 'M31 8 H69 V94 H31 Z';
  const topstitchPath = isTriangle
    ? 'M35 12 V63 L50 87 L65 63 V12'
    : 'M35 12 V90 H65 V12';
  const hemPath = isTriangle ? 'M35 65 L50 87 L65 65' : 'M35 80 H65';
  const notchY = isTriangle ? 64 : 79;

  return (
    <SvgContainer>
      <title>{`رسم شكل جبزور ${selectedShape}`}</title>
      <g stroke="#111111" fill="white">
        <path d={outerPath} strokeWidth="2.2" />
        <path d={topstitchPath} stroke="#4B5563" strokeWidth="0.9" strokeDasharray="3 2" fill="none" />
        <path d="M42 16 H58" stroke="#4B5563" strokeWidth="1" fill="none" />
        <path d={hemPath} strokeWidth="1.45" fill="none" />
      </g>
      <g stroke="#4B5563" strokeWidth="0.9" fill="none">
        <path d={`M31 ${notchY - 2} L35 ${notchY + 2}`} />
        <path d={`M69 ${notchY - 2} L65 ${notchY + 2}`} />
      </g>
    </SvgContainer>
  );
};

// --- POCKET DRAWINGS ---

export const PocketDrawing = ({ type, pocketWidth, pocketDrop, showDimensions = true, highlighted }: InvoiceDrawingProps) => {
  const isSquare = (type || '').trim().includes('مربع');
  const selectedPocket = isSquare ? 'جيب مربع' : 'جيب عادي';
  const widthLabel = pocketWidth?.trim() || '--';
  const dropLabel = pocketDrop?.trim() || '--';
  const outerPocketPath = isSquare
    ? 'M20 32 H80 V89 H20 Z'
    : 'M20 32 H80 V73 L65 89 H35 L20 73 Z';
  const topstitchPath = isSquare
    ? 'M24 36 H76 V85 H24 Z'
    : 'M24 36 H76 V71 L63 85 H37 L24 71 Z';

  return (
    <SvgContainer className={highlighted ? 'svg-drawing-highlighted' : ''}>
      <title>{`رسم ${selectedPocket}`}</title>

      {showDimensions && (
        <g stroke="#4B5563" fill="none" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round">
          {/* خطوط الأبعاد تبقى خارج الجيب لكي لا تحجب تفاصيل التشطيب */}
          <path d="M20 11 H80 M20 11 l3 -2 M20 11 l3 2 M80 11 l-3 -2 M80 11 l-3 2" />
          <path d="M20 14 V11 M80 14 V11" strokeDasharray="2 1.5" />
          <path d="M89 32 V89 M89 32 l-2 3 M89 32 l2 3 M89 89 l-2 -3 M89 89 l2 3" />
          <path d="M82 32 H89 M82 89 H89" strokeDasharray="2 1.5" />
        </g>
      )}

      {showDimensions && (
        <g fill="#111111" stroke="none" fontFamily="Arial, sans-serif" fontSize="3" fontWeight="700" letterSpacing="0.03">
          <text x="50" y="6" textAnchor="middle" direction="rtl" unicodeBidi="plaintext">العرض: {widthLabel}</text>
          <text x="95" y="61" textAnchor="middle" direction="rtl" unicodeBidi="plaintext" transform="rotate(90 95 61)">النزول: {dropLabel}</text>
        </g>
      )}

      {/* فتحة الجيب وحاشيتها العلوية */}
      <g stroke="#111111" fill="white">
        <path d="M20 18 H80 V32 H20 Z" strokeWidth="2.1" />
        <path d="M24 22 H76 V28 H24 Z" stroke="#4B5563" strokeWidth="0.9" strokeDasharray="3 2" fill="none" />
        <path d="M20 32 H80" strokeWidth="1.75" fill="none" />
      </g>

      {/* جسم الجيب والتشطيب المزدوج للحواف */}
      <g stroke="#111111" fill="white">
        <path d={outerPocketPath} strokeWidth="2.15" />
        <path d={topstitchPath} stroke="#4B5563" strokeWidth="0.9" strokeDasharray="3 2" fill="none" />
        <path d="M20 35 H80" stroke="#4B5563" strokeWidth="0.8" fill="none" />
      </g>

      {/* علامات تركيب جانبية عند التقاء الفتحة بجسم الجيب */}
      <g stroke="#4B5563" strokeWidth="0.85" fill="none">
        <path d="M20 29 L24 33 M80 29 L76 33" />
      </g>
    </SvgContainer>
  );
};

// --- HEM / ADDITION ---

export const HemDrawing = ({ type }: { type?: string }) => {
  const t = (type || '').trim();
  return (
    <SvgContainer>
      <path d="M 10 20 Q 50 10 90 20" strokeWidth="2.2" />
      {t.includes('مثلث') ? (
        <path d="M 10 20 L 10 70 L 50 85 L 90 70 L 90 20" strokeWidth="2" />
      ) : (
        <path d="M 10 20 L 10 80 L 90 80 L 90 20" strokeWidth="2" />
      )}
      <path d="M 15 25 L 15 65 Q 50 75 85 65 L 85 25" strokeWidth="1" strokeDasharray="3 2" />
      <path d="M 19 29 L 19 62 Q 50 70 81 62 L 81 29" strokeWidth="0.65" strokeDasharray="2 2" />
    </SvgContainer>
  );
};

export const AdditionDrawing = ({ }: InvoiceDrawingProps) => {
  return (
    <SvgContainer>
      <circle cx="50" cy="50" r="15" strokeWidth="2.2" fill="white" />
      <circle cx="50" cy="50" r="10" strokeWidth="1" strokeDasharray="2 2" />
      <circle cx="45" cy="45" r="2" fill="black" />
      <circle cx="55" cy="45" r="2" fill="black" />
      <circle cx="45" cy="55" r="2" fill="black" />
      <circle cx="55" cy="55" r="2" fill="black" />
    </SvgContainer>
  );
};
