import Database from 'better-sqlite3';
import { AccessoryItem } from '../../types';

export class AccessoryRepository {
  constructor(private readonly db: Database.Database) {}

  list(): AccessoryItem[] {
    const rows = this.db.prepare('SELECT * FROM accessories ORDER BY category ASC, name ASC').all() as any[];
    return rows.map((row): AccessoryItem => ({
      id: row.id,
      name: row.name,
      category: row.category,
      quantity: row.quantity || 0,
      minStock: row.min_stock || 0,
      unit: row.unit,
      purchasePrice: row.purchase_price || 0,
      sellingPrice: row.selling_price || 0
    }));
  }

  insert(accessory: Partial<AccessoryItem>): AccessoryItem {
    const id = accessory.id || `ACC-${Date.now()}`;
    const record: AccessoryItem = {
      id,
      name: accessory.name || 'عنصر',
      category: accessory.category || 'عام',
      quantity: accessory.quantity || 0,
      minStock: accessory.minStock || 5,
      unit: accessory.unit || 'حبة',
      purchasePrice: accessory.purchasePrice || 0,
      sellingPrice: accessory.sellingPrice || 0
    };
    this.db.prepare(`
      INSERT INTO accessories (id, name, category, quantity, min_stock, unit, purchase_price, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(record.id, record.name, record.category, record.quantity, record.minStock, record.unit, record.purchasePrice || 0, new Date().toISOString());
    return record;
  }

  update(accessory: AccessoryItem): void {
    this.db.prepare(`
      UPDATE accessories SET name = ?, category = ?, quantity = ?, min_stock = ?, unit = ?, purchase_price = ?, selling_price = ? WHERE id = ?
    `).run(accessory.name, accessory.category, accessory.quantity, accessory.minStock, accessory.unit, accessory.purchasePrice || 0, accessory.sellingPrice || 0, accessory.id);
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM accessories WHERE id = ?').run(id);
  }
}
