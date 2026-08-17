import { describe, expect, it } from 'vitest';
import { calculatePaymentUpdate, normalizePaymentAmount } from '../domain/paymentRules';

describe('payment domain rules', () => {
  it('normalizes valid positive amounts', () => {
    expect(normalizePaymentAmount('25')).toBe(25);
  });

  it('rejects zero and negative payments with the existing message', () => {
    expect(() => normalizePaymentAmount(0)).toThrow('مبلغ الدفعة يجب أن يكون أكبر من صفر');
    expect(() => normalizePaymentAmount(-1)).toThrow('مبلغ الدفعة يجب أن يكون أكبر من صفر');
  });

  it('rejects payments above the invoice remaining amount', () => {
    expect(() => calculatePaymentUpdate(100, 20, 80, 81)).toThrow('مبلغ الدفعة يتجاوز المتبقي على الفاتورة');
  });

  it('calculates paid, remaining, and status consistently', () => {
    expect(calculatePaymentUpdate(100, 20, 80, 30)).toEqual({
      numericAmount: 30,
      totalAmount: 100,
      paidAmount: 50,
      remainingAmount: 50,
      paymentStatus: 'partial'
    });
  });
});
