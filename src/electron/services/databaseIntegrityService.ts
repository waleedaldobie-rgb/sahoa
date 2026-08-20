import Database from 'better-sqlite3';
import { parsePaymentLedger, assertValidPaymentMethod, summarizePaymentLedger } from '../../domain/paymentRules';
import { round2, round4 } from '../../domain/inventoryRules';
import { assertValidOrderStatus } from '../../domain/orderRules';
import { CURRENT_SCHEMA_VERSION } from '../schema';
import { assertValidCashSourceType } from '../../domain/cashRules';

export const BACKUP_SCHEMA_VERSION = 2;
export type IntegritySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface IntegrityIssue {
  code: string;
  table: string;
  recordId?: string;
  field?: string;
  expected: unknown;
  actual: unknown;
  reason: string;
  severity?: IntegritySeverity;
}

export interface IntegrityReport {
  ok: boolean;
  checkedAt: string;
  issues: IntegrityIssue[];
}

const nearlyEqual = (left: number, right: number): boolean => Math.abs(left - right) <= 0.0001;

export class DatabaseIntegrityService {
  constructor(private readonly db: Database.Database) {}

  check(): IntegrityReport {
    const issues: IntegrityIssue[] = [];
    const issue = (data: Omit<IntegrityIssue, 'expected' | 'actual'> & { expected?: unknown; actual?: unknown }) => {
      issues.push({ severity: 'high', expected: data.expected ?? null, actual: data.actual ?? null, ...data });
    };

    const foreignKeys = this.db.pragma('foreign_key_check') as Array<{ table: string; rowid: number; parent: string; fkid: number }>;
    for (const row of foreignKeys) {
      issue({ code: 'ORPHAN_FOREIGN_KEY', table: row.table, recordId: String(row.rowid), expected: 'valid foreign key', actual: row.parent, reason: `Foreign key points to missing parent ${row.parent}` });
    }

    const duplicateOrders = this.db.prepare('SELECT order_number, COUNT(*) AS count FROM orders GROUP BY order_number HAVING COUNT(*) > 1').all() as Array<{ order_number: string; count: number }>;
    for (const row of duplicateOrders) {
      issue({ code: 'DUPLICATE_ORDER_NUMBER', table: 'orders', recordId: row.order_number, expected: 1, actual: row.count, reason: 'Order numbers must be unique and persistent' });
    }

    const duplicateInvoices = this.db.prepare('SELECT order_id, COUNT(*) AS count FROM invoices GROUP BY order_id HAVING COUNT(*) > 1').all() as Array<{ order_id: string; count: number }>;
    for (const row of duplicateInvoices) {
      issue({ code: 'DUPLICATE_INVOICE_ORDER', table: 'invoices', recordId: row.order_id, expected: 1, actual: row.count, reason: 'The configured business rule allows one invoice per order' });
    }

    const cashTransactions = this.db.prepare('SELECT * FROM cash_transactions').all() as any[];
    for (const cash of cashTransactions) {
      try {
        const sourceType = assertValidCashSourceType(cash.source_type);
        const isManual = ['opening_balance', 'adjustment', 'withdrawal'].includes(sourceType);
        const isRefund = sourceType === 'customer_refund' || sourceType === 'customer_credit_refund';
        if ((isManual || isRefund) && (!String(cash.actor_id || '').trim() || !String(cash.reason || '').trim())) {
          issue({ code: 'CASH_AUDIT_METADATA_MISSING', table: 'cash_transactions', recordId: cash.id, field: 'actor_id/reason', expected: 'non-empty actor_id and reason', actual: { actorId: cash.actor_id, reason: cash.reason }, reason: 'Cash movement is missing required audit metadata', severity: 'high' });
        }
        if ((sourceType === 'adjustment' || sourceType === 'withdrawal') && !String(cash.reason || '').trim()) {
          issue({ code: 'CASH_REASON_MISSING', table: 'cash_transactions', recordId: cash.id, field: 'reason', expected: 'non-empty reason', actual: cash.reason, reason: 'Adjustment or withdrawal requires a reason', severity: 'high' });
        }
        if (isRefund && (cash.direction !== 'out' || cash.payment_method !== 'cash' || !String(cash.source_id || '').trim())) {
          issue({ code: 'INVALID_CUSTOMER_REFUND_CASH', table: 'cash_transactions', recordId: cash.id, expected: 'out/cash/linked source_id', actual: cash, reason: 'Customer refund cash movement is not correctly linked', severity: 'critical' });
        }
        if (sourceType === 'customer_payment' && (cash.direction !== 'in' || !String(cash.source_id || '').trim())) {
          issue({ code: 'INVALID_CUSTOMER_PAYMENT_CASH', table: 'cash_transactions', recordId: cash.id, expected: 'in with source_id', actual: cash, reason: 'Customer payment cash movement is not linked to a payment', severity: 'critical' });
        }
        if ((sourceType === 'purchase' || sourceType === 'expense') && (cash.direction !== 'out' || !String(cash.source_id || '').trim())) {
          issue({ code: 'INVALID_BUSINESS_CASH_SOURCE', table: 'cash_transactions', recordId: cash.id, expected: 'out with source_id', actual: cash, reason: 'Business-originated cash movement is not linked to its source record', severity: 'critical' });
        }
      } catch (error: any) {
        issue({ code: 'CASH_SOURCE_NOT_WHITELISTED', table: 'cash_transactions', recordId: cash.id, field: 'source_type', expected: 'approved Cash Drawer source type', actual: cash.source_type, reason: error?.message || 'Cash source type is not allowed', severity: 'critical' });
      }
    }

    const orders = this.db.prepare('SELECT * FROM orders').all() as any[];
    for (const order of orders) {
      const total = Number(order.total_amount);
      const paid = Number(order.paid_amount);
      const remaining = Number(order.remaining_amount);
      let cashReceived = Number(order.cash_received || 0);
      const invoiceLedger = this.db.prepare('SELECT payments_json FROM invoices WHERE order_id = ?').get(order.id) as { payments_json?: string } | undefined;
      if (cashReceived <= 0 && paid > 0 && invoiceLedger) {
        try {
          cashReceived = round2(parsePaymentLedger(invoiceLedger.payments_json).reduce((sum, payment) => sum + Number(payment.cashReceived ?? payment.amount), 0));
        } catch {
          // The invoice loop below reports invalid payment JSON with full record context.
        }
      }
      const overpayment = Number(order.overpayment_amount || 0);
      const writeoff = Number(order.cancellation_writeoff_amount || 0);
      const expectedRemaining = Math.max(0, total - paid - writeoff);
      if (!Number.isFinite(total) || total < 0) issue({ code: 'INVALID_ORDER_AMOUNT', table: 'orders', recordId: order.id, field: 'total_amount', expected: '>= 0', actual: total, reason: 'Order total is negative or non-numeric' });
      if (!Number.isFinite(paid) || paid < 0) issue({ code: 'INVALID_ORDER_AMOUNT', table: 'orders', recordId: order.id, field: 'paid_amount', expected: '>= 0', actual: paid, reason: 'Order paid amount is negative or non-numeric' });
      if (!Number.isFinite(writeoff) || writeoff < 0) issue({ code: 'INVALID_WRITEOFF', table: 'orders', recordId: order.id, field: 'cancellation_writeoff_amount', expected: '>= 0', actual: writeoff, reason: 'Cancellation writeoff must be non-negative' });
      if (writeoff > 0 && order.status !== 'cancelled') issue({ code: 'WRITEOFF_ON_ACTIVE_ORDER', table: 'orders', recordId: order.id, field: 'cancellation_writeoff_amount', expected: 0, actual: writeoff, reason: 'Cancellation writeoff is only valid on cancelled orders', severity: 'critical' });
      if (Number.isFinite(total) && Number.isFinite(paid) && paid > total + 0.0001) issue({ code: 'ORDER_APPLIED_OVER_TOTAL', table: 'orders', recordId: order.id, field: 'paid_amount', expected: `<= ${total}`, actual: paid, reason: 'Applied paid amount cannot exceed invoice total' });
      if (!Number.isFinite(cashReceived) || cashReceived + 0.0001 < paid) issue({ code: 'ORDER_CASH_BELOW_APPLIED', table: 'orders', recordId: order.id, field: 'cash_received', expected: `>= ${paid}`, actual: cashReceived, reason: 'Cash received cannot be below applied paid amount' });
      const expectedOverpayment = Math.max(0, cashReceived - total);
      if (!Number.isFinite(overpayment) || !nearlyEqual(overpayment, expectedOverpayment)) issue({ code: 'ORDER_OVERPAYMENT_MISMATCH', table: 'orders', recordId: order.id, field: 'overpayment_amount', expected: expectedOverpayment, actual: overpayment, reason: 'Overpayment must equal cash received above invoice total' });
      if (Number.isFinite(total) && Number.isFinite(paid) && (!Number.isFinite(remaining) || !nearlyEqual(remaining, expectedRemaining))) issue({ code: 'ORDER_REMAINING_MISMATCH', table: 'orders', recordId: order.id, field: 'remaining_amount', expected: expectedRemaining, actual: remaining, reason: 'Invoice total must equal applied paid plus remaining plus cancellation writeoff' });
      if (order.status === 'cancelled' && remaining > 0.0001) issue({ code: 'CANCELLED_ORDER_UNSETTLED', table: 'orders', recordId: order.id, field: 'remaining_amount', expected: 0, actual: remaining, reason: 'Cancelled order must be paid or settled by cancellation writeoff', severity: 'critical' });
      if (!Number.isInteger(Number(order.garment_count)) || Number(order.garment_count) < 1) issue({ code: 'INVALID_GARMENT_COUNT', table: 'orders', recordId: order.id, field: 'garment_count', expected: 'integer >= 1', actual: order.garment_count, reason: 'Garment count is not a positive integer' });
      if (Number(order.fabric_consumption_meters) < 0) issue({ code: 'NEGATIVE_CONSUMPTION', table: 'orders', recordId: order.id, field: 'fabric_consumption_meters', expected: '>= 0', actual: order.fabric_consumption_meters, reason: 'Order consumption cannot be negative' });
    }

    const invoices = this.db.prepare('SELECT * FROM invoices').all() as any[];
    for (const invoice of invoices) {
      try {
        const payments = parsePaymentLedger(invoice.payments_json);
        const expected = summarizePaymentLedger(payments, invoice.total_amount);
        const writeoff = Number(invoice.cancellation_writeoff_amount || 0);
        const ledgerCashReceived = round2(payments.reduce((sum, payment) => sum + Number(payment.cashReceived ?? payment.amount), 0));
        const storedCashReceived = Number(invoice.cash_received || 0);
        const cashReceived = storedCashReceived > 0 ? storedCashReceived : ledgerCashReceived;
        const expectedOverpayment = Math.max(0, ledgerCashReceived - Number(invoice.total_amount));
        const expectedRemaining = Math.max(0, expected.remainingAmount - writeoff);
        if (!nearlyEqual(Number(invoice.paid_amount), expected.paidAmount)) issue({ code: 'INVOICE_PAYMENT_MISMATCH', table: 'invoices', recordId: invoice.id, field: 'paid_amount', expected: expected.paidAmount, actual: invoice.paid_amount, reason: 'Invoice paid amount differs from payment ledger' });
        if (!nearlyEqual(Number(invoice.remaining_amount), expectedRemaining)) issue({ code: 'INVOICE_REMAINING_MISMATCH', table: 'invoices', recordId: invoice.id, field: 'remaining_amount', expected: expectedRemaining, actual: invoice.remaining_amount, reason: 'Invoice total must equal applied paid plus remaining plus cancellation writeoff' });
        if (storedCashReceived > 0 && !nearlyEqual(storedCashReceived, ledgerCashReceived)) issue({ code: 'INVOICE_CASH_MISMATCH', table: 'invoices', recordId: invoice.id, field: 'cash_received', expected: ledgerCashReceived, actual: invoice.cash_received, reason: 'Invoice cash received differs from payment ledger' });
        if (!nearlyEqual(Number(invoice.overpayment_amount || 0), expectedOverpayment)) issue({ code: 'INVOICE_OVERPAYMENT_MISMATCH', table: 'invoices', recordId: invoice.id, field: 'overpayment_amount', expected: expectedOverpayment, actual: invoice.overpayment_amount, reason: 'Invoice overpayment differs from cash received above invoice total' });
        const order = this.db.prepare('SELECT total_amount, paid_amount, remaining_amount, status, customer_id, cancellation_writeoff_amount FROM orders WHERE id = ?').get(invoice.order_id) as any;
        const expectedStatus = order?.status === 'cancelled' && writeoff > 0 ? 'settled_by_cancellation' : expectedRemaining <= 0.0001 ? 'paid' : expected.paymentStatus;
        if (invoice.payment_status !== expectedStatus) issue({ code: 'INVOICE_STATUS_MISMATCH', table: 'invoices', recordId: invoice.id, field: 'payment_status', expected: expectedStatus, actual: invoice.payment_status, reason: 'Invoice payment status differs from the settlement contract' });
        if (!order) issue({ code: 'ORPHAN_INVOICE', table: 'invoices', recordId: invoice.id, expected: 'existing order', actual: invoice.order_id, reason: 'Invoice references a missing order' });
        else {
          if (!nearlyEqual(Number(invoice.total_amount), Number(order.total_amount))) issue({ code: 'INVOICE_ORDER_TOTAL_MISMATCH', table: 'invoices', recordId: invoice.id, field: 'total_amount', expected: order.total_amount, actual: invoice.total_amount, reason: 'Invoice total differs from order total' });
          if (!nearlyEqual(Number(invoice.paid_amount), Number(order.paid_amount))) issue({ code: 'INVOICE_ORDER_PAID_MISMATCH', table: 'invoices', recordId: invoice.id, field: 'paid_amount', expected: order.paid_amount, actual: invoice.paid_amount, reason: 'Invoice paid differs from order paid' });
          if (!nearlyEqual(Number(invoice.remaining_amount), Number(order.remaining_amount))) issue({ code: 'INVOICE_ORDER_REMAINING_MISMATCH', table: 'invoices', recordId: invoice.id, field: 'remaining_amount', expected: order.remaining_amount, actual: invoice.remaining_amount, reason: 'Invoice remaining differs from order remaining' });
          if (!nearlyEqual(Number(invoice.cancellation_writeoff_amount || 0), Number(order.cancellation_writeoff_amount || 0))) issue({ code: 'INVOICE_ORDER_WRITEOFF_MISMATCH', table: 'invoices', recordId: invoice.id, field: 'cancellation_writeoff_amount', expected: order.cancellation_writeoff_amount, actual: invoice.cancellation_writeoff_amount, reason: 'Invoice writeoff differs from order writeoff' });
        }
        const cash = this.db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM cash_transactions WHERE source_type = 'customer_payment' AND direction = 'in' AND order_id = ?`).get(invoice.order_id) as { total: number };
        if (!nearlyEqual(Number(cash.total), cashReceived)) issue({ code: 'PAYMENT_CASH_MISMATCH', table: 'cash_transactions', recordId: invoice.order_id, field: 'amount', expected: cashReceived, actual: cash.total, reason: 'Customer payment cash ledger does not match cash received in payment ledger' });
        const createdCredits = this.db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM customer_credits WHERE invoice_id = ? AND entry_type = 'created'`).get(invoice.id) as { total: number };
        if (!nearlyEqual(Number(createdCredits.total), expectedOverpayment)) issue({ code: 'CUSTOMER_CREDIT_MISMATCH', table: 'customer_credits', recordId: invoice.id, field: 'amount', expected: expectedOverpayment, actual: createdCredits.total, reason: 'Customer credit created ledger does not match invoice overpayment liability', severity: 'critical' });
      } catch (error: any) {
        issue({ code: 'INVALID_PAYMENT_LEDGER', table: 'invoices', recordId: invoice.id, field: 'payments_json', expected: 'valid unique payment records', actual: error?.message || String(error), reason: 'Invoice payment JSON cannot be reconciled' });
      }
    }

    for (const table of ['fabrics', 'accessories'] as const) {
      const rows = this.db.prepare(`SELECT * FROM ${table}`).all() as any[];
      for (const row of rows) {
        const quantity = table === 'fabrics' ? Number(row.quantity_meters) : Number(row.quantity);
        if (!Number.isFinite(quantity) || quantity < 0) issue({ code: 'NEGATIVE_STOCK', table, recordId: row.id, field: table === 'fabrics' ? 'quantity_meters' : 'quantity', expected: '>= 0', actual: quantity, reason: 'Current stock cannot be negative' });
        const itemType = table === 'fabrics' ? 'fabric' : 'accessory';
        const lastMovement = this.db.prepare(`SELECT quantity_after FROM inventory_movements WHERE item_type = ? AND item_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1`).get(itemType, row.id) as { quantity_after?: number } | undefined;
        if (lastMovement && !nearlyEqual(quantity, Number(lastMovement.quantity_after))) issue({ code: 'STOCK_MOVEMENT_MISMATCH', table, recordId: row.id, field: table === 'fabrics' ? 'quantity_meters' : 'quantity', expected: lastMovement.quantity_after, actual: quantity, reason: 'Current stock differs from the last inventory movement' });
      }
    }

    const customerCredits = this.db.prepare(`
      SELECT * FROM customer_credits
      ORDER BY customer_id, COALESCE(occurred_at, created_at), created_at, id
    `).all() as any[];
    const balanceByCustomer = new Map<string, number>();
    const operationSourceKeys = new Set<string>();
    for (const credit of customerCredits) {
      const amount = Number(credit.amount);
      const customerId = String(credit.customer_id || '');
      const entryType = String(credit.entry_type || '');
      const sign = entryType === 'created' ? 1 : -1;
      if (!customerId || !this.db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId)) {
        issue({ code: 'ORPHAN_CUSTOMER_CREDIT_CUSTOMER', table: 'customer_credits', recordId: credit.id, field: 'customer_id', expected: 'existing customer', actual: customerId, reason: 'Customer credit references a missing customer', severity: 'critical' });
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        issue({ code: 'NEGATIVE_CUSTOMER_CREDIT', table: 'customer_credits', recordId: credit.id, field: 'amount', expected: '> 0', actual: amount, reason: 'Customer credit movement amount must be positive', severity: 'critical' });
        continue;
      }
      if (credit.invoice_id && !this.db.prepare('SELECT id FROM invoices WHERE id = ?').get(credit.invoice_id)) {
        issue({ code: 'ORPHAN_CUSTOMER_CREDIT_INVOICE', table: 'customer_credits', recordId: credit.id, field: 'invoice_id', expected: credit.invoice_id, actual: null, reason: 'Customer credit references a missing invoice', severity: 'critical' });
      }
      if (credit.order_id && !this.db.prepare('SELECT id FROM orders WHERE id = ?').get(credit.order_id)) {
        issue({ code: 'ORPHAN_CUSTOMER_CREDIT_ORDER', table: 'customer_credits', recordId: credit.id, field: 'order_id', expected: credit.order_id, actual: null, reason: 'Customer credit references a missing order', severity: 'critical' });
      }
      if (credit.source_entry_id) {
        const source = this.db.prepare('SELECT id, customer_id, entry_type FROM customer_credits WHERE id = ?').get(credit.source_entry_id) as any;
        if (!source || source.entry_type !== 'created' || source.customer_id !== customerId) {
          issue({ code: 'ORPHAN_CUSTOMER_CREDIT_SOURCE', table: 'customer_credits', recordId: credit.id, field: 'source_entry_id', expected: 'created source for same customer', actual: credit.source_entry_id, reason: 'Customer credit debit references an invalid source entry', severity: 'critical' });
        }
        const sourceKey = `${credit.operation_id || credit.id}:${credit.source_entry_id}`;
        if (operationSourceKeys.has(sourceKey)) {
          issue({ code: 'DUPLICATE_CUSTOMER_CREDIT_OPERATION', table: 'customer_credits', recordId: credit.id, field: 'operation_id', expected: 'one debit per operation/source pair', actual: sourceKey, reason: 'Customer credit operation debits the same source entry more than once', severity: 'critical' });
        }
        operationSourceKeys.add(sourceKey);
      }
      if (credit.target_invoice_id) {
        const target = this.db.prepare(`SELECT i.id, i.order_id, o.customer_id, i.payment_status, i.remaining_amount
          FROM invoices i JOIN orders o ON o.id = i.order_id WHERE i.id = ?`).get(credit.target_invoice_id) as any;
        if (!target || target.customer_id !== customerId || target.payment_status === 'cancelled') {
          issue({ code: 'INVALID_CUSTOMER_CREDIT_TARGET', table: 'customer_credits', recordId: credit.id, field: 'target_invoice_id', expected: 'valid same-customer active invoice', actual: credit.target_invoice_id, reason: 'Customer credit target invoice is invalid', severity: 'critical' });
        }
      }
      const previousBalance = round2(balanceByCustomer.get(customerId) || 0);
      const expectedBalance = round2(previousBalance + sign * amount);
      if (expectedBalance < -0.0001) {
        issue({ code: 'NEGATIVE_CUSTOMER_CREDIT_BALANCE', table: 'customer_credits', recordId: credit.id, field: 'balance_after', expected: '>= 0', actual: expectedBalance, reason: 'Customer credit ledger balance became negative', severity: 'critical' });
      }
      if (credit.balance_after !== null && credit.balance_after !== undefined && !nearlyEqual(Number(credit.balance_after), Math.max(0, expectedBalance))) {
        issue({ code: 'CUSTOMER_CREDIT_BALANCE_AFTER_MISMATCH', table: 'customer_credits', recordId: credit.id, field: 'balance_after', expected: Math.max(0, expectedBalance), actual: credit.balance_after, reason: 'Customer credit balance_after does not match ledger movement', severity: 'critical' });
      }
      balanceByCustomer.set(customerId, Math.max(0, expectedBalance));
      if (credit.entry_type === 'refunded') {
        const cash = this.db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
          FROM cash_transactions WHERE source_type IN ('customer_refund', 'customer_credit_refund', 'withdrawal') AND source_id = ? AND direction = 'out'`).get(credit.operation_id) as any;
        if (credit.method === 'cash' && (!cash || Number(cash.count) === 0 || !nearlyEqual(Number(cash.total), amount))) {
          issue({ code: 'CUSTOMER_CREDIT_CASH_MISMATCH', table: 'customer_credits', recordId: credit.id, field: 'cash_ledger', expected: amount, actual: cash, reason: 'Cash customer credit refund does not match its cash outflow', severity: 'critical' });
        }
        if (credit.method !== 'cash' && cash && Number(cash.count) > 0) {
          issue({ code: 'UNEXPECTED_CUSTOMER_CREDIT_CASH', table: 'customer_credits', recordId: credit.id, field: 'cash_ledger', expected: 0, actual: cash, reason: 'Non-cash customer credit refund has a cash ledger entry', severity: 'critical' });
        }
      }
    }

    const movements = this.db.prepare('SELECT * FROM inventory_movements ORDER BY item_type, item_id, created_at, rowid').all() as any[];
    const movementItemTables: Record<string, string> = { fabric: 'fabrics', accessory: 'accessories' };
    const movementReferenceTables: Record<string, string> = {
      order: 'orders', order_update: 'orders', order_delete: 'orders', order_cancel: 'orders', order_reactivate: 'orders', purchase: 'purchases'
    };
    for (const movement of movements) {
      const itemType = String(movement.item_type || '');
      const itemTable = movementItemTables[itemType];
      if (!itemTable) {
        issue({ code: 'INVALID_MOVEMENT_ITEM_TYPE', table: 'inventory_movements', recordId: movement.id, field: 'item_type', expected: Object.keys(movementItemTables), actual: movement.item_type, reason: 'Inventory movement item_type is not supported', severity: 'critical' });
      } else if (!this.db.prepare(`SELECT id FROM ${itemTable} WHERE id = ?`).get(movement.item_id)) {
        issue({ code: 'ORPHAN_INVENTORY_MOVEMENT', table: 'inventory_movements', recordId: movement.id, field: 'item_id', expected: `${itemType}:${movement.item_id}`, actual: null, reason: 'Inventory movement points to a missing Fabric or Accessory', severity: 'critical' });
      }

      const referenceType = movement.reference_type ? String(movement.reference_type) : '';
      const referenceId = movement.reference_id ? String(movement.reference_id) : '';
      const referenceTable = movementReferenceTables[referenceType];
      if (referenceTable && (!referenceId || !this.db.prepare(`SELECT id FROM ${referenceTable} WHERE id = ?`).get(referenceId))) {
        issue({ code: 'ORPHAN_INVENTORY_REFERENCE', table: 'inventory_movements', recordId: movement.id, field: 'reference_id', expected: `${referenceType}:${referenceId || '<required>'}`, actual: null, reason: 'Inventory movement reference points to a missing Order or Purchase', severity: 'critical' });
      }
      if (movement.direction === 'sale' && (!referenceType || !referenceId)) {
        issue({ code: 'MISSING_INVENTORY_REFERENCE', table: 'inventory_movements', recordId: movement.id, field: 'reference_id', expected: 'reference for sale movement', actual: { referenceType: movement.reference_type, referenceId: movement.reference_id }, reason: 'Sale movement is not traceable to its business operation', severity: 'high' });
      }

      const quantity = Number(movement.quantity);
      const before = Number(movement.quantity_before);
      const after = Number(movement.quantity_after);
      if (!Number.isFinite(quantity) || quantity <= 0) issue({ code: 'INVALID_MOVEMENT_QUANTITY', table: 'inventory_movements', recordId: movement.id, field: 'quantity', expected: '> 0', actual: quantity, reason: 'Movement quantity must be positive' });
      if (before < 0 || after < 0) issue({ code: 'NEGATIVE_MOVEMENT_BALANCE', table: 'inventory_movements', recordId: movement.id, expected: '>= 0', actual: { before, after }, reason: 'Movement balances cannot be negative' });
      if (movement.direction === 'sale' && !nearlyEqual(after, before - quantity)) issue({ code: 'SALE_MOVEMENT_MISMATCH', table: 'inventory_movements', recordId: movement.id, expected: before - quantity, actual: after, reason: 'Sale movement does not reduce stock by its quantity' });
      if (movement.direction === 'purchase' || (movement.direction === 'return' && movement.reference_type !== 'purchase_return')) {
        if (!nearlyEqual(after, before + quantity)) issue({ code: 'INBOUND_MOVEMENT_MISMATCH', table: 'inventory_movements', recordId: movement.id, expected: before + quantity, actual: after, reason: 'Inbound movement does not increase stock by its quantity' });
      }
      if (movement.direction === 'return' && movement.reference_type === 'purchase_return' && !nearlyEqual(after, before - quantity)) {
        issue({ code: 'PURCHASE_RETURN_MOVEMENT_MISMATCH', table: 'inventory_movements', recordId: movement.id, expected: before - quantity, actual: after, reason: 'Purchase return must reduce stock by its returned quantity', severity: 'critical' });
      }
      if (movement.direction === 'adjustment' && !nearlyEqual(Math.abs(after - before), quantity)) issue({ code: 'ADJUSTMENT_MOVEMENT_MISMATCH', table: 'inventory_movements', recordId: movement.id, expected: Math.abs(after - before), actual: quantity, reason: 'Adjustment movement quantity differs from balance delta' });
      if (movement.unit_cost !== null && movement.unit_cost !== undefined) {
        const unitCost = Number(movement.unit_cost);
        const expectedCost = round4(quantity * unitCost);
        if (!Number.isFinite(unitCost) || unitCost < 0) issue({ code: 'INVALID_MOVEMENT_UNIT_COST', table: 'inventory_movements', recordId: movement.id, field: 'unit_cost', expected: '>= 0', actual: movement.unit_cost, reason: 'Inventory movement unit cost is invalid', severity: 'critical' });
        if (movement.total_cost !== null && movement.total_cost !== undefined && !nearlyEqual(Number(movement.total_cost), expectedCost)) issue({ code: 'MOVEMENT_TOTAL_COST_MISMATCH', table: 'inventory_movements', recordId: movement.id, field: 'total_cost', expected: expectedCost, actual: movement.total_cost, reason: 'Inventory movement total cost is not quantity multiplied by unit cost', severity: 'critical' });
      }
    }

    const movementsById = new Map<string, any>(movements.map((movement) => [String(movement.id), movement]));
    const movementUsageOwner = new Map<string, string>();
    const usages = this.db.prepare('SELECT * FROM order_material_usages').all() as any[];
    for (const usage of usages) {
      const quantity = Number(usage.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) issue({ code: 'INVALID_MATERIAL_USAGE', table: 'order_material_usages', recordId: usage.id, field: 'quantity', expected: '> 0', actual: usage.quantity, reason: 'Material usage quantity must be positive' });
      const expectedCost = round2(quantity * Number(usage.unit_cost_at_usage));
      if (!nearlyEqual(Number(usage.total_cost), expectedCost)) issue({ code: 'MATERIAL_COST_MISMATCH', table: 'order_material_usages', recordId: usage.id, field: 'total_cost', expected: expectedCost, actual: usage.total_cost, reason: 'Historical material cost is not quantity multiplied by unit cost' });
      const order = this.db.prepare('SELECT id, status FROM orders WHERE id = ?').get(usage.order_id) as { id: string; status: string } | undefined;
      if (!order) issue({ code: 'ORPHAN_MATERIAL_USAGE', table: 'order_material_usages', recordId: usage.id, expected: usage.order_id, actual: null, reason: 'Material usage references a missing order', severity: 'critical' });
      if (!usage.source_movement_id) {
        if (!order || order.status !== 'cancelled') issue({ code: 'MISSING_SOURCE_MOVEMENT', table: 'order_material_usages', recordId: usage.id, field: 'source_movement_id', expected: 'movement id for active usage', actual: null, reason: 'Non-cancelled material usage has no source inventory movement', severity: 'critical' });
        continue;
      }
      const movement = movementsById.get(String(usage.source_movement_id));
      if (!movement) {
        issue({ code: 'MISSING_SOURCE_MOVEMENT', table: 'order_material_usages', recordId: usage.id, field: 'source_movement_id', expected: usage.source_movement_id, actual: null, reason: 'Material usage references a missing inventory movement', severity: 'critical' });
        continue;
      }
      const owner = movementUsageOwner.get(String(movement.id));
      if (owner && owner !== String(usage.id)) issue({ code: 'CONFLICTING_SOURCE_MOVEMENT', table: 'order_material_usages', recordId: usage.id, field: 'source_movement_id', expected: 'one usage per movement', actual: movement.id, reason: `Inventory movement is already used by material usage ${owner}`, severity: 'high' });
      movementUsageOwner.set(String(movement.id), String(usage.id));
      if (movement.item_type !== usage.item_type || String(movement.item_id) !== String(usage.item_id) || movement.direction !== 'sale' || !nearlyEqual(Number(movement.quantity), quantity) || String(movement.reference_id || '') !== String(usage.order_id)) issue({ code: 'SOURCE_MOVEMENT_MISMATCH', table: 'order_material_usages', recordId: usage.id, field: 'source_movement_id', expected: { itemType: usage.item_type, itemId: usage.item_id, direction: 'sale', quantity, orderId: usage.order_id }, actual: movement, reason: 'Source inventory movement does not match material usage', severity: 'critical' });
    }

    const expenses = this.db.prepare('SELECT * FROM expenses').all() as any[];
    for (const expense of expenses) {
      const cash = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
        FROM cash_transactions
        WHERE source_type = 'expense' AND direction = 'out' AND source_id = ?
      `).get(expense.id) as { total: number; count: number };
      if (Number(cash.count) === 0) issue({ code: 'MISSING_EXPENSE_CASH', table: 'expenses', recordId: expense.id, field: 'cash_ledger', expected: 'matching expense cash outflow', actual: null, reason: 'Expense has no matching cash ledger entry', severity: 'critical' });
      else if (!nearlyEqual(Number(cash.total), Number(expense.amount))) issue({ code: 'EXPENSE_CASH_MISMATCH', table: 'expenses', recordId: expense.id, field: 'cash_ledger.amount', expected: expense.amount, actual: cash.total, reason: 'Expense cash ledger does not match expense amount', severity: 'critical' });
    }

    const purchases = this.db.prepare('SELECT * FROM purchases').all() as any[];
    for (const purchase of purchases) {
      const sum = this.db.prepare('SELECT COALESCE(SUM(total_amount), 0) AS total FROM purchase_lines WHERE purchase_id = ?').get(purchase.id) as { total: number };
      if (!nearlyEqual(Number(purchase.total_amount), Number(sum.total))) issue({ code: 'PURCHASE_TOTAL_MISMATCH', table: 'purchases', recordId: purchase.id, field: 'total_amount', expected: sum.total, actual: purchase.total_amount, reason: 'Purchase total differs from its line totals' });
      const cash = this.db.prepare(`
        SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
        FROM cash_transactions
        WHERE source_type = 'purchase' AND direction = 'out' AND source_id = ?
      `).get(purchase.id) as { total: number; count: number };
      if (Number(cash.count) === 0) issue({ code: 'MISSING_PURCHASE_CASH', table: 'purchases', recordId: purchase.id, field: 'cash_ledger', expected: 'matching purchase cash outflow', actual: null, reason: 'Purchase has no matching cash ledger entry', severity: 'critical' });
      else if (!nearlyEqual(Number(cash.total), Number(purchase.total_amount))) issue({ code: 'PURCHASE_CASH_MISMATCH', table: 'purchases', recordId: purchase.id, field: 'cash_ledger.amount', expected: purchase.total_amount, actual: cash.total, reason: 'Purchase cash ledger does not match purchase total', severity: 'critical' });
    }

    return { ok: issues.length === 0, checkedAt: new Date().toISOString(), issues };
  }

  static validateRestorePayload(payload: any): IntegrityReport {
    const issues: IntegrityIssue[] = [];
    const add = (data: Omit<IntegrityIssue, 'expected' | 'actual'> & { expected?: unknown; actual?: unknown }) => issues.push({ severity: 'high', expected: data.expected ?? null, actual: data.actual ?? null, ...data });
    if (!payload || typeof payload !== 'object') add({ code: 'INVALID_BACKUP_ROOT', table: 'backup', expected: 'object', actual: typeof payload, reason: 'Backup root must be an object', severity: 'critical' });
    const backupVersion = payload?.backupSchemaVersion ?? 1;
    if (backupVersion !== 1 && backupVersion !== BACKUP_SCHEMA_VERSION) {
      add({ code: 'UNSUPPORTED_BACKUP_SCHEMA', table: 'backup', field: 'backupSchemaVersion', expected: [1, BACKUP_SCHEMA_VERSION], actual: backupVersion, reason: 'Backup schema version is not supported', severity: 'critical' });
    }
    if (payload?.backupSchemaVersion === BACKUP_SCHEMA_VERSION && payload?.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      add({ code: 'SCHEMA_VERSION_MISMATCH', table: 'backup', field: 'schemaVersion', expected: CURRENT_SCHEMA_VERSION, actual: payload?.schemaVersion, reason: 'Backup database schema does not match the application schema', severity: 'critical' });
    }
    const required = ['customers', 'fabrics', 'accessories', 'thobeTypes', 'colors', 'orders', 'invoices', 'notifications', 'stockMovements', 'purchases', 'expenses', 'cashTransactions', 'orderMaterialUsages', 'orderEvents'];
    if (payload?.backupSchemaVersion === BACKUP_SCHEMA_VERSION) required.push('customerCredits');
    for (const key of required) if (!Array.isArray(payload?.[key])) add({ code: 'MISSING_COLLECTION', table: 'backup', field: key, expected: 'array', actual: typeof payload?.[key], reason: 'Required operational collection is missing', severity: 'critical' });
    if (issues.length > 0) return { ok: false, checkedAt: new Date().toISOString(), issues };

    const ids = new Map<string, string>();
    const collect = (table: string, rows: any[]) => {
      for (const row of rows) {
        if (!row?.id) { add({ code: 'MISSING_ID', table, expected: 'id', actual: row, reason: 'Record has no stable id' }); continue; }
        const key = String(row.id);
        const previous = ids.get(`${table}:${key}`);
        if (previous) add({ code: 'DUPLICATE_ID', table, recordId: key, expected: 'unique id', actual: key, reason: `Duplicate id in ${table}` });
        ids.set(`${table}:${key}`, table);
      }
    };
    for (const key of required) collect(key, payload[key]);
    const customerCredits = Array.isArray(payload.customerCredits) ? payload.customerCredits : [];

    const orderNumbers = new Set<string>();
    const ordersById = new Map<string, any>(payload.orders.map((order: any) => [String(order.id), order]));
    const customersById = new Map<string, any>(payload.customers.map((customer: any) => [String(customer.id), customer]));
    const fabricsById = new Map<string, any>(payload.fabrics.map((fabric: any) => [String(fabric.id), fabric]));
    const accessoriesById = new Map<string, any>(payload.accessories.map((accessory: any) => [String(accessory.id), accessory]));
    for (const order of payload.orders) {
      if (orderNumbers.has(String(order.orderNumber))) add({ code: 'DUPLICATE_ORDER_NUMBER', table: 'orders', recordId: String(order.id), expected: 'unique order number', actual: order.orderNumber, reason: 'Backup contains duplicate order number', severity: 'critical' });
      orderNumbers.add(String(order.orderNumber));
      try {
        const status = assertValidOrderStatus(order.status);
        const amounts = summarizePaymentLedger([], order.totalAmount);
        const paid = Number(order.paidAmount);
        const remaining = Number(order.remainingAmount);
        const writeoff = Number(order.cancellationWriteoffAmount || 0);
        const cashReceived = Number(order.cashReceived ?? paid);
        const expectedRemaining = Math.max(0, amounts.totalAmount - paid - writeoff);
        if (!Number.isFinite(paid) || paid < 0 || paid > amounts.totalAmount + 0.0001 || !Number.isFinite(writeoff) || writeoff < 0 || (writeoff > 0 && status !== 'cancelled') || !Number.isFinite(remaining) || !nearlyEqual(remaining, expectedRemaining) || (status === 'cancelled' && remaining > 0.0001) || !Number.isFinite(cashReceived) || cashReceived + 0.0001 < paid || !nearlyEqual(Number(order.overpaymentAmount || 0), Math.max(0, cashReceived - amounts.totalAmount))) add({ code: 'INVALID_ORDER_PAYMENT', table: 'orders', recordId: order.id, expected: { paid: `0..${amounts.totalAmount}`, remaining: expectedRemaining, cashReceived: `>= ${paid}`, writeoff: 'only when cancelled' }, actual: { paid, remaining, cashReceived, writeoff, overpaymentAmount: order.overpaymentAmount }, reason: 'Backup order settlement aggregate is invalid' });
      } catch (error: any) {
        add({ code: 'INVALID_ORDER_AMOUNT_OR_STATUS', table: 'orders', recordId: order.id, expected: 'valid amount and status', actual: error?.message || String(error), reason: 'Backup order amount or status is invalid', severity: 'critical' });
      }
      if (!customersById.has(String(order.customerId))) add({ code: 'ORPHAN_ORDER_CUSTOMER', table: 'orders', recordId: order.id, expected: order.customerId, actual: null, reason: 'Order customer is missing from backup', severity: 'critical' });
      if (order.fabricId && !fabricsById.has(String(order.fabricId))) add({ code: 'ORPHAN_ORDER_FABRIC', table: 'orders', recordId: order.id, expected: order.fabricId, actual: null, reason: 'Order fabric is missing from backup', severity: 'critical' });
    }

    const invoiceOrderIds = new Set<string>();
    const invoicesByOrder = new Map<string, any>();
    for (const invoice of (payload.invoices || [])) {
      if (invoiceOrderIds.has(String(invoice.orderId))) add({ code: 'DUPLICATE_INVOICE_ORDER', table: 'invoices', recordId: String(invoice.id), expected: 'one invoice per order', actual: invoice.orderId, reason: 'Backup contains multiple invoices for one order' });
      invoiceOrderIds.add(String(invoice.orderId));
      invoicesByOrder.set(String(invoice.orderId), invoice);
      if (!payload.orders.some((order: any) => order.id === invoice.orderId)) add({ code: 'ORPHAN_INVOICE', table: 'invoices', recordId: invoice.id, expected: invoice.orderId, actual: null, reason: 'Invoice order is missing from backup' });
      try {
        if (!Array.isArray(invoice.payments)) {
          add({ code: 'MISSING_PAYMENT_LEDGER', table: 'invoices', recordId: invoice.id, field: 'payments', expected: 'array', actual: typeof invoice.payments, reason: 'Invoice payment ledger is missing', severity: 'critical' });
          continue;
        }
        const payments = invoice.payments;
        const expected = summarizePaymentLedger(payments, invoice.totalAmount);
        const writeoff = Number(invoice.cancellationWriteoffAmount || 0);
        const cashReceived = payments.reduce((sum: number, payment: any) => sum + Number(payment.cashReceived ?? payment.amount), 0);
        const expectedRemaining = Math.max(0, expected.remainingAmount - writeoff);
        const expectedOverpayment = Math.max(0, cashReceived - Number(invoice.totalAmount));
        const order = ordersById.get(String(invoice.orderId));
        const expectedStatus = order?.status === 'cancelled' && writeoff > 0 ? 'settled_by_cancellation' : expectedRemaining <= 0.0001 ? 'paid' : expected.paymentStatus;
        if (!nearlyEqual(Number(invoice.paidAmount), expected.paidAmount) || !nearlyEqual(Number(invoice.remainingAmount), expectedRemaining) || !nearlyEqual(Number(invoice.cashReceived ?? 0), cashReceived) || !nearlyEqual(Number(invoice.overpaymentAmount || 0), expectedOverpayment)) add({ code: 'INVOICE_PAYMENT_MISMATCH', table: 'invoices', recordId: invoice.id, expected: { paid: expected.paidAmount, remaining: expectedRemaining, cashReceived, overpaymentAmount: expectedOverpayment }, actual: { paid: invoice.paidAmount, remaining: invoice.remainingAmount, cashReceived: invoice.cashReceived, overpaymentAmount: invoice.overpaymentAmount }, reason: 'Backup invoice settlement aggregates do not match the Invoice Payment Ledger', severity: 'critical' });
        if (invoice.paymentStatus !== expectedStatus) add({ code: 'INVOICE_STATUS_MISMATCH', table: 'invoices', recordId: invoice.id, field: 'paymentStatus', expected: expectedStatus, actual: invoice.paymentStatus, reason: 'Backup invoice payment status differs from the settlement contract', severity: 'critical' });
        if (order && !nearlyEqual(Number(order.totalAmount), Number(invoice.totalAmount))) add({ code: 'INVOICE_ORDER_TOTAL_MISMATCH', table: 'invoices', recordId: invoice.id, expected: order.totalAmount, actual: invoice.totalAmount, reason: 'Invoice total differs from its order total', severity: 'critical' });
        if (order && (!nearlyEqual(Number(order.paidAmount), expected.paidAmount) || !nearlyEqual(Number(order.remainingAmount), expectedRemaining) || !nearlyEqual(Number(order.cancellationWriteoffAmount || 0), writeoff))) add({ code: 'ORDER_PAYMENT_PROJECTION_MISMATCH', table: 'orders', recordId: order.id, expected: { paid: expected.paidAmount, remaining: expectedRemaining, writeoff, source: 'invoice.paymentLedger' }, actual: { paid: order.paidAmount, remaining: order.remainingAmount, writeoff: order.cancellationWriteoffAmount }, reason: 'Order payment projections do not match the Invoice Settlement Ledger', severity: 'critical' });
        for (const payment of payments) assertValidPaymentMethod(payment.method);
      } catch (error: any) {
        add({ code: 'INVALID_PAYMENT_LEDGER', table: 'invoices', recordId: invoice.id, expected: 'valid payments with supported methods', actual: error?.message || String(error), reason: 'Backup invoice payments are invalid', severity: 'critical' });
      }
    }
    const creditCreatedByInvoice = new Map<string, number>();
    const creditPaymentIds = new Set<string>();
    for (const credit of customerCredits) {
      const amount = Number(credit.amount);
      const customer = customersById.get(String(credit.customerId));
      const invoice = payload.invoices.find((item: any) => String(item.id) === String(credit.invoiceId));
      if (!customer) add({ code: 'ORPHAN_CUSTOMER_CREDIT', table: 'customerCredits', recordId: credit.id, expected: credit.customerId, actual: null, reason: 'Customer credit references a missing customer', severity: 'critical' });
      if (!['created', 'applied', 'refunded'].includes(String(credit.entryType))) add({ code: 'INVALID_CUSTOMER_CREDIT_TYPE', table: 'customerCredits', recordId: credit.id, field: 'entryType', expected: ['created', 'applied', 'refunded'], actual: credit.entryType, reason: 'Customer credit entry type is invalid', severity: 'critical' });
      if (!Number.isFinite(amount) || amount < 0) add({ code: 'INVALID_CUSTOMER_CREDIT_AMOUNT', table: 'customerCredits', recordId: credit.id, field: 'amount', expected: '>= 0', actual: credit.amount, reason: 'Customer credit amount is invalid', severity: 'critical' });
      if (credit.invoiceId && !invoice) add({ code: 'ORPHAN_CUSTOMER_CREDIT_INVOICE', table: 'customerCredits', recordId: credit.id, expected: credit.invoiceId, actual: null, reason: 'Customer credit references a missing invoice', severity: 'critical' });
      if (credit.paymentId) {
        const key = `${credit.paymentId}:${credit.entryType}`;
        if (creditPaymentIds.has(key)) add({ code: 'DUPLICATE_CUSTOMER_CREDIT_PAYMENT', table: 'customerCredits', recordId: credit.id, expected: 'one entry per payment and type', actual: key, reason: 'Customer credit ledger contains a duplicate payment entry', severity: 'critical' });
        creditPaymentIds.add(key);
      }
      if (credit.entryType === 'created' && credit.invoiceId) creditCreatedByInvoice.set(String(credit.invoiceId), (creditCreatedByInvoice.get(String(credit.invoiceId)) || 0) + amount);
    }
    for (const invoice of payload.invoices) {
      const payments = Array.isArray(invoice.payments) ? invoice.payments : [];
      const cashReceived = payments.reduce((sum: number, payment: any) => sum + Number(payment.cashReceived ?? payment.amount), 0);
      const expectedOverpayment = Math.max(0, cashReceived - Number(invoice.totalAmount));
      const createdCredit = creditCreatedByInvoice.get(String(invoice.id)) || 0;
      if (!nearlyEqual(createdCredit, expectedOverpayment)) add({ code: 'CUSTOMER_CREDIT_MISMATCH', table: 'customerCredits', recordId: invoice.id, expected: expectedOverpayment, actual: createdCredit, reason: 'Customer credit creation ledger does not match invoice overpayment liability', severity: 'critical' });
    }
    for (const order of payload.orders) {
      if (!invoicesByOrder.has(String(order.id))) add({ code: 'MISSING_ORDER_INVOICE', table: 'orders', recordId: order.id, expected: 'one invoice per order', actual: null, reason: 'Order has no Invoice record in the backup; payment truth cannot be reconstructed', severity: 'critical' });
    }
    for (const fabric of payload.fabrics) if (!Number.isFinite(Number(fabric.quantityMeters)) || Number(fabric.quantityMeters) < 0) add({ code: 'NEGATIVE_STOCK', table: 'fabrics', recordId: fabric.id, expected: '>= 0', actual: fabric.quantityMeters, reason: 'Backup fabric quantity is negative', severity: 'critical' });
    for (const accessory of payload.accessories) if (!Number.isFinite(Number(accessory.quantity)) || Number(accessory.quantity) < 0) add({ code: 'NEGATIVE_STOCK', table: 'accessories', recordId: accessory.id, expected: '>= 0', actual: accessory.quantity, reason: 'Backup accessory quantity is negative', severity: 'critical' });

    const movementsById = new Map<string, any>();
    for (const movement of payload.stockMovements) {
      if (movementsById.has(String(movement.id))) add({ code: 'DUPLICATE_MOVEMENT_ID', table: 'stockMovements', recordId: movement.id, expected: 'unique id', actual: movement.id, reason: 'Backup contains duplicate inventory movement id', severity: 'critical' });
      movementsById.set(String(movement.id), movement);
      const itemExists = movement.itemType === 'fabric' ? fabricsById.has(String(movement.itemId)) : movement.itemType === 'accessory' ? accessoriesById.has(String(movement.itemId)) : false;
      if (!itemExists) add({ code: 'ORPHAN_STOCK_MOVEMENT', table: 'stockMovements', recordId: movement.id, expected: `${movement.itemType}:${movement.itemId}`, actual: null, reason: 'Inventory movement points to a missing item', severity: 'critical' });
      const quantity = Number(movement.quantity);
      const before = Number(movement.quantityBefore);
      const after = Number(movement.quantityAfter);
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(before) || before < 0 || !Number.isFinite(after) || after < 0) add({ code: 'INVALID_STOCK_MOVEMENT', table: 'stockMovements', recordId: movement.id, expected: 'positive quantity and non-negative balances', actual: { quantity, before, after }, reason: 'Inventory movement values are invalid', severity: 'critical' });
      if (movement.direction === 'sale' && !nearlyEqual(after, before - quantity)) add({ code: 'SALE_MOVEMENT_MISMATCH', table: 'stockMovements', recordId: movement.id, expected: before - quantity, actual: after, reason: 'Sale movement balance is inconsistent', severity: 'critical' });
      if ((movement.direction === 'purchase' || movement.direction === 'return') && !nearlyEqual(after, before + quantity)) add({ code: 'INBOUND_MOVEMENT_MISMATCH', table: 'stockMovements', recordId: movement.id, expected: before + quantity, actual: after, reason: 'Inbound movement balance is inconsistent', severity: 'critical' });
    }

    const movementUsageOwner = new Map<string, string>();
    for (const usage of payload.orderMaterialUsages) {
      const order = ordersById.get(String(usage.orderId));
      const quantity = Number(usage.quantity);
      if (!order) add({ code: 'ORPHAN_MATERIAL_USAGE', table: 'orderMaterialUsages', recordId: usage.id, expected: usage.orderId, actual: null, reason: 'Material usage points to a missing order', severity: 'critical' });
      if (!Number.isFinite(quantity) || quantity <= 0) add({ code: 'INVALID_MATERIAL_USAGE', table: 'orderMaterialUsages', recordId: usage.id, expected: '> 0', actual: usage.quantity, reason: 'Material usage quantity must be positive', severity: 'critical' });
      if (!Number.isFinite(Number(usage.unitCostAtUsage)) || Number(usage.unitCostAtUsage) < 0 || !nearlyEqual(Number(usage.totalCost), quantity * Number(usage.unitCostAtUsage))) add({ code: 'MATERIAL_COST_MISMATCH', table: 'orderMaterialUsages', recordId: usage.id, expected: quantity * Number(usage.unitCostAtUsage), actual: usage.totalCost, reason: 'Material cost is not quantity multiplied by unit cost', severity: 'high' });
      if (!usage.sourceMovementId) {
        if (!order || order.status !== 'cancelled') add({ code: 'MISSING_SOURCE_MOVEMENT', table: 'orderMaterialUsages', recordId: usage.id, field: 'sourceMovementId', expected: 'movement id for active usage', actual: null, reason: 'Non-cancelled material usage has no source inventory movement', severity: 'critical' });
        continue;
      }
      const movement = movementsById.get(String(usage.sourceMovementId));
      if (!movement) {
        add({ code: 'MISSING_SOURCE_MOVEMENT', table: 'orderMaterialUsages', recordId: usage.id, field: 'sourceMovementId', expected: usage.sourceMovementId, actual: null, reason: 'Material usage references a missing inventory movement', severity: 'critical' });
        continue;
      }
      const owner = movementUsageOwner.get(String(movement.id));
      if (owner && owner !== String(usage.id)) add({ code: 'CONFLICTING_SOURCE_MOVEMENT', table: 'orderMaterialUsages', recordId: usage.id, field: 'sourceMovementId', expected: 'one usage per movement', actual: movement.id, reason: `Inventory movement is already used by material usage ${owner}`, severity: 'high' });
      movementUsageOwner.set(String(movement.id), String(usage.id));
      if (movement.itemType !== usage.itemType || String(movement.itemId) !== String(usage.itemId) || movement.direction !== 'sale' || !nearlyEqual(Number(movement.quantity), quantity) || String(movement.referenceId || '') !== String(usage.orderId)) add({ code: 'SOURCE_MOVEMENT_MISMATCH', table: 'orderMaterialUsages', recordId: usage.id, field: 'sourceMovementId', expected: { itemType: usage.itemType, itemId: usage.itemId, direction: 'sale', quantity, orderId: usage.orderId }, actual: movement, reason: 'Source inventory movement does not match material usage', severity: 'critical' });
    }

    const cashBySource = new Map<string, any>();
    const paymentById = new Map<string, any>();
    for (const invoice of payload.invoices) for (const payment of (Array.isArray(invoice.payments) ? invoice.payments : [])) paymentById.set(String(payment.id), { payment, invoice });
    for (const cash of payload.cashTransactions) {
      try { assertValidPaymentMethod(cash.paymentMethod ?? 'cash'); } catch (error: any) { add({ code: 'INVALID_PAYMENT_METHOD', table: 'cashTransactions', recordId: cash.id, field: 'paymentMethod', expected: ['cash', 'card', 'transfer'], actual: cash.paymentMethod, reason: error.message, severity: 'critical' }); }
      if (!Number.isFinite(Number(cash.amount)) || Number(cash.amount) < 0) add({ code: 'INVALID_CASH_AMOUNT', table: 'cashTransactions', recordId: cash.id, field: 'amount', expected: '>= 0', actual: cash.amount, reason: 'Cash transaction amount is invalid', severity: 'critical' });
      if (cash.orderId && !ordersById.has(String(cash.orderId))) add({ code: 'ORPHAN_CASH_ORDER', table: 'cashTransactions', recordId: cash.id, expected: cash.orderId, actual: null, reason: 'Cash transaction points to a missing order', severity: 'critical' });
      if (cash.sourceId) cashBySource.set(String(cash.sourceId), cash);
      if (cash.sourceType === 'customer_payment') {
        const payment = paymentById.get(String(cash.sourceId));
        if (!payment || payment.invoice.orderId !== cash.orderId || !nearlyEqual(Number(payment.payment.cashReceived ?? payment.payment.amount), Number(cash.amount))) add({ code: 'PAYMENT_CASH_MISMATCH', table: 'cashTransactions', recordId: cash.id, expected: 'matching invoice payment cashReceived', actual: { sourceId: cash.sourceId, orderId: cash.orderId, amount: cash.amount }, reason: 'Customer payment cash transaction has no matching payment ledger entry', severity: 'critical' });
      }
      if (cash.sourceType === 'expense' && !payload.expenses.some((expense: any) => String(expense.id) === String(cash.sourceId) && cash.direction === 'out' && nearlyEqual(Number(expense.amount), Number(cash.amount)))) add({ code: 'EXPENSE_CASH_MISMATCH', table: 'cashTransactions', recordId: cash.id, expected: cash.sourceId, actual: cash.amount, reason: 'Expense cash transaction has no matching expense', severity: 'critical' });
    }
    for (const [paymentId, entry] of paymentById) if (!cashBySource.has(paymentId)) add({ code: 'MISSING_PAYMENT_CASH', table: 'invoices', recordId: entry.invoice.id, field: 'payments', expected: paymentId, actual: null, reason: 'Payment ledger entry has no customer_payment cash transaction', severity: 'critical' });

    for (const purchase of payload.purchases) {
      try { assertValidPaymentMethod(purchase.paymentMethod ?? 'cash'); } catch (error: any) { add({ code: 'INVALID_PAYMENT_METHOD', table: 'purchases', recordId: purchase.id, field: 'paymentMethod', expected: ['cash', 'card', 'transfer'], actual: purchase.paymentMethod, reason: error.message, severity: 'critical' }); }
      if (!Array.isArray(purchase.lines) || purchase.lines.length === 0) add({ code: 'MISSING_PURCHASE_LINES', table: 'purchases', recordId: purchase.id, expected: 'at least one line', actual: purchase.lines, reason: 'Purchase has no line-level audit data', severity: 'critical' });
      const lineTotal = (purchase.lines || []).reduce((sum: number, line: any) => sum + Number(line.totalAmount || 0), 0);
      if (!nearlyEqual(Number(purchase.totalAmount), lineTotal)) add({ code: 'PURCHASE_TOTAL_MISMATCH', table: 'purchases', recordId: purchase.id, expected: lineTotal, actual: purchase.totalAmount, reason: 'Purchase total differs from line totals', severity: 'critical' });
      for (const line of (purchase.lines || [])) {
        if (!Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0 || !Number.isFinite(Number(line.unitPrice)) || Number(line.unitPrice) < 0 || !nearlyEqual(Number(line.totalAmount), Number(line.quantity) * Number(line.unitPrice))) add({ code: 'INVALID_PURCHASE_LINE', table: 'purchases', recordId: line.id, expected: 'positive quantity, non-negative price, total=quantity*price', actual: line, reason: 'Purchase line is not auditable', severity: 'critical' });
      }
      const purchaseCash = (payload.cashTransactions || []).filter((cash: any) => cash.sourceType === 'purchase' && String(cash.sourceId) === String(purchase.id) && cash.direction === 'out');
      const purchaseCashTotal = purchaseCash.reduce((sum: number, cash: any) => sum + Number(cash.amount || 0), 0);
      if (purchaseCash.length === 0) add({ code: 'MISSING_PURCHASE_CASH', table: 'purchases', recordId: purchase.id, field: 'cashTransactions', expected: 'matching purchase cash outflow', actual: null, reason: 'Backup purchase has no matching cash ledger entry', severity: 'critical' });
      else if (!nearlyEqual(Number(purchaseCashTotal), Number(purchase.totalAmount))) add({ code: 'PURCHASE_CASH_MISMATCH', table: 'purchases', recordId: purchase.id, field: 'cashTransactions.amount', expected: purchase.totalAmount, actual: purchaseCashTotal, reason: 'Backup purchase cash ledger does not match purchase total', severity: 'critical' });
    }
    for (const expense of payload.expenses) {
      try { assertValidPaymentMethod(expense.paymentMethod ?? 'cash'); } catch (error: any) { add({ code: 'INVALID_PAYMENT_METHOD', table: 'expenses', recordId: expense.id, field: 'paymentMethod', expected: ['cash', 'card', 'transfer'], actual: expense.paymentMethod, reason: error.message, severity: 'critical' }); }
      if (!Number.isFinite(Number(expense.amount)) || Number(expense.amount) < 0) add({ code: 'INVALID_EXPENSE_AMOUNT', table: 'expenses', recordId: expense.id, expected: '>= 0', actual: expense.amount, reason: 'Expense amount is invalid', severity: 'critical' });
      if (!payload.cashTransactions.some((cash: any) => cash.sourceType === 'expense' && String(cash.sourceId) === String(expense.id) && cash.direction === 'out' && nearlyEqual(Number(cash.amount), Number(expense.amount)))) add({ code: 'MISSING_EXPENSE_CASH', table: 'expenses', recordId: expense.id, expected: 'matching expense cash transaction', actual: null, reason: 'Expense has no auditable cash ledger entry', severity: 'critical' });
    }
    for (const event of payload.orderEvents) if (!ordersById.has(String(event.orderId))) add({ code: 'ORPHAN_ORDER_EVENT', table: 'orderEvents', recordId: event.id, expected: event.orderId, actual: null, reason: 'Order event points to a missing order', severity: 'high' });
    for (const notification of payload.notifications) if (notification.orderId && !ordersById.has(String(notification.orderId))) add({ code: 'ORPHAN_NOTIFICATION', table: 'notifications', recordId: notification.id, expected: notification.orderId, actual: null, reason: 'Notification points to a missing order', severity: 'high' });

    return { ok: issues.length === 0, checkedAt: new Date().toISOString(), issues };
  }
}
