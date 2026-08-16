import { InventoryItemType, StockMovement } from '../../types';
import { InventoryMeta, InventoryRepository } from '../repositories/inventoryRepository';
import { calculateStockBalance, round2 } from '../../services/shared/inventoryRules';

export class InventoryService {
  constructor(private readonly repository: InventoryRepository) {}

  getMeta(itemType: InventoryItemType, itemId: string): InventoryMeta {
    return this.repository.getMeta(itemType, itemId);
  }

  listMovements(itemType?: InventoryItemType, itemId?: string): StockMovement[] {
    return this.repository.listMovements(itemType, itemId).map((row: any) => ({
      id: row.id,
      itemType: row.item_type,
      itemId: row.item_id,
      itemName: row.item_name,
      direction: row.direction,
      quantity: row.quantity,
      quantityBefore: row.quantity_before,
      quantityAfter: row.quantity_after,
      unit: row.unit,
      reason: row.reason,
      referenceType: row.reference_type || undefined,
      referenceId: row.reference_id || undefined,
      referenceNumber: row.reference_number || undefined,
      createdAt: row.created_at
    }));
  }

  adjustStock(itemType: InventoryItemType, itemId: string, quantity: number, reason: string, direction: 'adjustment' | 'return' = 'adjustment'): StockMovement {
    if (!reason || !reason.trim()) throw new Error('سبب التسوية مطلوب');
    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericQuantity) || numericQuantity === 0) throw new Error('كمية التسوية يجب أن تكون رقماً غير صفري');
    const delta = direction === 'return' ? Math.abs(numericQuantity) : numericQuantity;
    return this.recordMovement(itemType, itemId, delta, direction, reason.trim(), { type: 'stock_adjustment', id: itemId });
  }

  recordMovement(
    itemType: InventoryItemType,
    itemId: string,
    delta: number,
    direction: StockMovement['direction'],
    reason: string,
    reference?: { type?: string; id?: string; number?: string }
  ): StockMovement {
    const meta = this.repository.getMeta(itemType, itemId);
    const { before, after: safeAfter } = calculateStockBalance(meta.quantity, delta, meta.name);
    const id = `MOV-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = new Date().toISOString();
    this.repository.updateQuantity(meta, safeAfter, itemId);
    this.repository.insertMovement({
      id,
      itemType,
      itemId,
      itemName: meta.name,
      direction,
      quantity: Math.abs(delta),
      quantityBefore: before,
      quantityAfter: safeAfter,
      unit: meta.unit,
      reason,
      referenceType: reference?.type,
      referenceId: reference?.id,
      referenceNumber: reference?.number,
      createdAt
    });
    return {
      id,
      itemType,
      itemId,
      itemName: meta.name,
      direction,
      quantity: Math.abs(delta),
      quantityBefore: before,
      quantityAfter: safeAfter,
      unit: meta.unit,
      reason,
      referenceType: reference?.type,
      referenceId: reference?.id,
      referenceNumber: reference?.number,
      createdAt
    };
  }
}
