import { describe, expect, it } from 'vitest';
import { calculateMaterialCost, calculateOrderAmounts, materialSignature } from '../services/shared/orderRules';

describe('shared order rules', () => {
  it('calculates order amounts and payment status consistently', () => {
    expect(calculateOrderAmounts(300, 100)).toEqual({ totalAmount: 300, paidAmount: 100, remainingAmount: 200, paymentStatus: 'partial' });
    expect(calculateOrderAmounts(300, 300).paymentStatus).toBe('paid');
    expect(calculateOrderAmounts(300, 0).paymentStatus).toBe('unpaid');
  });

  it('calculates material cost from historical usage prices', () => {
    expect(calculateMaterialCost([
      { totalCost: 12.5 },
      { totalCost: 4.25 }
    ] as any)).toBe(16.75);
  });

  it('creates an order-material signature independent of row order', () => {
    const first = materialSignature([
      { itemType: 'accessory', itemId: 'ACC-2', quantity: 2, unit: 'حبة', unitCostAtUsage: 1.5 },
      { itemType: 'accessory', itemId: 'ACC-1', quantity: 1, unit: 'حبة', unitCostAtUsage: 2 }
    ]);
    const second = materialSignature([
      { item_type: 'accessory', item_id: 'ACC-1', quantity: 1, unit: 'حبة', unit_cost_at_usage: 2 },
      { item_type: 'accessory', item_id: 'ACC-2', quantity: 2, unit: 'حبة', unit_cost_at_usage: 1.5 }
    ]);
    expect(first).toBe(second);
  });
});
