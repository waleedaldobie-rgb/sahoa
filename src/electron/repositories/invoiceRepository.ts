import Database from 'better-sqlite3';

export class InvoiceRepository {
  constructor(private readonly db: Database.Database) {}

  list(): any[] {
    return this.db.prepare('SELECT * FROM invoices ORDER BY order_date DESC').all();
  }

  findById(id: string): any | undefined {
    return this.db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  }

  updateAmounts(orderId: string, totalAmount: number, paidAmount: number, remainingAmount: number, paymentStatus: string): void {
    this.db.prepare(`
      UPDATE invoices SET total_amount = ?, paid_amount = ?, remaining_amount = ?, payment_status = ?
      WHERE order_id = ?
    `).run(totalAmount, paidAmount, remainingAmount, paymentStatus, orderId);
  }

  updatePayment(id: string, paidAmount: number, remainingAmount: number, paymentStatus: string, paymentsJson: string): void {
    this.db.prepare(`
      UPDATE invoices SET paid_amount = ?, remaining_amount = ?, payment_status = ?, payments_json = ?
      WHERE id = ?
    `).run(paidAmount, remainingAmount, paymentStatus, paymentsJson, id);
  }
}
