import { OrderEvent, PaymentRecord } from '../../types';
import { CashRepository } from '../repositories/cashRepository';
import { InvoiceRepository } from '../repositories/invoiceRepository';
import { OrderEventRepository } from '../repositories/orderEventRepository';
import { OrderRepository } from '../repositories/orderRepository';

export class PaymentService {
  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly orderRepository: OrderRepository,
    private readonly cashRepository: CashRepository,
    private readonly eventRepository: OrderEventRepository,
    private readonly db: { transaction<T>(callback: () => T): () => T }
  ) {}

  addPayment(invoiceId: string, amount: number, method: string, note: string, paymentId?: string): boolean {
    const tx = this.db.transaction(() => {
      const invoice = this.invoiceRepository.findById(invoiceId);
      if (!invoice) throw new Error('الفاتورة غير موجودة');
      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('مبلغ الدفعة يجب أن يكون أكبر من صفر');

      const existingPayments: PaymentRecord[] = JSON.parse(invoice.payments_json || '[]');
      const id = paymentId || `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      if (existingPayments.some((payment) => payment.id === id) || this.cashRepository.findBySourceId(id)) return false;
      if (numericAmount > invoice.remaining_amount) throw new Error('مبلغ الدفعة يتجاوز المتبقي على الفاتورة');

      const paymentDate = new Date().toISOString().slice(0, 10);
      const createdAt = new Date().toISOString();
      const newPayment: PaymentRecord = {
        id,
        invoiceId,
        orderId: invoice.order_id,
        amount: numericAmount,
        paymentDate,
        method: method as any,
        note
      };
      existingPayments.push(newPayment);

      const newPaid = invoice.paid_amount + numericAmount;
      const newRemaining = invoice.total_amount - newPaid;
      const newStatus = newRemaining <= 0 ? 'paid' : 'partial';
      this.invoiceRepository.updatePayment(invoiceId, newPaid, newRemaining, newStatus, JSON.stringify(existingPayments));
      this.orderRepository.updatePayment(invoice.order_id, newPaid, newRemaining);
      this.cashRepository.insert({
        id: `CASH-PAY-${id}`,
        direction: 'in',
        sourceType: 'customer_payment',
        sourceId: id,
        orderId: invoice.order_id,
        referenceNumber: invoice.invoice_number,
        amount: numericAmount,
        paymentMethod: method as any,
        transactionDate: paymentDate,
        description: `دفعة عميل للفاتورة ${invoice.invoice_number}`,
        notes: note || undefined,
        createdAt
      });
      const event: OrderEvent = {
        id: `EVT-PAYMENT-${id}`,
        orderId: invoice.order_id,
        type: 'payment',
        title: 'تم تسجيل دفعة',
        description: `تم تسجيل دفعة بقيمة ${numericAmount} للفاتورة ${invoice.invoice_number}.`,
        actor: 'النظام',
        metadata: { paymentId: id, amount: numericAmount, method, remainingAmount: newRemaining },
        createdAt
      };
      this.eventRepository.insert(event);
      return true;
    });
    return tx();
  }
}
