import { AppData, CashTransaction, OrderEvent, PaymentRecord } from '../../types';
import { assertStoredPaymentAggregates, assertValidPaymentMethod, calculatePaymentUpdate } from '../../domain/paymentRules';
import { createSafeId } from '../../domain/idGenerator';
import { findById, hasIdOrSourceId } from '../shared/idempotencyRules';

export function applyPaymentToDraft(
  draft: AppData,
  invoiceId: string,
  amount: number,
  method: string,
  note: string,
  paymentId?: string
): boolean {
  const paymentMethod = assertValidPaymentMethod(method);
  const invoice = draft.invoices.find((item) => item.id === invoiceId);
  if (!invoice) throw new Error('الفاتورة غير موجودة');

  const current = assertStoredPaymentAggregates(invoice.totalAmount, invoice.paidAmount, invoice.remainingAmount, invoice.payments || []);
  const { numericAmount, paidAmount, remainingAmount, paymentStatus } = calculatePaymentUpdate(
    invoice.totalAmount,
    current.paidAmount,
    current.remainingAmount,
    amount
  );
  const id = paymentId || createSafeId('PAY');
  if ((invoice.payments || []).some((payment) => payment.id === id) || hasIdOrSourceId(draft.cashTransactions, `CASH-PAY-${id}`, id)) {
    return false;
  }

  const now = new Date().toISOString();
  const payment: PaymentRecord = {
    id,
    invoiceId,
    orderId: invoice.orderId,
    amount: numericAmount,
    paymentDate: now.slice(0, 10),
    method: paymentMethod,
    note
  };
  invoice.payments = [...(invoice.payments || []), payment];
  invoice.paidAmount = paidAmount;
  invoice.remainingAmount = remainingAmount;
  invoice.paymentStatus = paymentStatus;

  const order = draft.orders.find((item) => item.id === invoice.orderId);
  if (order) {
    order.paidAmount = paidAmount;
    order.remainingAmount = remainingAmount;
  }

  const cash: CashTransaction = {
    id: `CASH-PAY-${id}`,
    direction: 'in',
    sourceType: 'customer_payment',
    sourceId: id,
    orderId: invoice.orderId,
    referenceNumber: invoice.invoiceNumber,
    amount: numericAmount,
    paymentMethod,
    transactionDate: payment.paymentDate,
    description: `دفعة عميل للفاتورة ${invoice.invoiceNumber}`,
    notes: note || undefined,
    createdAt: now
  };
  if (!hasIdOrSourceId(draft.cashTransactions, cash.id, cash.sourceId)) {
    draft.cashTransactions = [cash, ...(draft.cashTransactions || [])];
  }

  const event: OrderEvent = {
    id: `EVT-PAYMENT-${id}`,
    orderId: invoice.orderId,
    type: 'payment',
    title: 'تم تسجيل دفعة',
    description: `تم تسجيل دفعة بقيمة ${numericAmount} للفاتورة ${invoice.invoiceNumber}.`,
    actor: 'النظام',
    metadata: { paymentId: id, amount: numericAmount, method: paymentMethod, remainingAmount },
    createdAt: now
  };
  if (!findById(draft.orderEvents, event.id)) {
    draft.orderEvents = [event, ...(draft.orderEvents || [])];
  }

  return true;
}
