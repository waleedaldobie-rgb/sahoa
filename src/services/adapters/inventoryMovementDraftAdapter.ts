import {
  AccessoryItem,
  AppData,
  FabricItem,
  InventoryItemType,
  PurchaseLine,
  PurchaseRecord,
  StockMovement,
  CashTransaction
} from '../../types';
import { calculateStockBalance, round2 } from '../shared/inventoryRules';
import { assertValidPaymentMethod } from '../../domain/paymentRules';
import { findById, hasIdOrSourceId } from '../shared/idempotencyRules';
import { createSafeId } from '../../domain/idGenerator';

type PurchasePayload = Record<string, any>;
type InventoryMeta = {
  item: FabricItem | AccessoryItem;
  name: string;
  quantity: number;
  unit: string;
  purchasePrice: number;
};

export function insertStockMovementInDraft(
  draft: AppData,
  itemType: InventoryItemType,
  itemId: string,
  delta: number,
  direction: StockMovement['direction'],
  reason: string,
  reference?: { type?: string; id?: string; number?: string }
): StockMovement {
  const meta = getInventoryMeta(draft, itemType, itemId);
  const { before, after } = calculateStockBalance(meta.quantity, delta, meta.name);
  writeQuantity(itemType, meta, after);
  const movement: StockMovement = {
    id: createSafeId('MOV'),
    itemType,
    itemId,
    itemName: meta.name,
    direction,
    quantity: Math.abs(delta),
    quantityBefore: before,
    quantityAfter: after,
    unit: meta.unit,
    reason,
    referenceType: reference?.type,
    referenceId: reference?.id,
    referenceNumber: reference?.number,
    createdAt: new Date().toISOString()
  };
  draft.stockMovements = [movement, ...(draft.stockMovements || [])];
  return movement;
}

export function createPurchaseInDraft(draft: AppData, payload: PurchasePayload): PurchaseRecord {
  const purchaseId = payload.id || createSafeId('PUR');
  const paymentMethod = assertValidPaymentMethod(payload.paymentMethod ?? 'cash');
  const duplicate = findById(draft.purchases, purchaseId);
  if (duplicate) return duplicate;
  if (!payload.supplier?.trim()) throw new Error('اسم المورد مطلوب');
  if (!Array.isArray(payload.lines) || payload.lines.length === 0) throw new Error('أضف صنفاً واحداً على الأقل إلى المشتريات');

  const now = new Date().toISOString();
  const purchaseDate = payload.purchaseDate || now.slice(0, 10);
  const preparedLines: PurchaseLine[] = [];
  let totalAmount = 0;
  for (const input of payload.lines) {
    const quantity = Number(input.quantity);
    const unitPrice = Number(input.unitPrice);
    if (!input.itemType || !input.itemId || !Number.isFinite(quantity) || quantity <= 0) throw new Error('بيانات كمية المشتريات غير صحيحة');
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error('سعر الشراء لا يمكن أن يكون سالباً');
    const meta = getInventoryMeta(draft, input.itemType, input.itemId);
    insertStockMovementInDraft(draft, input.itemType, input.itemId, quantity, 'purchase', `شراء من المورد ${payload.supplier.trim()}`, { type: 'purchase', id: purchaseId, number: payload.invoiceNumber || purchaseId });
    setPurchasePrice(input.itemType, meta, unitPrice);
    const lineTotal = round2(quantity * unitPrice);
    totalAmount += lineTotal;
    preparedLines.push({ id: createSafeId('PURL'), purchaseId, itemType: input.itemType, itemId: input.itemId, itemName: input.itemName || meta.name, quantity, unit: input.unit || meta.unit, unitPrice, totalAmount: lineTotal, createdAt: now });
  }

  const purchase: PurchaseRecord = {
    id: purchaseId,
    supplier: payload.supplier.trim(),
    invoiceNumber: payload.invoiceNumber || undefined,
    purchaseDate,
    totalAmount: round2(totalAmount),
    paymentMethod,
    notes: payload.notes || undefined,
    status: 'approved',
    lines: preparedLines,
    createdAt: now
  };
  draft.purchases = [purchase, ...(draft.purchases || [])];
  if (totalAmount > 0) {
    insertCashInDraft(draft, {
      id: `CASH-PUR-${purchaseId}`,
      direction: 'out',
      sourceType: 'purchase',
      sourceId: purchaseId,
      referenceNumber: payload.invoiceNumber || purchaseId,
      amount: round2(totalAmount),
      paymentMethod,
      transactionDate: purchaseDate,
      description: `شراء مخزون من ${payload.supplier.trim()}`,
      notes: payload.notes || undefined,
      createdAt: now
    });
  }
  return purchase;
}

export function getInventoryMeta(draft: AppData, itemType: InventoryItemType, itemId: string): InventoryMeta {
  if (itemType === 'fabric') {
    const item = draft.fabrics.find((fabric) => fabric.id === itemId);
    if (!item) throw new Error('صنف القماش غير موجود');
    return { item, name: item.name, quantity: item.quantityMeters, unit: 'متر', purchasePrice: item.purchasePrice || 0 };
  }
  const item = draft.accessories.find((accessory) => accessory.id === itemId);
  if (!item) throw new Error('صنف الإكسسوار غير موجود');
  return { item, name: item.name, quantity: item.quantity, unit: item.unit, purchasePrice: item.purchasePrice || 0 };
}

function writeQuantity(itemType: InventoryItemType, meta: InventoryMeta, value: number): void {
  if (itemType === 'fabric') (meta.item as FabricItem).quantityMeters = round2(value);
  else (meta.item as AccessoryItem).quantity = round2(value);
}

function setPurchasePrice(itemType: InventoryItemType, meta: InventoryMeta, value: number): void {
  if (itemType === 'fabric') (meta.item as FabricItem).purchasePrice = value;
  else (meta.item as AccessoryItem).purchasePrice = value;
}

function insertCashInDraft(draft: AppData, transaction: CashTransaction): void {
  if (hasIdOrSourceId(draft.cashTransactions, transaction.id, transaction.sourceId)) return;
  draft.cashTransactions = [transaction, ...(draft.cashTransactions || [])];
}
