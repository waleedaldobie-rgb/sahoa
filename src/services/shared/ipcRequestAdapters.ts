import type {
  AddPaymentRequest,
  AdjustStockRequest,
  ReturnPurchaseRequest,
  SettingsUpdateRequest,
  UpdateOrderStatusRequest,
  WhatsAppSendRequest,
} from '../../types';

export type IpcRequestRecord = Record<string, unknown>;

export function isIpcRequestObject(value: unknown): value is IpcRequestRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeUpdateOrderStatusRequest(requestOrOrderId: unknown, legacyStatus?: unknown): IpcRequestRecord {
  return isIpcRequestObject(requestOrOrderId)
    ? requestOrOrderId
    : { orderId: requestOrOrderId, status: legacyStatus };
}

export function normalizeAddPaymentRequest(
  requestOrInvoiceId: unknown,
  legacyAmount?: unknown,
  legacyMethod?: unknown,
  legacyNote: unknown = '',
  legacyPaymentId?: unknown,
): IpcRequestRecord {
  return isIpcRequestObject(requestOrInvoiceId)
    ? requestOrInvoiceId
    : {
        invoiceId: requestOrInvoiceId,
        amount: legacyAmount,
        method: legacyMethod,
        note: legacyNote,
        paymentId: legacyPaymentId,
      };
}

export function normalizeAdjustStockRequest(
  requestOrItemType: unknown,
  legacyItemId?: unknown,
  legacyQuantity?: unknown,
  legacyReason?: unknown,
  legacyDirection: unknown = 'adjustment',
  legacyActorId: unknown = 'system',
  legacyUnitCost?: unknown,
): IpcRequestRecord {
  return isIpcRequestObject(requestOrItemType)
    ? requestOrItemType
    : {
        itemType: requestOrItemType,
        itemId: legacyItemId,
        quantity: legacyQuantity,
        reason: legacyReason,
        direction: legacyDirection,
        actorId: legacyActorId,
        unitCost: legacyUnitCost,
      };
}

export function normalizeReturnPurchaseRequest(
  requestOrItemType: unknown,
  legacyItemId?: unknown,
  legacyQuantity?: unknown,
  legacyReason?: unknown,
  legacyOriginalMovementId?: unknown,
  legacyPurchaseId?: unknown,
  legacyActorId: unknown = 'system',
): IpcRequestRecord {
  return isIpcRequestObject(requestOrItemType)
    ? requestOrItemType
    : {
        itemType: requestOrItemType,
        itemId: legacyItemId,
        quantity: legacyQuantity,
        reason: legacyReason,
        originalMovementId: legacyOriginalMovementId,
        purchaseId: legacyPurchaseId,
        actorId: legacyActorId,
      };
}

export function normalizeWhatsAppSendRequest(
  requestOrPhone: unknown,
  legacyCustomerName?: unknown,
  legacyOrderNumber?: unknown,
  legacyStatusText?: unknown,
): IpcRequestRecord {
  return isIpcRequestObject(requestOrPhone)
    ? requestOrPhone
    : {
        phone: requestOrPhone,
        customerName: legacyCustomerName,
        orderNumber: legacyOrderNumber,
        statusText: legacyStatusText,
      };
}

export function normalizeSettingsUpdateRequest(requestOrKey: unknown, legacyValue?: unknown): IpcRequestRecord {
  return isIpcRequestObject(requestOrKey)
    ? requestOrKey
    : { key: requestOrKey, value: legacyValue };
}

export type TypedRequestObject =
  | AddPaymentRequest
  | AdjustStockRequest
  | ReturnPurchaseRequest
  | SettingsUpdateRequest
  | UpdateOrderStatusRequest
  | WhatsAppSendRequest;
