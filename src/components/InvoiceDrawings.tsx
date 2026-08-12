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

const SvgContainer = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <svg viewBox="0 0 100 100" className={`w-full h-full fill-none stroke-black stroke-linecap-round stroke-linejoin-round ${className}`}>
    {children}
  </svg>
);

// --- NECK DRAWINGS ---

export const NeckDrawing = ({ neckType, neckShape }: { neckType?: string; neckShape?: string }) => {
  const type = (neckType || '').trim();
  const shape = (neckShape || '').trim();

  // الملكي (Mandarin/Stand Collar)
  if (type.includes('قلاب') && shape.includes('ملكي')) {
    return (
      <SvgContainer>
        <path d="M 20 80 Q 50 70 80 80" strokeWidth="2" /> {/* Shoulder line */}
        <path d="M 35 72 L 35 40 Q 50 30 65 40 L 65 72" strokeWidth="2" /> {/* Collar stand */}
        <path d="M 35 45 Q 50 35 65 45" strokeWidth="1" strokeDasharray="3 2" /> {/* Stitching */}
        <circle cx="50" cy="55" r="2.5" fill="black" /> {/* Button */}
        <path d="M 50 65 L 50 95" strokeWidth="1.5" /> {/* Placket start */}
      </SvgContainer>
    );
  }

  // الفرنسي (Spread Collar)
  if (type.includes('قلاب') && shape.includes('فرنسي')) {
    return (
      <SvgContainer>
        <path d="M 15 85 Q 50 75 85 85" strokeWidth="2" />
        <path d="M 35 75 L 35 50 L 50 45 L 65 50 L 65 75" strokeWidth="2" /> {/* Stand */}
        <path d="M 35 50 L 15 65 L 45 60 L 50 75 L 55 60 L 85 65 L 65 50" strokeWidth="2" /> {/* Spread wings */}
        <path d="M 18 63 L 43 58" strokeWidth="1" strokeDasharray="2 1" /> {/* Detail stitching */}
        <path d="M 82 63 L 57 58" strokeWidth="1" strokeDasharray="2 1" />
      </SvgContainer>
    );
  }

  // العادي (Regular Collar)
  if (type.includes('قلاب')) {
    return (
      <SvgContainer>
        <path d="M 20 85 Q 50 75 80 85" strokeWidth="2" />
        <path d="M 38 75 L 38 55 Q 50 50 62 55 L 62 75" strokeWidth="2" />
        <path d="M 38 55 L 25 70 L 48 68 L 50 85 L 52 68 L 75 70 L 62 55" strokeWidth="2" />
        <circle cx="50" cy="62" r="2" fill="black" />
      </SvgContainer>
    );
  }

  // سادة (Plain Round)
  return (
    <SvgContainer>
      <path d="M 20 80 Q 50 70 80 80" strokeWidth="2" />
      <path d="M 35 73 Q 50 55 65 73" strokeWidth="2" /> {/* Round opening */}
      <path d="M 37 70 Q 50 58 63 70" strokeWidth="1" strokeDasharray="3 2" /> {/* Stitching */}
      <path d="M 47 73 L 47 95 M 53 73 L 53 95" strokeWidth="1.5" /> {/* Front opening */}
    </SvgContainer>
  );
};

// --- JABZOUR DRAWINGS ---

export const JabzourDrawing = ({ type }: { type?: string }) => {
  const t = (type || '').trim();
  const isTriangle = t.includes('مثلث');

  return (
    <SvgContainer>
      {/* Placket body */}
      <rect x="35" y="10" width="30" height="60" strokeWidth="2" />
      <path d="M 40 10 L 40 70 M 60 10 L 60 70" strokeWidth="1" strokeDasharray="3 2" />
      
      {/* Buttons */}
      <circle cx="50" cy="25" r="2" fill="black" />
      <circle cx="50" cy="45" r="2" fill="black" />
      
      {/* End Shape */}
      {isTriangle ? (
        <path d="M 35 70 L 50 85 L 65 70" strokeWidth="2" />
      ) : (
        <path d="M 35 70 L 35 80 L 65 80 L 65 70" strokeWidth="2" />
      )}
      
      {/* Cross stitch at end */}
      <path d="M 38 65 L 62 65" strokeWidth="1.5" />
    </SvgContainer>
  );
};

// --- POCKET DRAWINGS ---

export const PocketDrawing = ({ type }: { type?: string }) => {
  const t = (type || '').trim();

  return (
    <SvgContainer>
      {/* Pocket Body */}
      <path d="M 25 20 L 75 20 L 75 70 Q 75 80 50 80 Q 25 80 25 70 Z" strokeWidth="2" />
      <path d="M 30 25 L 70 25 L 70 68 Q 70 75 50 75 Q 30 75 30 68 Z" strokeWidth="1" strokeDasharray="3 2" />

      {/* Style Details */}
      {t.includes('غطاء') && (
        <path d="M 20 15 L 80 15 L 80 35 L 50 45 L 20 35 Z" fill="white" stroke="black" strokeWidth="2" />
      )}
      
      {t.includes('مسحوبة') && (
        <path d="M 60 20 L 75 35" strokeWidth="3" />
      )}
    </SvgContainer>
  );
};

// --- HEM / ADDITION ---

export const HemDrawing = ({ type }: { type?: string }) => {
  const t = (type || '').trim();
  return (
    <SvgContainer>
      <path d="M 10 20 Q 50 10 90 20" strokeWidth="2" />
      {t.includes('مثلث') ? (
        <path d="M 10 20 L 10 70 L 50 85 L 90 70 L 90 20" strokeWidth="2" />
      ) : (
        <path d="M 10 20 L 10 80 L 90 80 L 90 20" strokeWidth="2" />
      )}
      <path d="M 15 25 L 15 65 Q 50 75 85 65 L 85 25" strokeWidth="1" strokeDasharray="3 2" />
    </SvgContainer>
  );
};

export const AdditionDrawing = ({ type }: { type?: string }) => {
  return (
    <SvgContainer>
      <circle cx="50" cy="50" r="15" strokeWidth="2" />
      <circle cx="50" cy="50" r="10" strokeWidth="1" strokeDasharray="2 2" />
      <circle cx="45" cy="45" r="2" fill="black" />
      <circle cx="55" cy="45" r="2" fill="black" />
      <circle cx="45" cy="55" r="2" fill="black" />
      <circle cx="55" cy="55" r="2" fill="black" />
    </SvgContainer>
  );
};
