import Database from 'better-sqlite3';

export class OrderRepository {
  constructor(private readonly db: Database.Database) {}

  list(): any[] {
    return this.db.prepare('SELECT * FROM orders ORDER BY order_date DESC, created_at DESC').all();
  }

  listMaterialUsages(orderId?: string): any[] {
    return orderId
      ? this.db.prepare('SELECT * FROM order_material_usages WHERE order_id = ? ORDER BY created_at ASC').all(orderId)
      : this.db.prepare('SELECT * FROM order_material_usages ORDER BY created_at ASC').all();
  }

  findById(id: string): any | undefined {
    return this.db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  }

  findByOrderNumber(orderNumber: string): any | undefined {
    return this.db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber);
  }

  updatePayment(orderId: string, paidAmount: number, remainingAmount: number): void {
    this.db.prepare(`
      UPDATE orders SET paid_amount = ?, remaining_amount = ?
      WHERE id = ?
    `).run(paidAmount, remainingAmount, orderId);
  }

  count(): number {
    return Number((this.db.prepare('SELECT COUNT(*) AS count FROM orders').get() as { count: number }).count || 0);
  }
}
