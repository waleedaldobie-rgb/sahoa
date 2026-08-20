import { AppData, InventoryItemType, StockMovement } from '../../types';
import { assertStoredPaymentAggregates } from '../../domain/paymentRules';
import { round2 } from '../shared/inventoryRules';

const nearlyEqual = (left: number, right: number) => Math.abs(left - right) <= 0.0001;
const numeric = (value: unknown) => {
  const result = Number(value || 0);
  if (!Number.isFinite(result)) throw new Error('قيمة مالية أو مخزنية غير رقمية');
  return result;
};

const assertMovement = (data: AppData, movement: StockMovement) => {
  const item = movement.itemType === 'fabric'
    ? data.fabrics.find((row) => row.id === movement.itemId)
    : data.accessories.find((row) => row.id === movement.itemId);
  if (!item) throw new Error(`حركة المخزون تشير إلى صنف غير موجود: ${movement.id}`);
  const quantity = numeric(movement.quantity);
  const before = numeric(movement.quantityBefore);
  const after = numeric(movement.quantityAfter);
  if (quantity <= 0 || before < 0 || after < 0) throw new Error(`حركة مخزون غير صالحة: ${movement.id}`);
  if (movement.direction === 'sale' && !nearlyEqual(after, before - quantity)) throw new Error(`حركة بيع لا تطابق رصيد المخزون: ${movement.id}`);
  if ((movement.direction === 'purchase' || movement.direction === 'return') && !nearlyEqual(after, before + quantity)) throw new Error(`حركة إدخال لا تطابق رصيد المخزون: ${movement.id}`);
};

export function assertMockBusinessIntegrity(data: AppData): void {
  const invoicesByOrder = new Map(data.invoices.map((invoice) => [invoice.orderId, invoice]));
  const ordersById = new Map(data.orders.map((order) => [order.id, order]));
  const customersById = new Set(data.customers.map((customer) => customer.id));
  const creditsById = new Set<string>();
  const createdCreditsByInvoice = new Map<string, number>();

  for (const credit of data.customerCredits || []) {
    if (!credit.id || creditsById.has(credit.id)) throw new Error(`معرف customer credit مكرر: ${credit.id}`);
    creditsById.add(credit.id);
    if (!customersById.has(credit.customerId)) throw new Error(`customer credit دون عميل: ${credit.id}`);
    if (!['created', 'applied', 'refunded'].includes(credit.entryType)) throw new Error(`نوع customer credit غير صالح: ${credit.id}`);
    if (!Number.isFinite(Number(credit.amount)) || Number(credit.amount) <= 0) throw new Error(`مبلغ customer credit غير صالح: ${credit.id}`);
    if (credit.orderId && !ordersById.has(credit.orderId)) throw new Error(`customer credit يشير إلى طلب غير موجود: ${credit.id}`);
    if (credit.invoiceId && !data.invoices.some((invoice) => invoice.id === credit.invoiceId)) throw new Error(`customer credit يشير إلى فاتورة غير موجودة: ${credit.id}`);
    if (credit.entryType === 'created' && credit.invoiceId) {
      createdCreditsByInvoice.set(credit.invoiceId, round2((createdCreditsByInvoice.get(credit.invoiceId) || 0) + Number(credit.amount)));
    }
  }

  for (const invoice of data.invoices) {
    const order = ordersById.get(invoice.orderId);
    if (!order) throw new Error(`فاتورة دون طلب: ${invoice.id}`);
    const payments = invoice.payments || [];
    const ledger = assertStoredPaymentAggregates(invoice.totalAmount, invoice.paidAmount, invoice.remainingAmount, payments, invoice.cancellationWriteoffAmount);
    const cashReceived = round2(payments.reduce((sum, payment) => sum + Number(payment.cashReceived ?? payment.amount), 0));
    const overpayment = round2(Math.max(0, cashReceived - Number(invoice.totalAmount)));
    const writeoff = numeric(invoice.cancellationWriteoffAmount);
    const expectedRemaining = round2(Math.max(0, Number(invoice.totalAmount) - ledger.paidAmount - writeoff));
    if (!nearlyEqual(Number(invoice.cashReceived || 0), cashReceived)) throw new Error(`cash_received لا يطابق payment ledger: ${invoice.id}`);
    if (!nearlyEqual(Number(invoice.overpaymentAmount || 0), overpayment)) throw new Error(`overpayment_amount لا يطابق payment ledger: ${invoice.id}`);
    if (!nearlyEqual(Number(invoice.remainingAmount), expectedRemaining)) throw new Error(`remaining_amount لا يطابق settlement contract: ${invoice.id}`);
    if (writeoff > 0 && order.status !== 'cancelled') throw new Error(`writeoff على طلب غير ملغى: ${invoice.id}`);
    if (order.status === 'cancelled' && Number(invoice.remainingAmount) > 0.0001) throw new Error(`طلب ملغى غير مسوى: ${invoice.id}`);
    const expectedStatus = order.status === 'cancelled' && writeoff > 0 ? 'settled_by_cancellation' : expectedRemaining <= 0.0001 ? 'paid' : ledger.paymentStatus;
    if (invoice.paymentStatus !== expectedStatus) throw new Error(`payment status لا يطابق settlement contract: ${invoice.id}`);
    if (!nearlyEqual(Number(order.paidAmount), Number(invoice.paidAmount)) || !nearlyEqual(Number(order.remainingAmount), Number(invoice.remainingAmount))) throw new Error(`order/invoice financial aggregates غير متطابقة: ${invoice.id}`);
    if (!nearlyEqual(Number(order.cashReceived || 0), Number(invoice.cashReceived || 0)) || !nearlyEqual(Number(order.overpaymentAmount || 0), Number(invoice.overpaymentAmount || 0))) throw new Error(`order/invoice cash aggregates غير متطابقة: ${invoice.id}`);
    if (!nearlyEqual(createdCreditsByInvoice.get(invoice.id) || 0, overpayment)) throw new Error(`customer credit لا يطابق overpayment: ${invoice.id}`);
  }

  for (const order of data.orders) {
    const invoice = invoicesByOrder.get(order.id);
    if (order.status === 'cancelled' && invoice && Number(order.remainingAmount) > 0.0001) throw new Error(`طلب ملغى remaining فيه أكبر من صفر: ${order.id}`);
    if (Number(order.cancellationWriteoffAmount || 0) > 0 && order.status !== 'cancelled') throw new Error(`writeoff على order نشط: ${order.id}`);
  }

  for (const movement of data.stockMovements || []) assertMovement(data, movement);
  const movementById = new Map((data.stockMovements || []).map((movement) => [movement.id, movement]));
  for (const usage of data.orderMaterialUsages || []) {
    const order = ordersById.get(usage.orderId);
    if (!order) throw new Error(`material usage دون order: ${usage.id}`);
    if (!Number.isFinite(Number(usage.quantity)) || Number(usage.quantity) <= 0) throw new Error(`material usage quantity غير صالحة: ${usage.id}`);
    if (!usage.sourceMovementId) {
      if (order.status !== 'cancelled') throw new Error(`material usage نشط دون source movement: ${usage.id}`);
      continue;
    }
    const movement = movementById.get(usage.sourceMovementId);
    if (!movement || movement.itemType !== usage.itemType || movement.itemId !== usage.itemId || movement.direction !== 'sale' || !nearlyEqual(Number(movement.quantity), Number(usage.quantity)) || movement.referenceId !== usage.orderId) {
      throw new Error(`source movement لا يطابق material usage: ${usage.id}`);
    }
  }

  for (const fabric of data.fabrics) if (!Number.isFinite(Number(fabric.quantityMeters)) || Number(fabric.quantityMeters) < 0) throw new Error(`رصيد قماش غير صالح: ${fabric.id}`);
  for (const accessory of data.accessories) if (!Number.isFinite(Number(accessory.quantity)) || Number(accessory.quantity) < 0) throw new Error(`رصيد إكسسوار غير صالح: ${accessory.id}`);
}

export type MockIntegrityItemType = InventoryItemType;
