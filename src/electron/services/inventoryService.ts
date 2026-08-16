import { InventoryItemType, StockMovement } from '../../types';
import { InventoryMeta, InventoryRepository } from '../repositories/inventoryRepository';

const round2 = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

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

  recordMovement(
    itemType: InventoryItemType,
    itemId: string,
    delta: number,
    direction: StockMovement['direction'],
    reason: string,
    reference?: { type?: string; id?: string; number?: string }
  ): StockMovement {
    const meta = this.repository.getMeta(itemType, itemId);
    const before = round2(meta.quantity);
    const after = round2(before + delta);
    if (after < -0.0001) throw new Error(`لا يمكن تنفيذ الحركة؛ الكمية المتاحة من ${meta.name} غير كافية.`);

    const safeAfter = Math.max(0, after);
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
