import Database from 'better-sqlite3';
import { parsePaymentLedger, summarizePaymentLedger } from '../../domain/paymentRules';

export interface IntegrityIssue {
  code: string;
  table: string;
  recordId?: string;
  field?: string;
  expected: unknown;
  actual: unknown;
  reason: string;
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
      issues.push({ expected: data.expected ?? null, actual: data.actual ?? null, ...data });
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

    const orders = this.db.prepare('SELECT * FROM orders').all() as any[];
    for (const order of orders) {
      const total = Number(order.total_amount);
      const paid = Number(order.paid_amount);
      const remaining = Number(order.remaining_amount);
      if (!Number.isFinite(total) || total < 0) issue({ code: 'INVALID_ORDER_AMOUNT', table: 'orders', recordId: order.id, field: 'total_amount', expected: '>= 0', actual: total, reason: 'Order total is negative or non-numeric' });
      if (!Number.isFinite(paid) || paid < 0) issue({ code: 'INVALID_ORDER_AMOUNT', table: 'orders', recordId: order.id, field: 'paid_amount', expected: '>= 0', actual: paid, reason: 'Order paid amount is negative or non-numeric' });
      if (Number.isFinite(total) && Number.isFinite(paid) && paid > total + 0.0001) issue({ code: 'ORDER_OVERPAYMENT', table: 'orders', recordId: order.id, field: 'paid_amount', expected: `<= ${total}`, actual: paid, reason: 'Order is overpaid without a refund/credit rule' });
      if (Number.isFinite(total) && Number.isFinite(paid) && (!Number.isFinite(remaining) || !nearlyEqual(remaining, Math.max(0, total - paid)))) issue({ code: 'ORDER_REMAINING_MISMATCH', table: 'orders', recordId: order.id, field: 'remaining_amount', expected: Math.max(0, total - paid), actual: remaining, reason: 'Remaining does not equal total minus paid' });
      if (!Number.isInteger(Number(order.garment_count)) || Number(order.garment_count) < 1) issue({ code: 'INVALID_GARMENT_COUNT', table: 'orders', recordId: order.id, field: 'garment_count', expected: 'integer >= 1', actual: order.garment_count, reason: 'Garment count is not a positive integer' });
      if (Number(order.fabric_consumption_meters) < 0) issue({ code: 'NEGATIVE_CONSUMPTION', table: 'orders', recordId: order.id, field: 'fabric_consumption_meters', expected: '>= 0', actual: order.fabric_consumption_meters, reason: 'Order consumption cannot be negative' });
    }

    const invoices = this.db.prepare('SELECT * FROM invoices').all() as any[];
    for (const invoice of invoices) {
      try {
        const payments = parsePaymentLedger(invoice.payments_json);
        const expected = summarizePaymentLedger(payments, invoice.total_amount);
        if (!nearlyEqual(Number(invoice.paid_amount), expected.paidAmount)) issue({ code: 'INVOICE_PAYMENT_MISMATCH', table: 'invoices', recordId: invoice.id, field: 'paid_amount', expected: expected.paidAmount, actual: invoice.paid_amount, reason: 'Invoice paid amount differs from payment ledger' });
        if (!nearlyEqual(Number(invoice.remaining_amount), expected.remainingAmount)) issue({ code: 'INVOICE_REMAINING_MISMATCH', table: 'invoices', recordId: invoice.id, field: 'remaining_amount', expected: expected.remainingAmount, actual: invoice.remaining_amount, reason: 'Invoice remaining differs from payment ledger' });
        const order = this.db.prepare('SELECT total_amount, paid_amount, remaining_amount FROM orders WHERE id = ?').get(invoice.order_id) as any;
        if (!order) issue({ code: 'ORPHAN_INVOICE', table: 'invoices', recordId: invoice.id, expected: 'existing order', actual: invoice.order_id, reason: 'Invoice references a missing order' });
        else {
          if (!nearlyEqual(Number(invoice.total_amount), Number(order.total_amount))) issue({ code: 'INVOICE_ORDER_TOTAL_MISMATCH', table: 'invoices', recordId: invoice.id, field: 'total_amount', expected: order.total_amount, actual: invoice.total_amount, reason: 'Invoice total differs from order total' });
          if (!nearlyEqual(Number(invoice.paid_amount), Number(order.paid_amount))) issue({ code: 'INVOICE_ORDER_PAID_MISMATCH', table: 'invoices', recordId: invoice.id, field: 'paid_amount', expected: order.paid_amount, actual: invoice.paid_amount, reason: 'Invoice paid differs from order paid' });
          if (!nearlyEqual(Number(invoice.remaining_amount), Number(order.remaining_amount))) issue({ code: 'INVOICE_ORDER_REMAINING_MISMATCH', table: 'invoices', recordId: invoice.id, field: 'remaining_amount', expected: order.remaining_amount, actual: invoice.remaining_amount, reason: 'Invoice remaining differs from order remaining' });
        }
        const cash = this.db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM cash_transactions WHERE source_type = 'customer_payment' AND direction = 'in' AND order_id = ?`).get(invoice.order_id) as { total: number };
        if (!nearlyEqual(Number(cash.total), expected.paymentsTotal)) issue({ code: 'PAYMENT_CASH_MISMATCH', table: 'cash_transactions', recordId: invoice.order_id, field: 'amount', expected: expected.paymentsTotal, actual: cash.total, reason: 'Customer payment cash ledger does not match payment ledger' });
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

    const movements = this.db.prepare('SELECT * FROM inventory_movements ORDER BY item_type, item_id, created_at, rowid').all() as any[];
    for (const movement of movements) {
      const quantity = Number(movement.quantity);
      const before = Number(movement.quantity_before);
      const after = Number(movement.quantity_after);
      if (!Number.isFinite(quantity) || quantity <= 0) issue({ code: 'INVALID_MOVEMENT_QUANTITY', table: 'inventory_movements', recordId: movement.id, field: 'quantity', expected: '> 0', actual: quantity, reason: 'Movement quantity must be positive' });
      if (before < 0 || after < 0) issue({ code: 'NEGATIVE_MOVEMENT_BALANCE', table: 'inventory_movements', recordId: movement.id, expected: '>= 0', actual: { before, after }, reason: 'Movement balances cannot be negative' });
      if (movement.direction === 'sale' && !nearlyEqual(after, before - quantity)) issue({ code: 'SALE_MOVEMENT_MISMATCH', table: 'inventory_movements', recordId: movement.id, expected: before - quantity, actual: after, reason: 'Sale movement does not reduce stock by its quantity' });
      if (movement.direction === 'purchase' || movement.direction === 'return') {
        if (!nearlyEqual(after, before + quantity)) issue({ code: 'INBOUND_MOVEMENT_MISMATCH', table: 'inventory_movements', recordId: movement.id, expected: before + quantity, actual: after, reason: 'Inbound movement does not increase stock by its quantity' });
      }
      if (movement.direction === 'adjustment' && !nearlyEqual(Math.abs(after - before), quantity)) issue({ code: 'ADJUSTMENT_MOVEMENT_MISMATCH', table: 'inventory_movements', recordId: movement.id, expected: Math.abs(after - before), actual: quantity, reason: 'Adjustment movement quantity differs from balance delta' });
    }

    const usages = this.db.prepare('SELECT * FROM order_material_usages').all() as any[];
    for (const usage of usages) {
      if (!Number.isFinite(Number(usage.quantity)) || Number(usage.quantity) <= 0) issue({ code: 'INVALID_MATERIAL_USAGE', table: 'order_material_usages', recordId: usage.id, field: 'quantity', expected: '> 0', actual: usage.quantity, reason: 'Material usage quantity must be positive' });
      const expectedCost = Number(usage.quantity) * Number(usage.unit_cost_at_usage);
      if (!nearlyEqual(Number(usage.total_cost), expectedCost)) issue({ code: 'MATERIAL_COST_MISMATCH', table: 'order_material_usages', recordId: usage.id, field: 'total_cost', expected: expectedCost, actual: usage.total_cost, reason: 'Historical material cost is not quantity multiplied by unit cost' });
      const order = this.db.prepare('SELECT id FROM orders WHERE id = ?').get(usage.order_id);
      if (!order) issue({ code: 'ORPHAN_MATERIAL_USAGE', table: 'order_material_usages', recordId: usage.id, expected: usage.order_id, actual: null, reason: 'Material usage references a missing order' });
    }

    const purchases = this.db.prepare('SELECT * FROM purchases').all() as any[];
    for (const purchase of purchases) {
      const sum = this.db.prepare('SELECT COALESCE(SUM(total_amount), 0) AS total FROM purchase_lines WHERE purchase_id = ?').get(purchase.id) as { total: number };
      if (!nearlyEqual(Number(purchase.total_amount), Number(sum.total))) issue({ code: 'PURCHASE_TOTAL_MISMATCH', table: 'purchases', recordId: purchase.id, field: 'total_amount', expected: sum.total, actual: purchase.total_amount, reason: 'Purchase total differs from its line totals' });
    }

    return { ok: issues.length === 0, checkedAt: new Date().toISOString(), issues };
  }

  static validateRestorePayload(payload: any): IntegrityReport {
    const issues: IntegrityIssue[] = [];
    const add = (data: Omit<IntegrityIssue, 'expected' | 'actual'> & { expected?: unknown; actual?: unknown }) => issues.push({ expected: data.expected ?? null, actual: data.actual ?? null, ...data });
    if (!payload || typeof payload !== 'object') add({ code: 'INVALID_BACKUP_ROOT', table: 'backup', expected: 'object', actual: typeof payload, reason: 'Backup root must be an object' });
    const required = ['customers', 'orders', 'fabrics', 'accessories', 'thobeTypes', 'colors'];
    for (const key of required) if (!Array.isArray(payload?.[key])) add({ code: 'MISSING_COLLECTION', table: 'backup', field: key, expected: 'array', actual: typeof payload?.[key], reason: 'Required collection is missing' });
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
    for (const key of ['invoices', 'stockMovements', 'purchases', 'expenses', 'cashTransactions', 'orderMaterialUsages', 'orderEvents', 'notifications']) if (Array.isArray(payload[key])) collect(key, payload[key]);

    const orderNumbers = new Set<string>();
    for (const order of payload.orders) {
      if (orderNumbers.has(String(order.orderNumber))) add({ code: 'DUPLICATE_ORDER_NUMBER', table: 'orders', recordId: String(order.id), expected: 'unique order number', actual: order.orderNumber, reason: 'Backup contains duplicate order number' });
      orderNumbers.add(String(order.orderNumber));
      try {
        const amounts = summarizePaymentLedger([], order.totalAmount);
        if (Number(order.paidAmount) < 0 || Number(order.paidAmount) > amounts.totalAmount + 0.0001) add({ code: 'INVALID_ORDER_PAYMENT', table: 'orders', recordId: order.id, expected: `0..${amounts.totalAmount}`, actual: order.paidAmount, reason: 'Backup order payment is invalid' });
      } catch (error: any) {
        add({ code: 'INVALID_ORDER_AMOUNT', table: 'orders', recordId: order.id, expected: 'valid non-negative total', actual: error?.message || String(error), reason: 'Backup order amount is invalid' });
      }
      if (!payload.customers.some((customer: any) => customer.id === order.customerId)) add({ code: 'ORPHAN_ORDER_CUSTOMER', table: 'orders', recordId: order.id, expected: order.customerId, actual: null, reason: 'Order customer is missing from backup' });
    }

    const invoiceOrderIds = new Set<string>();
    for (const invoice of (payload.invoices || [])) {
      if (invoiceOrderIds.has(String(invoice.orderId))) add({ code: 'DUPLICATE_INVOICE_ORDER', table: 'invoices', recordId: String(invoice.id), expected: 'one invoice per order', actual: invoice.orderId, reason: 'Backup contains multiple invoices for one order' });
      invoiceOrderIds.add(String(invoice.orderId));
      if (!payload.orders.some((order: any) => order.id === invoice.orderId)) add({ code: 'ORPHAN_INVOICE', table: 'invoices', recordId: invoice.id, expected: invoice.orderId, actual: null, reason: 'Invoice order is missing from backup' });
      try {
        const payments = Array.isArray(invoice.payments) ? invoice.payments : [];
        const expected = summarizePaymentLedger(payments, invoice.totalAmount);
        if (!nearlyEqual(Number(invoice.paidAmount), expected.paidAmount) || !nearlyEqual(Number(invoice.remainingAmount), expected.remainingAmount)) add({ code: 'INVOICE_PAYMENT_MISMATCH', table: 'invoices', recordId: invoice.id, expected: { paid: expected.paidAmount, remaining: expected.remainingAmount }, actual: { paid: invoice.paidAmount, remaining: invoice.remainingAmount }, reason: 'Backup invoice aggregates do not match payments' });
      } catch (error: any) {
        add({ code: 'INVALID_PAYMENT_LEDGER', table: 'invoices', recordId: invoice.id, expected: 'valid payments', actual: error?.message || String(error), reason: 'Backup invoice payments are invalid' });
      }
    }
    for (const fabric of payload.fabrics) if (!Number.isFinite(Number(fabric.quantityMeters)) || Number(fabric.quantityMeters) < 0) add({ code: 'NEGATIVE_STOCK', table: 'fabrics', recordId: fabric.id, expected: '>= 0', actual: fabric.quantityMeters, reason: 'Backup fabric quantity is negative' });
    for (const accessory of payload.accessories) if (!Number.isFinite(Number(accessory.quantity)) || Number(accessory.quantity) < 0) add({ code: 'NEGATIVE_STOCK', table: 'accessories', recordId: accessory.id, expected: '>= 0', actual: accessory.quantity, reason: 'Backup accessory quantity is negative' });

    return { ok: issues.length === 0, checkedAt: new Date().toISOString(), issues };
  }
}
