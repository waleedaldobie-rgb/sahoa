import { z } from 'zod';

/**
 * Runtime validation schemas for values crossing the Electron IPC boundary.
 * Domain and database rules remain in their existing services/repositories.
 */

export const ipcIdSchema = z.string().trim().min(1).max(128);

export const ipcOptionalIdSchema = ipcIdSchema.optional();

export const ipcShortTextSchema = z.string().trim().min(1).max(200);

export const ipcOptionalTextSchema = z.string().trim().max(2_000).optional();

export const ipcTextSchema = z.string().trim().max(2_000);

export const finiteNonNegativeNumberSchema = z.number().finite().nonnegative();

export const finitePositiveNumberSchema = z.number().finite().positive();

export const finiteNonZeroNumberSchema = z.number().finite().refine((value) => value !== 0, {
  message: 'يجب ألا تساوي القيمة صفرًا',
});

export const paymentMethodSchema = z.enum(['cash', 'card', 'transfer'], {
  error: 'طريقة الدفع غير صالحة',
});

export const inventoryItemTypeSchema = z.enum(['fabric', 'accessory']);

export const inventoryDirectionSchema = z.enum([
  'adjustment',
  'return',
  'adjustment_in',
  'adjustment_out',
]);

export const orderStatusSchema = z.enum([
  'new',
  'processing',
  'ready',
  'delivered',
  'cancelled',
]);

export const idArgsSchema = z.object({
  id: ipcIdSchema,
}).strict();

export const orderIdArgsSchema = z.object({
  orderId: ipcIdSchema,
}).strict();

export const orderStatusArgsSchema = z.object({
  orderId: ipcIdSchema,
  status: orderStatusSchema,
}).strict();

export const whatsappSendArgsSchema = z.object({
  phone: z.string().trim().min(3).max(40),
  customerName: ipcShortTextSchema,
  orderNumber: ipcIdSchema,
  statusText: ipcShortTextSchema,
}).strict();

export const preferencesSaveArgsSchema = z.object({
  activeTab: z.enum([
    'dashboard',
    'customers',
    'orders',
    'invoices',
    'inventory',
    'reports',
    'accounting',
    'settings',
  ]).optional(),
  invoicePrintMode: z.enum(['detailed', 'summary']).optional(),
  shopName: z.string().trim().max(200).optional(),
  managerName: z.string().trim().max(200).optional(),
  shopLogoUrl: z.string().trim().max(5_000_000).optional(),
  shopPhone: z.string().trim().max(40).optional(),
  vatNumber: z.string().trim().max(100).optional(),
  shopAddress: z.string().trim().max(500).optional(),
}).strict();

export const settingsUpdateArgsSchema = z.object({
  key: z.enum([
    'fabricConsumptionRatePerGarment',
    'autoBackupIntervalHours',
    'maxBackupFiles',
  ]),
  value: z.union([
    z.string().trim().max(500),
    z.number().finite(),
  ]),
}).strict();

export const manualCashSourceTypeSchema = z.enum([
  'opening_balance',
  'adjustment',
  'withdrawal',
]);

export const addPaymentArgsSchema = z.object({
  invoiceId: ipcIdSchema,
  amount: finitePositiveNumberSchema,
  method: paymentMethodSchema,
  note: ipcTextSchema,
  paymentId: ipcOptionalIdSchema,
}).strict();

export const stockAdjustArgsSchema = z.object({
  itemType: inventoryItemTypeSchema,
  itemId: ipcIdSchema,
  quantity: finiteNonZeroNumberSchema,
  reason: ipcShortTextSchema,
  direction: inventoryDirectionSchema.default('adjustment'),
  actorId: ipcIdSchema.default('system'),
  unitCost: finiteNonNegativeNumberSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.direction !== 'adjustment' && value.quantity < 0) {
    context.addIssue({
      code: 'custom',
      path: ['quantity'],
      message: 'كمية الحركة لا يمكن أن تكون سالبة لهذا الاتجاه',
    });
  }
});

export const stockReturnPurchaseArgsSchema = z.object({
  itemType: inventoryItemTypeSchema,
  itemId: ipcIdSchema,
  quantity: finitePositiveNumberSchema,
  reason: ipcShortTextSchema,
  originalMovementId: ipcOptionalIdSchema,
  purchaseId: ipcOptionalIdSchema,
  actorId: ipcIdSchema.default('system'),
}).strict();

export const customerCreditApplyArgsSchema = z.object({
  customerId: ipcIdSchema,
  targetInvoiceId: ipcIdSchema,
  amount: finitePositiveNumberSchema,
  idempotencyKey: ipcIdSchema,
  reason: ipcTextSchema,
  actorId: ipcOptionalIdSchema,
}).strict();

export const customerCreditRefundArgsSchema = z.object({
  customerId: ipcIdSchema,
  amount: finitePositiveNumberSchema,
  method: paymentMethodSchema,
  idempotencyKey: ipcIdSchema,
  reason: ipcTextSchema,
  actorId: ipcOptionalIdSchema,
}).strict();

export const cashAdjustmentArgsSchema = z.object({
  id: ipcOptionalIdSchema,
  direction: z.enum(['in', 'out']).default('in'),
  sourceType: manualCashSourceTypeSchema.default('adjustment'),
  sourceId: ipcOptionalIdSchema,
  referenceNumber: ipcOptionalIdSchema,
  amount: finitePositiveNumberSchema,
  paymentMethod: paymentMethodSchema,
  transactionDate: z.string().trim().min(1).max(32).optional(),
  description: ipcShortTextSchema,
  notes: ipcOptionalTextSchema,
  actorId: ipcIdSchema.default('system'),
  reason: ipcTextSchema.optional(),
}).strict();

export const restoreBackupArgsSchema = z.string().trim().min(2).max(100_000_000);

export type AddPaymentArgs = z.infer<typeof addPaymentArgsSchema>;
export type StockAdjustArgs = z.infer<typeof stockAdjustArgsSchema>;
export type StockReturnPurchaseArgs = z.infer<typeof stockReturnPurchaseArgsSchema>;
export type CustomerCreditApplyArgs = z.infer<typeof customerCreditApplyArgsSchema>;
export type CustomerCreditRefundArgs = z.infer<typeof customerCreditRefundArgsSchema>;
export type CashAdjustmentArgs = z.infer<typeof cashAdjustmentArgsSchema>;
