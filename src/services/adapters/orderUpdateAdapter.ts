import { AppData, Order } from '../../types';
import { calculateOrderAmounts } from '../../domain/orderRules';
import { round2 } from '../shared/inventoryRules';

export function updateOrderInvoiceInDraft(
  draft: AppData,
  updatedOrder: Order,
  totalAmount: number,
  paidAmount: number
): void {
  const { remainingAmount, paymentStatus } = calculateOrderAmounts(totalAmount, paidAmount);
  updatedOrder.remainingAmount = remainingAmount;
  draft.invoices = draft.invoices.map((invoice) => invoice.orderId === updatedOrder.id
    ? {
        ...invoice,
        customerName: updatedOrder.customerName,
        customerPhone: updatedOrder.customerPhone,
        totalAmount,
        paidAmount,
        remainingAmount,
        paymentStatus
      }
    : invoice);
}

export function updateOrderFabricStockInDraft(
  draft: AppData,
  existingOrder: Order,
  updatedOrder: Order,
  newMeters: number
): void {
  const fabricChanged = existingOrder.fabricId !== updatedOrder.fabricId;
  const countChanged = existingOrder.garmentCount !== updatedOrder.garmentCount;
  if (!(fabricChanged || countChanged) || (existingOrder.status as string) === 'cancelled') return;

  if (existingOrder.fabricId) {
    const oldFabric = draft.fabrics.find((fabric) => fabric.id === existingOrder.fabricId);
    if (oldFabric) {
      oldFabric.quantityMeters = round2(oldFabric.quantityMeters + (existingOrder.fabricConsumptionMeters || 0));
    }
  }

  if (updatedOrder.fabricId) {
    const newFabric = draft.fabrics.find((fabric) => fabric.id === updatedOrder.fabricId);
    if (!newFabric) throw new Error('القماش الجديد المختار غير موجود');
    if (newFabric.quantityMeters < newMeters) {
      throw new Error(`الكمية المتاحة من القماش الجديدة (${newFabric.quantityMeters} متر) غير كافية للطلب (${newMeters} متر).`);
    }
    newFabric.quantityMeters = round2(newFabric.quantityMeters - newMeters);
    updatedOrder.fabricBuyPriceAtOrder = newFabric.purchasePrice || 0;
  }
}
