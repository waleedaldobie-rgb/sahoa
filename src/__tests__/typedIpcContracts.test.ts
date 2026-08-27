import { describe, expect, it } from 'vitest';
import {
  normalizeAddPaymentRequest,
  normalizeAdjustStockRequest,
  normalizeReturnPurchaseRequest,
  normalizeSettingsUpdateRequest,
  normalizeUpdateOrderStatusRequest,
  normalizeWhatsAppSendRequest,
} from '../services/shared/ipcRequestAdapters';
import {
  addPaymentArgsSchema,
  orderStatusArgsSchema,
  settingsUpdateArgsSchema,
  stockAdjustArgsSchema,
  stockReturnPurchaseArgsSchema,
  whatsappSendArgsSchema,
} from '../services/shared/ipcSchemas';

describe('typed IPC request object adapters', () => {
  it('keeps a valid object request intact and schema-valid', () => {
    const request = {
      invoiceId: 'INV-1',
      amount: 25,
      method: 'cash',
      note: 'دفعة أولى',
      paymentId: 'PAY-1',
    };
    expect(normalizeAddPaymentRequest(request)).toBe(request);
    expect(addPaymentArgsSchema.safeParse(normalizeAddPaymentRequest(request)).success).toBe(true);
  });

  it('normalizes legacy payment arguments into one request object', () => {
    const request = normalizeAddPaymentRequest('INV-1', 25, 'card', 'دفعة بطاقة', 'PAY-1');
    expect(request).toEqual({
      invoiceId: 'INV-1',
      amount: 25,
      method: 'card',
      note: 'دفعة بطاقة',
      paymentId: 'PAY-1',
    });
    expect(addPaymentArgsSchema.safeParse(request).success).toBe(true);
  });

  it('normalizes stock adjustment and purchase return in both forms', () => {
    const adjustment = normalizeAdjustStockRequest('fabric', 'FAB-1', -2, 'تسوية', 'adjustment', 'system');
    expect(adjustment).toMatchObject({ itemType: 'fabric', itemId: 'FAB-1', quantity: -2, direction: 'adjustment' });
    expect(stockAdjustArgsSchema.safeParse(adjustment).success).toBe(true);

    const returnRequest = normalizeReturnPurchaseRequest('accessory', 'ACC-1', 1, 'إرجاع شراء', 'MOV-1', 'PUR-1');
    expect(returnRequest).toMatchObject({ itemType: 'accessory', itemId: 'ACC-1', quantity: 1, originalMovementId: 'MOV-1', purchaseId: 'PUR-1' });
    expect(stockReturnPurchaseArgsSchema.safeParse(returnRequest).success).toBe(true);

    const objectRequest = { itemType: 'fabric', itemId: 'FAB-2', quantity: 2, reason: 'إضافة', direction: 'adjustment_in' };
    expect(normalizeAdjustStockRequest(objectRequest)).toBe(objectRequest);
  });

  it('normalizes order status, WhatsApp, and settings requests', () => {
    const status = normalizeUpdateOrderStatusRequest('ORD-1', 'processing');
    expect(status).toEqual({ orderId: 'ORD-1', status: 'processing' });
    expect(orderStatusArgsSchema.safeParse(status).success).toBe(true);

    const whatsapp = normalizeWhatsAppSendRequest('966500000000', 'عميل اختبار', '1001', 'جاهز');
    expect(whatsapp).toEqual({ phone: '966500000000', customerName: 'عميل اختبار', orderNumber: '1001', statusText: 'جاهز' });
    expect(whatsappSendArgsSchema.safeParse(whatsapp).success).toBe(true);

    const settings = normalizeSettingsUpdateRequest('maxBackupFiles', 5);
    expect(settings).toEqual({ key: 'maxBackupFiles', value: 5 });
    expect(settingsUpdateArgsSchema.safeParse(settings).success).toBe(true);
  });

  it('does not hide invalid legacy arguments behind the adapter', () => {
    const invalidAmount = normalizeAddPaymentRequest('INV-1', Number.NaN, 'cash', '');
    expect(addPaymentArgsSchema.safeParse(invalidAmount).success).toBe(false);

    const invalidStatus = normalizeUpdateOrderStatusRequest('ORD-1', 'unknown');
    expect(orderStatusArgsSchema.safeParse(invalidStatus).success).toBe(false);

    const invalidExtraField = normalizeWhatsAppSendRequest({
      phone: '966500000000',
      customerName: 'عميل',
      orderNumber: '1001',
      statusText: 'جاهز',
      token: 'لا يجب تمريره',
    });
    expect(whatsappSendArgsSchema.safeParse(invalidExtraField).success).toBe(false);

    const invalidNegativeReturn = normalizeReturnPurchaseRequest('fabric', 'FAB-1', -1, 'إرجاع');
    expect(stockReturnPurchaseArgsSchema.safeParse(invalidNegativeReturn).success).toBe(false);
  });
});
