import { PaymentRecord } from '../types';
import { assertValidOrderAmounts, calculateOrderAmounts, OrderAmounts } from './orderRules';
import { round2 } from './inventoryRules';
import { PaymentMethod } from '../types';

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['cash', 'card', 'transfer'];

export function assertValidPaymentMethod(value: unknown): PaymentMethod {
  if (typeof value !== 'string' || !PAYMENT_METHODS.includes(value as PaymentMethod)) {
    throw new Error('طريقة الدفع غير صالحة؛ القيم المدعومة هي cash أو card أو transfer');
  }
  return value as PaymentMethod;
}

export interface PaymentCalculation extends OrderAmounts {
  numericAmount: number;
}

export function normalizePaymentAmount(amount: unknown): number {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('مبلغ الدفعة يجب أن يكون أكبر من صفر');
  }
  return round2(numericAmount);
}

export function parsePaymentLedger(value?: string): PaymentRecord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value || '[]');
  } catch {
    throw new Error('سجل الدفعات غير صالح');
  }
  if (!Array.isArray(parsed)) throw new Error('سجل الدفعات يجب أن يكون قائمة');
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`سجل الدفعة رقم ${index + 1} غير صالح`);
    const payment = entry as Partial<PaymentRecord>;
    const amount = normalizePaymentAmount(payment.amount);
    if (!payment.id || !payment.invoiceId || !payment.orderId || !payment.paymentDate || !payment.method) {
      throw new Error(`بيانات الدفعة رقم ${index + 1} غير مكتملة`);
    }
    const method = assertValidPaymentMethod(payment.method);
    return { ...payment, amount, method } as PaymentRecord;
  });
}

export function summarizePaymentLedger(payments: PaymentRecord[], totalAmount: unknown): OrderAmounts & { paymentsTotal: number } {
  const total = Number(totalAmount);
  if (!Number.isFinite(total) || total < 0) throw new Error('إجمالي الفاتورة غير صالح');
  const uniqueIds = new Set<string>();
  for (const payment of payments) {
    if (uniqueIds.has(payment.id)) throw new Error(`معرف الدفعة مكرر: ${payment.id}`);
    uniqueIds.add(payment.id);
  }
  const paymentsTotal = round2(payments.reduce((sum, payment) => sum + normalizePaymentAmount(payment.amount), 0));
  const amounts = calculateOrderAmounts(total, paymentsTotal);
  return { ...amounts, paymentsTotal };
}

export function assertStoredPaymentAggregates(
  totalAmount: unknown,
  paidAmount: unknown,
  remainingAmount: unknown,
  payments: PaymentRecord[]
): OrderAmounts & { paymentsTotal: number } {
  const expected = summarizePaymentLedger(payments, totalAmount);
  const storedPaid = Number(paidAmount);
  const storedRemaining = Number(remainingAmount);
  if (!Number.isFinite(storedPaid) || !Number.isFinite(storedRemaining)
    || Math.abs(storedPaid - expected.paidAmount) > 0.0001
    || Math.abs(storedRemaining - expected.remainingAmount) > 0.0001) {
    throw new Error('بيانات الفاتورة لا تتطابق مع سجل الدفعات؛ يجب إجراء تصحيح مالي قبل المتابعة');
  }
  return expected;
}

export function calculatePaymentUpdate(
  totalAmount: number,
  paidAmount: number,
  remainingAmount: number,
  amount: unknown
): PaymentCalculation {
  const numericAmount = normalizePaymentAmount(amount);
  const current = assertValidOrderAmounts(totalAmount, paidAmount);
  const storedRemaining = Number(remainingAmount);
  const expectedRemaining = round2(current.total - current.paid);
  if (!Number.isFinite(storedRemaining) || Math.abs(storedRemaining - expectedRemaining) > 0.0001) {
    throw new Error('المبلغ المتبقي في الفاتورة غير متسق مع الإجمالي والمدفوع');
  }
  if (numericAmount > expectedRemaining + 0.0001) {
    throw new Error('مبلغ الدفعة يتجاوز المتبقي على الفاتورة');
  }
  return {
    numericAmount,
    ...calculateOrderAmounts(current.total, current.paid + numericAmount)
  };
}
