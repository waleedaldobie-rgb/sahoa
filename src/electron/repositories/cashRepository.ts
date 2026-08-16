import Database from 'better-sqlite3';
import { CashTransaction } from '../../types';

export class CashRepository {
  constructor(private readonly db: Database.Database) {}

  insert(transaction: CashTransaction): void {
    this.db.prepare(`
      INSERT INTO cash_transactions (
        id, direction, source_type, source_id, order_id, reference_number, amount,
        payment_method, transaction_date, description, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      transaction.id,
      transaction.direction,
      transaction.sourceType,
      transaction.sourceId || null,
      transaction.orderId || null,
      transaction.referenceNumber || null,
      Math.round((Number(transaction.amount) + Number.EPSILON) * 100) / 100,
      transaction.paymentMethod,
      transaction.transactionDate,
      transaction.description,
      transaction.notes || null,
      transaction.createdAt
    );
  }

  list(): any[] {
    return this.db.prepare('SELECT * FROM cash_transactions ORDER BY transaction_date DESC, created_at DESC').all();
  }

  findById(id: string): any | undefined {
    return this.db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(id);
  }

  findBySourceId(sourceId: string): any | undefined {
    return this.db.prepare('SELECT id FROM cash_transactions WHERE source_id = ?').get(sourceId);
  }
}
