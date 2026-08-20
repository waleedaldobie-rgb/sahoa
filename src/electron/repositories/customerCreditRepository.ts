import Database from 'better-sqlite3';
import { CustomerCreditRecord } from '../../types';

export class CustomerCreditRepository {
  constructor(private readonly db: Database.Database) {}

  insert(record: CustomerCreditRecord): void {
    this.db.prepare(`
      INSERT INTO customer_credits (
        id, customer_id, order_id, invoice_id, payment_id, entry_type,
        amount, reference_id, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.customerId,
      record.orderId || null,
      record.invoiceId || null,
      record.paymentId || null,
      record.entryType,
      record.amount,
      record.referenceId || null,
      record.notes || null,
      record.createdAt
    );
  }

  findByPaymentId(paymentId: string, entryType: CustomerCreditRecord['entryType'] = 'created'): CustomerCreditRecord | undefined {
    const row = this.db.prepare(`
      SELECT id, customer_id, order_id, invoice_id, payment_id, entry_type,
             amount, reference_id, notes, created_at
      FROM customer_credits
      WHERE payment_id = ? AND entry_type = ?
      ORDER BY created_at ASC, id ASC
      LIMIT 1
    `).get(paymentId, entryType) as any;
    return row ? this.toRecord(row) : undefined;
  }

  listByCustomerId(customerId: string): CustomerCreditRecord[] {
    const rows = this.db.prepare(`
      SELECT id, customer_id, order_id, invoice_id, payment_id, entry_type,
             amount, reference_id, notes, created_at
      FROM customer_credits
      WHERE customer_id = ?
      ORDER BY created_at ASC, id ASC
    `).all(customerId) as any[];
    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(row: any): CustomerCreditRecord {
    return {
      id: row.id,
      customerId: row.customer_id,
      orderId: row.order_id || undefined,
      invoiceId: row.invoice_id || undefined,
      paymentId: row.payment_id || undefined,
      entryType: row.entry_type,
      amount: Number(row.amount),
      referenceId: row.reference_id || undefined,
      notes: row.notes || undefined,
      createdAt: row.created_at
    };
  }
}
