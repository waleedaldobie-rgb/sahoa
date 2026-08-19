import { OrderMaterialUsage } from '../types';
import { round2 } from './inventoryRules';

export interface OrderAmounts {
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
}

export function assertValidOrderAmounts(totalAmount: unknown, paidAmount: unknown): { total: number; paid: number } {
  const total = Number(totalAmount);
  const paid = Number(paidAmount);
  if (!Number.isFinite(total) || total < 0) {
    throw new Error('إجمالي الطلب يجب أن يكون رقماً غير سالب');
  }
  if (!Number.isFinite(paid) || paid < 0) {
    throw new Error('المبلغ المدفوع يجب أن يكون رقماً غير سالب');
  }
  if (paid > total + 0.0001) {
    throw new Error('المبلغ المدفوع لا يمكن أن يتجاوز إجمالي الطلب');
  }
  return { total: round2(total), paid: round2(paid) };
}

export function calculateOrderAmounts(totalAmount: number, paidAmount: number): OrderAmounts {
  const { total, paid } = assertValidOrderAmounts(totalAmount, paidAmount);
  const remainingAmount = round2(total - paid);
  return {
    totalAmount: total,
    paidAmount: paid,
    remainingAmount: Math.max(0, remainingAmount),
    paymentStatus: remainingAmount <= 0.0001 ? 'paid' : paid > 0 ? 'partial' : 'unpaid'
  };
}

export function calculateMaterialCost(usages: OrderMaterialUsage[]): number {
  return round2(usages.reduce((sum, usage) => sum + Number(usage.totalCost || 0), 0));
}

export function materialSignature(usages: Array<Partial<OrderMaterialUsage> & { item_type?: string; item_id?: string; unit_cost_at_usage?: number }>): string {
  return usages
    .filter((usage) => (usage.itemType || usage.item_type) !== 'fabric')
    .map((usage) => [
      usage.itemType || usage.item_type || '',
      usage.itemId || usage.item_id || '',
      usage.quantity ?? '',
      usage.unit || '',
      usage.unitCostAtUsage ?? usage.unit_cost_at_usage ?? ''
    ].join(':'))
    .sort()
    .join('|');
}
