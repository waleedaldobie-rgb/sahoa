import Database from 'better-sqlite3';

export class NotificationRepository {
  constructor(private readonly db: Database.Database) {}

  insert(row: {
    id: string; type: string; title: string; message: string; date: string;
    read: boolean; customerPhone: string; orderId?: string | null;
  }): void {
    this.db.prepare(`
      INSERT INTO notifications (id, type, title, message, date, read, customer_phone, order_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(row.id, row.type, row.title, row.message, row.date, row.read ? 1 : 0, row.customerPhone, row.orderId || null);
  }
}
