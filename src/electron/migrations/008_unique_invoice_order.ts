import { Migration } from './types';

export const migration008: Migration = {
  version: 8,
  name: 'unique_invoice_per_order',
  up(db) {
    const duplicates = db.prepare(`
      SELECT order_id, COUNT(*) AS count
      FROM invoices
      GROUP BY order_id
      HAVING COUNT(*) > 1
    `).all() as Array<{ order_id: string; count: number }>;
    if (duplicates.length > 0) {
      const details = duplicates.map((row) => `${row.order_id} (${row.count})`).join(', ');
      throw new Error(`تعذر إضافة قيد فاتورة واحدة لكل طلب؛ توجد فواتير مكررة للطلبات: ${details}`);
    }
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_order_unique ON invoices(order_id)');
  }
};
