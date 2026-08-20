/** @vitest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomersView } from '../components/CustomersView';
import { AccountingView } from '../components/AccountingView';
import { InvoicesView } from '../components/InvoicesView';
import type { Customer, CustomerCreditRecord, Invoice } from '../types';

const customer = {
  id: 'CUST-UI-1',
  name: 'عميل الاختبار',
  phone: '0500000000',
  createdAt: '2026-08-20',
  updatedAt: '2026-08-20',
  measurements: {},
  styleDetails: {},
  measurementHistory: []
} as Customer;

const credit = (entryType: CustomerCreditRecord['entryType'], amount: number, id: string): CustomerCreditRecord => ({
  id,
  customerId: customer.id,
  entryType,
  amount,
  createdAt: '2026-08-20T10:00:00.000Z',
  occurredAt: '2026-08-20T10:00:00.000Z',
  operationId: `${id}-OP`,
  sourceEntryId: `${id}-SOURCE`,
  method: entryType === 'created' ? 'customer_credit' : 'cash',
  reason: entryType === 'created' ? 'overpayment' : 'customer refund',
  balanceAfter: entryType === 'created' ? amount : 0
});

const showToast = vi.fn();
const onSaveCustomer = vi.fn();
const onDeleteCustomer = vi.fn();

let root: Root;
let container: HTMLDivElement;

const render = async (element: React.ReactElement) => {
  await act(async () => root.render(element));
};

const setInputValue = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

const customersView = (customerCredits: CustomerCreditRecord[], onCustomerCreditChanged = vi.fn()) => (
  <CustomersView
    customers={[customer]}
    customerCredits={customerCredits}
    onCustomerCreditChanged={onCustomerCreditChanged}
    onSaveCustomer={onSaveCustomer}
    onDeleteCustomer={onDeleteCustomer}
    showToast={showToast}
  />
);

describe('Customer Credit UI', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: { customerCredits: { refund: vi.fn() } }
    });
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('hides refund button when available balance is zero', async () => {
    await render(customersView([credit('created', 10, 'CREDIT-1'), credit('refunded', 10, 'CREDIT-2')]));
    expect(container.querySelector(`[data-testid="customer-credit-refund-${customer.id}"]`)).toBeNull();
    expect(container.querySelector(`[data-testid="customer-credit-balance-${customer.id}"]`)?.textContent).toContain('٠');
  });

  it('shows cash warning and blocks an amount above balance in the UI', async () => {
    await render(customersView([credit('created', 100, 'CREDIT-3')]));
    const refundButton = container.querySelector<HTMLButtonElement>(`[data-testid="customer-credit-refund-${customer.id}"]`);
    expect(refundButton).not.toBeNull();
    await act(async () => refundButton?.click());
    expect(container.querySelector('[data-testid="customer-credit-cash-warning"]')).not.toBeNull();

    const amountInput = container.querySelector<HTMLInputElement>('input[type="number"]');
    expect(amountInput).not.toBeNull();
    await setInputValue(amountInput!, '101');
    expect(container.querySelector('[data-testid="customer-credit-refund-amount-error"]')?.textContent).toContain('لا يتجاوز الرصيد');
    expect(Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('مراجعة الاسترداد'))?.disabled).toBe(true);
  });

  it('updates after success and prevents double click while the same idempotency request is pending', async () => {
    let resolveRefund: (value: unknown) => void = () => undefined;
    const refund = vi.fn(() => new Promise((resolve) => { resolveRefund = resolve; }));
    Object.defineProperty(window, 'electronAPI', { configurable: true, value: { customerCredits: { refund } } });
    const onCustomerCreditChanged = vi.fn().mockResolvedValue(undefined);
    await render(customersView([credit('created', 100, 'CREDIT-4')], onCustomerCreditChanged));
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="customer-credit-refund-${customer.id}"]`)?.click());
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input'));
    await setInputValue(inputs.find((input) => input.type === 'number')!, '25');
    await setInputValue(inputs[inputs.length - 1], 'سبب اختباري');
    await act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('مراجعة الاسترداد'))?.click());
    const confirmButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('تأكيد التنفيذ')) as HTMLButtonElement;
    await act(async () => { confirmButton.click(); confirmButton.click(); });
    expect(refund).toHaveBeenCalledTimes(1);
    const result = { operationId: 'REFUND-1', idempotent: false, customerId: customer.id, amount: 25, entryType: 'refunded', method: 'cash', balanceAfter: 75 };
    await act(async () => resolveRefund(result));
    expect(onCustomerCreditChanged).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="customer-credit-refund-result"]')).not.toBeNull();
  });

  it('retries with the same idempotency key and displays an already processed result', async () => {
    const refund = vi.fn()
      .mockRejectedValueOnce(new Error('تعذر الاتصال المؤقت'))
      .mockResolvedValueOnce({ operationId: 'REFUND-2', idempotent: true, customerId: customer.id, amount: 20, entryType: 'refunded', method: 'card', balanceAfter: 80 });
    Object.defineProperty(window, 'electronAPI', { configurable: true, value: { customerCredits: { refund } } });
    await render(customersView([credit('created', 100, 'CREDIT-5')]));
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="customer-credit-refund-${customer.id}"]`)?.click());
    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input'));
    await setInputValue(inputs.find((input) => input.type === 'number')!, '20');
    await setInputValue(inputs[inputs.length - 1], 'سبب إعادة المحاولة');
    await act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('مراجعة الاسترداد'))?.click());
    await act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('تأكيد التنفيذ'))?.click());
    expect(container.querySelector('[data-testid="customer-credit-refund-error"]')).not.toBeNull();
    await act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('إعادة المحاولة بنفس رقم العملية'))?.click());
    expect(refund).toHaveBeenCalledTimes(2);
    expect(refund.mock.calls[0][0].idempotencyKey).toBe(refund.mock.calls[1][0].idempotencyKey);
    expect(container.querySelector('[data-testid="customer-credit-refund-result"]')?.textContent).toContain('نتيجة العملية السابقة');
  });

  it('keeps refunds separate from cash and invoice applied payment UI', async () => {
    const invoice = {
      id: 'INV-UI-1', invoiceNumber: '1001', orderId: 'ORD-UI-1', customerId: customer.id, customerName: customer.name, customerPhone: customer.phone,
      orderDate: '2026-08-20', totalAmount: 100, paidAmount: 40, remainingAmount: 60, paymentStatus: 'partial', payments: [{ id: 'PAY-CC', invoiceId: 'INV-UI-1', orderId: 'ORD-UI-1', amount: 40, paymentDate: '2026-08-20', method: 'customer_credit', note: 'credit' }]
    } as Invoice;
    await render(<AccountingView fabrics={[]} accessories={[]} purchases={[]} expenses={[]} cashTransactions={[{ id: 'CASH-1', direction: 'in', sourceType: 'customer_payment', amount: 100, transactionDate: '2026-08-20', paymentMethod: 'cash', description: 'تحصيل' } as any]} invoices={[invoice]} customerCredits={[credit('created', 50, 'CREDIT-6'), { ...credit('refunded', 10, 'CREDIT-7'), method: 'card' }]} onCreatePurchase={vi.fn()} onCreateExpense={vi.fn()} onCreateCashAdjustment={vi.fn()} showToast={showToast} />);
    await act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('الصندوق'))?.click());
    expect(container.querySelector('[data-testid="customer-credit-refunds-section"]')?.textContent).toContain('Customer Credit Refunds');
    expect(container.querySelector('[data-testid="customer-credit-refunds-section"]')?.textContent).toContain('لا يغير الصندوق');

    await render(<InvoicesView invoices={[invoice]} orders={[]} invoicePrintMode="detailed" onUpdateInvoiceMode={vi.fn()} onAddPayment={vi.fn()} showToast={showToast} />);
    expect(container.querySelector('[data-testid="invoice-credit-applied-INV-UI-1"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="invoice-credit-applied-INV-UI-1"]')?.textContent).toContain('غير نقدي');
  });
});
