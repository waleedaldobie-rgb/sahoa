export const round2 = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const calculateStockBalance = (beforeValue: number, deltaValue: number, itemName: string) => {
  const before = round2(beforeValue);
  const delta = round2(deltaValue);
  const after = round2(before + delta);
  if (after < -0.0001) {
    throw new Error(`لا يمكن تنفيذ الحركة؛ الكمية المتاحة من ${itemName} غير كافية.`);
  }
  return { before, after: Math.max(0, after) };
};
