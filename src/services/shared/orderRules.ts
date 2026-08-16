import { OrderMaterialUsage } from '../../types';

export interface OrderAmounts {
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
}

export function calculateOrderAmounts(totalAmount: number, paidAmount: number): OrderAmounts {
  const total = Number.isFinite(Number(totalAmount)) ? Number(totalAmount) : 0;
  const paid = Number.isFinite(Number(paidAmount)) ? Number(paidAmount) : 0;
  const remainingAmount = total - paid;
  return {
    totalAmount: total,
    paidAmount: paid,
    remainingAmount,
    paymentStatus: remainingAmount <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid'
  };
}

export function calculateMaterialCost(usages: OrderMaterialUsage[]): number {
  return Math.round((usages.reduce((sum, usage) => sum + Number(usage.totalCost || 0), 0) + Number.EPSILON) * 100) / 100;
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
