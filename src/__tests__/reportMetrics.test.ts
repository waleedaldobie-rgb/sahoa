import { describe, expect, it } from 'vitest';
import { calculateReportProjection } from '../domain/reportMetrics';
import { Invoice, Order } from '../types';

const order = (overrides: Partial<Order> = {}) => ({
  id: 'ORD-REPORT-1',
  orderNumber: '1001',
  customerId: 'CUS-REPORT-1',
  customerName: 'عميل التقرير',
  customerPhone: '0500000000',
  thobeTypeId: 'THB-1',
  thobeTypeName: 'ثوب',
  fabricId: 'FAB-1',
  fabricName: 'قماش',
  fabricColor: 'أبيض',
  orderDate: '2026-08-10',
  deliveryDate: '2026-08-20',
  status: 'new',
  totalAmount: 100,
  paidAmount: 0,
  remainingAmount: 100,
  isCustomMeasurement: false,
  measurements: {} as Order['measurements'],
  styleDetails: {} as Order['styleDetails'],
  createdAt: '2026-08-10T00:00:00.000Z',
  ...overrides
} satisfies Order);

const invoice = (overrides: Partial<Invoice> = {}) => ({
  id: 'INV-REPORT-1',
  invoiceNumber: 'INV-1001',
  orderId: 'ORD-REPORT-1',
  customerName: 'عميل التقرير',
  customerPhone: '0500000000',
  orderDate: '2026-08-10',
  totalAmount: 100,
  paidAmount: 0,
  remainingAmount: 100,
  paymentStatus: 'unpaid',
  payments: [],
  ...overrides
} satisfies Invoice);

describe('shared report projection', () => {
  it('reports cancellation writeoff as non-cash and excludes it from profit', () => {
    const result = calculateReportProjection({
      orders: [order({ totalAmount: 300, paidAmount: 100, remainingAmount: 0, status: 'cancelled', cancellationWriteoffAmount: 200 })],
      invoices: [invoice({ totalAmount: 300, paidAmount: 100, remainingAmount: 0, paymentStatus: 'settled_by_cancellation', cancellationWriteoffAmount: 200, payments: [{ id: 'PAY-1', invoiceId: 'INV-REPORT-1', orderId: 'ORD-REPORT-1', amount: 100, cashReceived: 100, paymentDate: '2026-08-10', method: 'cash' }] })],
      orderEvents: [{ id: 'EV-1', orderId: 'ORD-REPORT-1', type: 'status_changed', title: 'إلغاء', description: 'إلغاء', toStatus: 'cancelled', createdAt: '2026-08-11' }],
      startDate: '2026-08-01',
      endDate: '2026-08-31'
    });
    expect(result.cancellationWriteoff).toBe(200);
    expect(result.salesBooked).toBe(0);
    expect(result.recognizedRevenue).toBe(0);
    expect(result.grossProfit).toBe(0);
    expect(result.netProfit).toBe(0);
    expect(result.details[0].includedInSales).toBe(false);
    expect(result.details[0].settlementStatus).toBe('settled_by_cancellation');
  });

  it('separates applied collection from overpayment cash and liability', () => {
    const result = calculateReportProjection({
      orders: [order({ paidAmount: 100, remainingAmount: 0, cashReceived: 120, overpaymentAmount: 20 })],
      invoices: [invoice({ paidAmount: 100, remainingAmount: 0, paymentStatus: 'paid', cashReceived: 120, overpaymentAmount: 20, payments: [{ id: 'PAY-2', invoiceId: 'INV-REPORT-1', orderId: 'ORD-REPORT-1', amount: 100, cashReceived: 120, overpaymentAmount: 20, paymentDate: '2026-08-10', method: 'cash' }] })],
      cashTransactions: [{ id: 'CASH-2', direction: 'in', sourceType: 'customer_payment', sourceId: 'PAY-2', orderId: 'ORD-REPORT-1', amount: 120, paymentMethod: 'cash', transactionDate: '2026-08-10', description: 'دفعة', createdAt: '2026-08-10' }],
      customerCredits: [{ id: 'CREDIT-2', customerId: 'CUS-REPORT-1', invoiceId: 'INV-REPORT-1', paymentId: 'PAY-2', entryType: 'created', amount: 20, createdAt: '2026-08-10' }],
      startDate: '2026-08-01',
      endDate: '2026-08-31'
    });
    expect(result.appliedCollected).toBe(100);
    expect(result.cashReceived).toBe(120);
    expect(result.overpaymentCreated).toBe(20);
    expect(result.closingCustomerCreditLiability).toBe(20);
    expect(result.netProfit).toBe(0);
  });

  it('reduces customer-credit liability only through applied/refunded ledger entries', () => {
    const result = calculateReportProjection({
      orders: [order({ paidAmount: 100, remainingAmount: 0, cashReceived: 120, overpaymentAmount: 20 })],
      invoices: [invoice({ paidAmount: 100, remainingAmount: 0, paymentStatus: 'paid', cashReceived: 120, overpaymentAmount: 20, payments: [{ id: 'PAY-3', invoiceId: 'INV-REPORT-1', orderId: 'ORD-REPORT-1', amount: 100, cashReceived: 120, paymentDate: '2026-08-10', method: 'cash' }] })],
      customerCredits: [
        { id: 'C-1', customerId: 'CUS-REPORT-1', entryType: 'created', amount: 20, createdAt: '2026-08-10' },
        { id: 'C-2', customerId: 'CUS-REPORT-1', entryType: 'applied', amount: 5, createdAt: '2026-08-15' },
        { id: 'C-3', customerId: 'CUS-REPORT-1', entryType: 'refunded', amount: 3, createdAt: '2026-08-16' }
      ],
      startDate: '2026-08-01',
      endDate: '2026-08-31'
    });
    expect(result.overpaymentCreated).toBe(20);
    expect(result.overpaymentApplied).toBe(5);
    expect(result.overpaymentRefunded).toBe(3);
    expect(result.closingCustomerCreditLiability).toBe(12);
    expect(result.salesBooked).toBe(100);
  });

  it('uses delivery date for recognized revenue and keeps booked sales separate', () => {
    const result = calculateReportProjection({
      orders: [order({ orderDate: '2026-07-31', deliveryDate: '2026-08-05', status: 'delivered', totalAmount: 200, materialCost: 80, remainingAmount: 0, paidAmount: 200 })],
      invoices: [invoice({ orderDate: '2026-07-31', totalAmount: 200, paidAmount: 200, remainingAmount: 0, paymentStatus: 'paid' })],
      startDate: '2026-08-01',
      endDate: '2026-08-31'
    });
    expect(result.salesBooked).toBe(0);
    expect(result.recognizedRevenue).toBe(200);
    expect(result.recognizedMaterialCost).toBe(80);
    expect(result.grossProfit).toBe(120);
  });

  it('reconciles sales summary to detail rows marked included_in_sales', () => {
    const result = calculateReportProjection({
      orders: [order({ id: 'ACTIVE', totalAmount: 100 }), order({ id: 'CANCELLED', status: 'cancelled', totalAmount: 75, remainingAmount: 0, cancellationWriteoffAmount: 75 })],
      invoices: [invoice({ orderId: 'ACTIVE' }), invoice({ id: 'INV-CANCELLED', orderId: 'CANCELLED', totalAmount: 75, remainingAmount: 0, paymentStatus: 'settled_by_cancellation', cancellationWriteoffAmount: 75 })],
      startDate: '2026-08-01',
      endDate: '2026-08-31'
    });
    const detailSales = result.details.filter((row) => row.includedInSales).reduce((sum, row) => sum + row.order.totalAmount, 0);
    expect(result.salesBooked).toBe(detailSales);
    expect(result.details.find((row) => row.order.id === 'CANCELLED')?.settlementStatus).toBe('settled_by_cancellation');
  });
});
