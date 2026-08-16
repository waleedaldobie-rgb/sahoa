import Database from 'better-sqlite3';
import { ColorItem } from '../../types';

export class ColorRepository {
  constructor(private readonly db: Database.Database) {}

  list(): ColorItem[] {
    return this.db.prepare('SELECT id, name, hex FROM colors ORDER BY name ASC').all() as ColorItem[];
  }

  insert(item: Partial<ColorItem>): ColorItem {
    const record: ColorItem = {
      id: item.id || `COL-${Date.now()}`,
      name: item.name || 'لون جديد',
      hex: item.hex || '#ffffff'
    };
    this.db.prepare('INSERT INTO colors (id,name,hex) VALUES (?,?,?)').run(record.id, record.name, record.hex);
    return record;
  }

  update(item: ColorItem): void {
    this.db.prepare('UPDATE colors SET name=?, hex=? WHERE id=?').run(item.name, item.hex, item.id);
  }
}
