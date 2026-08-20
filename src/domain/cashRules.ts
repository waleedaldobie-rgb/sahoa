import { CashSourceType, CashTransaction } from '../types';

export type ManualCashSourceType = Extract<CashSourceType, 'opening_balance' | 'adjustment' | 'withdrawal'>;
export const MANUAL_CASH_SOURCE_TYPES: readonly ManualCashSourceType[] = ['opening_balance', 'adjustment', 'withdrawal'];

export function assertValidManualCashSourceType(value: unknown): ManualCashSourceType {
  if (typeof value !== 'string' || !MANUAL_CASH_SOURCE_TYPES.includes(value as ManualCashSourceType)) {
    throw new Error('مصدر الحركة اليدوية غير صالح؛ استخدم opening_balance أو adjustment أو withdrawal');
  }
  return value as ManualCashSourceType;
}

export interface CashDrawerSummary {
  openingBalance: number;
  income: number;
  out: number;
  balance: number;
}

export function calculateCashDrawerSummary(transactions: CashTransaction[]): CashDrawerSummary {
  const cashTransactions = transactions.filter((transaction) => transaction.paymentMethod === 'cash');
  const openingBalance = cashTransactions
    .filter((transaction) => transaction.sourceType === 'opening_balance')
    .reduce((sum, transaction) => sum + (transaction.direction === 'in' ? transaction.amount : -transaction.amount), 0);
  const income = cashTransactions
    .filter((transaction) => transaction.direction === 'in' && transaction.sourceType !== 'opening_balance')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const out = cashTransactions
    .filter((transaction) => transaction.direction === 'out' && transaction.sourceType !== 'opening_balance')
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  return { openingBalance, income, out, balance: openingBalance + income - out };
}
