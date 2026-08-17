import { AppData, CashTransaction, ExpenseRecord } from '../../types';
import { normalizePositiveAmount } from '../../domain/amountRules';
import { round2 } from '../../domain/inventoryRules';
import { findById, hasIdOrSourceId } from '../shared/idempotencyRules';

type DraftPayload = Record<string, any>;

export function applyExpenseToDraft(draft: AppData, payload: DraftPayload): ExpenseRecord {
  const id = payload.id || `EXP-${Date.now()}`;
  const duplicate = findById(draft.expenses, id);
  if (duplicate) return duplicate;
  if (!payload.category?.trim() || !payload.description?.trim()) throw new Error('تصنيف ووصف المصروف مطلوبان');

  const amount = normalizePositiveAmount(payload.amount, 'مبلغ المصروف');
  const now = new Date().toISOString();
  const expense: ExpenseRecord = {
    id,
    category: payload.category.trim(),
    amount: round2(amount),
    expenseDate: payload.expenseDate || now.slice(0, 10),
    paymentMethod: payload.paymentMethod || 'cash',
    description: payload.description.trim(),
    notes: payload.notes || undefined,
    createdAt: now
  };
  draft.expenses = [expense, ...(draft.expenses || [])];
  insertCash(draft, {
    id: `CASH-EXP-${id}`,
    direction: 'out',
    sourceType: 'expense',
    sourceId: id,
    referenceNumber: id,
    amount: expense.amount,
    paymentMethod: expense.paymentMethod,
    transactionDate: expense.expenseDate,
    description: expense.description,
    notes: expense.notes,
    createdAt: now
  });
  return expense;
}

export function applyCashAdjustmentToDraft(draft: AppData, payload: DraftPayload): CashTransaction {
  const amount = normalizePositiveAmount(payload.amount, 'مبلغ الحركة');
  if (!payload.description?.trim()) throw new Error('وصف الحركة المالية مطلوب');

  const id = payload.id || `CASH-${Date.now()}`;
  const duplicate = findById(draft.cashTransactions, id);
  if (duplicate) return duplicate;

  const transaction: CashTransaction = {
    id,
    direction: payload.direction === 'out' ? 'out' : 'in',
    sourceType: payload.sourceType || 'adjustment',
    sourceId: payload.sourceId,
    referenceNumber: payload.referenceNumber,
    amount: round2(amount),
    paymentMethod: payload.paymentMethod || 'cash',
    transactionDate: payload.transactionDate || new Date().toISOString().slice(0, 10),
    description: payload.description.trim(),
    notes: payload.notes,
    createdAt: new Date().toISOString()
  };
  insertCash(draft, transaction);
  return transaction;
}

function insertCash(draft: AppData, transaction: CashTransaction): void {
  if (hasIdOrSourceId(draft.cashTransactions, transaction.id, transaction.sourceId)) return;
  draft.cashTransactions = [transaction, ...(draft.cashTransactions || [])];
}
