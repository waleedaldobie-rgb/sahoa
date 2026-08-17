import { calculateOrderAmounts, OrderAmounts } from './orderRules';

export interface PaymentCalculation extends OrderAmounts {
  numericAmount: number;
}

export function normalizePaymentAmount(amount: unknown): number {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('مبلغ الدفعة يجب أن يكون أكبر من صفر');
  }
  return numericAmount;
}

export function calculatePaymentUpdate(
  totalAmount: number,
  paidAmount: number,
  remainingAmount: number,
  amount: unknown
): PaymentCalculation {
  const numericAmount = normalizePaymentAmount(amount);
  if (numericAmount > remainingAmount) {
    throw new Error('مبلغ الدفعة يتجاوز المتبقي على الفاتورة');
  }

  return {
    numericAmount,
    ...calculateOrderAmounts(totalAmount, paidAmount + numericAmount)
  };
}
