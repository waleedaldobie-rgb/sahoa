import { Order, OrderMaterialUsage, PaymentRecord, StockMovement } from '../../types';
import { normalizeMeasurements, normalizeStyleDetails } from '../../services/shared/measurementDefaults';
import { round2 } from '../../services/shared/inventoryRules';
import { assertValidOrderAmounts, calculateMaterialCost, calculateOrderAmounts, materialSignature } from '../../services/shared/orderRules';
import { assertStoredPaymentAggregates, parsePaymentLedger } from '../../domain/paymentRules';
import { createSafeId } from '../../domain/idGenerator';
import { CashRepository } from '../repositories/cashRepository';
import { OrderEventRepository } from '../repositories/orderEventRepository';
import { OrderRepository } from '../repositories/orderRepository';
import { OrderWriteRepository } from '../repositories/orderWriteRepository';
import { InvoiceRepository } from '../repositories/invoiceRepository';
import { InventoryService } from './inventoryService';

export interface CreateOrderResult {
  orderId: string;
  orderNumber: string;
  remainingAmount: number;
  materialUsages: OrderMaterialUsage[];
  materialCost: number;
  profit: number;
  alreadyExists?: boolean;
}

export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly orderWriteRepository: OrderWriteRepository,
    private readonly inventoryService: InventoryService,
    private readonly cashRepository: CashRepository,
    private readonly eventRepository: OrderEventRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly db: { transaction<T>(callback: () => T): () => T }
  ) {}

  createOrder(orderData: Partial<Order>, fabricConsumptionRate: number): CreateOrderResult {
    const existing = orderData.id
      ? this.orderRepository.findById(orderData.id)
      : orderData.orderNumber
        ? this.orderRepository.findByOrderNumber(orderData.orderNumber)
        : undefined;
    if (existing) {
      return {
        orderId: existing.id,
        orderNumber: existing.order_number,
        remainingAmount: existing.remaining_amount,
        materialUsages: [],
        materialCost: 0,
        profit: round2((existing.total_amount || 0) - 0),
        alreadyExists: true
      };
    }

    const rate = Number(fabricConsumptionRate || 3.5);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('معدل استهلاك القماش غير صالح');
    const garmentCount = Number(orderData.garmentCount ?? 1);
    if (!Number.isInteger(garmentCount) || garmentCount < 1) throw new Error('عدد الثياب يجب أن يكون عدداً صحيحاً لا يقل عن 1');
    const { total: validatedTotal, paid: validatedPaid } = assertValidOrderAmounts(orderData.totalAmount ?? 0, orderData.paidAmount ?? 0);
    const requiredMeters = garmentCount * rate;
    const tx = this.db.transaction(() => {
      const orderId = orderData.id || createSafeId('ORD');
      const orderNumber = orderData.orderNumber || this.orderRepository.nextOrderNumber();
      const amounts = calculateOrderAmounts(validatedTotal, validatedPaid);
      const { totalAmount, paidAmount, remainingAmount } = amounts;
      const orderDate = orderData.orderDate || new Date().toISOString().slice(0, 10);
      const createdAt = new Date().toISOString();

      let fabricBuyPrice = 0;
      let fabricMovement: StockMovement | undefined;
      if (orderData.fabricId) {
        const fabricMeta = this.inventoryService.getMeta('fabric', orderData.fabricId);
        fabricBuyPrice = fabricMeta.purchasePrice || 0;
        fabricMovement = this.inventoryService.recordMovement('fabric', orderData.fabricId, -requiredMeters, 'sale', 'استهلاك قماش للطلب', {
          type: 'order', id: orderId, number: orderNumber
        });
      }

      this.orderWriteRepository.insertOrder({
        id: orderId,
        orderNumber,
        customerId: orderData.customerId,
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone,
        thobeTypeId: orderData.thobeTypeId,
        thobeTypeName: orderData.thobeTypeName || 'ثوب',
        fabricId: orderData.fabricId,
        fabricName: orderData.fabricName || 'قماش',
        fabricColor: orderData.fabricColor || 'أبيض',
        fabricConsumptionMeters: requiredMeters,
        fabricBuyPriceAtOrder: fabricBuyPrice,
        garmentCount,
        orderDate,
        deliveryDate: orderData.deliveryDate || orderDate,
        status: orderData.status || 'new',
        totalAmount,
        paidAmount,
        remainingAmount,
        isCustomMeasurement: Boolean(orderData.isCustomMeasurement),
        measurementsJson: JSON.stringify(normalizeMeasurements(orderData.measurements)),
        styleDetailsJson: JSON.stringify(normalizeStyleDetails(orderData.styleDetails)),
        notes: orderData.notes || '',
        createdAt
      });

      const materialUsages: OrderMaterialUsage[] = [];
      if (orderData.fabricId && fabricMovement) {
        const usage: OrderMaterialUsage = {
          id: createSafeId('OMU-FABRIC'),
          orderId,
          itemType: 'fabric',
          itemId: orderData.fabricId,
          itemName: orderData.fabricName || 'قماش',
          quantity: requiredMeters,
          unit: 'متر',
          unitCostAtUsage: fabricBuyPrice,
          totalCost: round2(requiredMeters * fabricBuyPrice),
          sourceMovementId: fabricMovement.id,
          createdAt
        };
        this.orderWriteRepository.insertMaterialUsage({ ...usage, itemId: usage.itemId || '', sourceMovementId: usage.sourceMovementId || '' });
        materialUsages.push(usage);
      }

      for (const material of (orderData.materialUsages || [])) {
        if (!material.itemId || (material.itemType === 'fabric' && material.itemId === orderData.fabricId)) continue;
        const quantity = Number(material.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('كمية المادة المرتبطة بالطلب غير صحيحة');
        const meta = this.inventoryService.getMeta(material.itemType, material.itemId);
        const movement = this.inventoryService.recordMovement(material.itemType, material.itemId, -quantity, 'sale', 'استهلاك مادة للطلب', {
          type: 'order', id: orderId, number: orderNumber
        });
        const unitCost = Number.isFinite(Number(material.unitCostAtUsage)) ? Number(material.unitCostAtUsage) : Number(meta.purchasePrice || 0);
        const usage: OrderMaterialUsage = {
          id: createSafeId('OMU'),
          orderId,
          itemType: material.itemType,
          itemId: material.itemId,
          itemName: material.itemName || meta.name,
          quantity,
          unit: material.unit || meta.unit,
          unitCostAtUsage: unitCost,
          totalCost: round2(quantity * unitCost),
          sourceMovementId: movement.id,
          createdAt
        };
        this.orderWriteRepository.insertMaterialUsage({ ...usage, itemId: usage.itemId || '', sourceMovementId: usage.sourceMovementId || '' });
        materialUsages.push(usage);
      }

      const invId = `INV-${orderNumber}`;
      const paymentMethod = (orderData as any).initialPaymentMethod || 'cash';
      const paymentId = paidAmount > 0 ? createSafeId('PAY') : undefined;
      const initialPayments = paidAmount > 0 ? [{
        id: paymentId,
        invoiceId: invId,
        orderId,
        amount: paidAmount,
        paymentDate: orderDate,
        method: paymentMethod,
        note: 'دفعة أولى عند إنشاء الطلب'
      }] : [];
      this.orderWriteRepository.insertInvoice({
        id: invId,
        invoiceNumber: `INV-${orderNumber}`,
        orderId,
        customerName: orderData.customerName,
        customerPhone: orderData.customerPhone,
        orderDate,
        totalAmount,
        paidAmount,
        remainingAmount,
        paymentStatus: remainingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid',
        paymentsJson: JSON.stringify(initialPayments)
      });

      if (paidAmount > 0 && paymentId) {
        this.cashRepository.insert({
          id: `CASH-PAY-${paymentId}`,
          direction: 'in',
          sourceType: 'customer_payment',
          sourceId: paymentId,
          orderId,
          referenceNumber: orderNumber,
          amount: paidAmount,
          paymentMethod: paymentMethod as any,
          transactionDate: orderDate,
          description: `دفعة أولى للطلب #${orderNumber}`,
          createdAt
        });
      }

      const materialCost = calculateMaterialCost(materialUsages);
      this.eventRepository.insert({
        id: `EVT-CREATED-${orderId}`,
        orderId,
        type: 'created',
        title: 'تم إنشاء الطلب',
        description: `تم إنشاء الطلب #${orderNumber} وتسجيل الفاتورة${paidAmount > 0 ? ' والدفعة الأولى' : ''}.`,
        toStatus: orderData.status || 'new',
        actor: 'النظام',
        metadata: { materialCost, paidAmount, remainingAmount },
        createdAt
      });
      return { orderId, orderNumber, remainingAmount, materialUsages, materialCost, profit: round2(totalAmount - materialCost) };
    });
    return tx();
  }

  updateOrder(updatedOrder: Order, fabricConsumptionRate: number): boolean {
    const updateTx = this.db.transaction(() => {
      const existing = this.orderRepository.findById(updatedOrder.id);
      if (!existing) throw new Error('الطلب المطلوب غير موجود');
      if (updatedOrder.status !== existing.status) throw new Error('تغيير حالة الطلب يجب أن يمر عبر مسار الحالات المخصص');

      const invoice = this.invoiceRepository.findByOrderId(updatedOrder.id);
      if (!invoice) throw new Error('لا توجد فاتورة مرتبطة بالطلب');
      const existingPayments = parsePaymentLedger(invoice.payments_json);
      const ledger = assertStoredPaymentAggregates(invoice.total_amount, invoice.paid_amount, invoice.remaining_amount, existingPayments);
      const { total: validatedTotal } = assertValidOrderAmounts(updatedOrder.totalAmount ?? existing.total_amount, ledger.paidAmount);

      const rate = Number(fabricConsumptionRate || 3.5);
      if (!Number.isFinite(rate) || rate <= 0) throw new Error('معدل استهلاك القماش غير صالح');
      const garmentCount = Number(updatedOrder.garmentCount ?? existing.garment_count ?? 1);
      if (!Number.isInteger(garmentCount) || garmentCount < 1) throw new Error('عدد الثياب يجب أن يكون عدداً صحيحاً لا يقل عن 1');
      const newMeters = garmentCount * rate;
      const oldMaterials = this.orderRepository.listMaterialUsages(updatedOrder.id) as any[];
      const fabricChanged = existing.fabric_id !== updatedOrder.fabricId;
      const countChanged = existing.garment_count !== garmentCount;
      const oldAccessorySignature = materialSignature(oldMaterials);
      const newAccessorySignature = materialSignature(updatedOrder.materialUsages || []);
      const materialPayloadChanged = updatedOrder.materialUsages !== undefined && oldAccessorySignature !== newAccessorySignature;
      const materialChanged = fabricChanged || countChanged || materialPayloadChanged;

      if (materialChanged) {
        const isCancelled = existing.status === 'cancelled';
        if (!isCancelled) {
          for (const oldMaterial of oldMaterials) {
            if (oldMaterial.item_id) {
              this.inventoryService.recordMovement(oldMaterial.item_type, oldMaterial.item_id, oldMaterial.quantity, 'return', 'إرجاع استهلاك مادة بعد تعديل الطلب', {
                type: 'order_update', id: updatedOrder.id, number: existing.order_number
              });
            }
          }
        }

        this.orderWriteRepository.deleteMaterialUsages(updatedOrder.id);
        const accessories = updatedOrder.materialUsages || oldMaterials.filter((row) => row.item_type !== 'fabric');
        if (updatedOrder.fabricId) {
          const newFabric = this.inventoryService.getMeta('fabric', updatedOrder.fabricId);
          const fabricBuyPrice = fabricChanged
            ? newFabric.purchasePrice || 0
            : existing.fabric_buy_price_at_order || updatedOrder.fabricBuyPriceAtOrder || 0;
          const newFabricMovement = isCancelled
            ? undefined
            : this.inventoryService.recordMovement('fabric', updatedOrder.fabricId, -newMeters, 'sale', 'استهلاك قماش بعد تعديل الطلب', {
              type: 'order_update', id: updatedOrder.id, number: existing.order_number
            });
          this.orderWriteRepository.insertMaterialUsage({
            id: createSafeId('OMU-FABRIC-UPDATE'), orderId: updatedOrder.id, itemType: 'fabric', itemId: updatedOrder.fabricId,
            itemName: updatedOrder.fabricName || 'قماش', quantity: newMeters, unit: 'متر', unitCostAtUsage: fabricBuyPrice,
            totalCost: round2(newMeters * fabricBuyPrice), sourceMovementId: newFabricMovement?.id, createdAt: new Date().toISOString()
          });
        }
        for (const material of accessories) {
          const itemId = material.itemId || (material as any).item_id;
          const itemType = material.itemType || (material as any).item_type;
          if (!itemId || itemType === 'fabric') continue;
          const quantity = Number(material.quantity);
          if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('كمية المادة المرتبطة بالطلب غير صحيحة');
          const meta = this.inventoryService.getMeta(itemType, itemId);
          const movement = isCancelled
            ? undefined
            : this.inventoryService.recordMovement(itemType, itemId, -quantity, 'sale', 'استهلاك مادة بعد تعديل الطلب', {
              type: 'order_update', id: updatedOrder.id, number: existing.order_number
            });
          const unitCost = Number(material.unitCostAtUsage ?? (material as any).unit_cost_at_usage ?? meta.purchasePrice ?? 0);
          if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error('تكلفة المادة المرتبطة بالطلب غير صحيحة');
          this.orderWriteRepository.insertMaterialUsage({
            id: createSafeId('OMU'), orderId: updatedOrder.id,
            itemType, itemId, itemName: material.itemName || (material as any).item_name || meta.name,
            quantity, unit: material.unit || meta.unit, unitCostAtUsage: unitCost, totalCost: round2(quantity * unitCost),
            sourceMovementId: movement?.id, createdAt: new Date().toISOString()
          });
        }
      }

      const totalAmount = validatedTotal;
      const paidAmount = ledger.paidAmount;
      const remainingAmount = calculateOrderAmounts(totalAmount, paidAmount).remainingAmount;
      if (Math.abs(Number(updatedOrder.paidAmount ?? paidAmount) - paidAmount) > 0.0001) {
        throw new Error('لا يمكن تعديل المبلغ المدفوع من خلال تحديث الطلب؛ استخدم مسار الدفعات');
      }
      this.orderWriteRepository.updateOrder({
        id: updatedOrder.id, customerName: updatedOrder.customerName, customerPhone: updatedOrder.customerPhone,
        thobeTypeId: updatedOrder.thobeTypeId, thobeTypeName: updatedOrder.thobeTypeName || 'ثوب',
        fabricId: updatedOrder.fabricId, fabricName: updatedOrder.fabricName || 'قماش', fabricColor: updatedOrder.fabricColor || 'أبيض',
        garmentCount, fabricConsumptionMeters: newMeters, deliveryDate: updatedOrder.deliveryDate,
        status: existing.status, totalAmount: validatedTotal, paidAmount: ledger.paidAmount, remainingAmount,
        measurementsJson: JSON.stringify(normalizeMeasurements(updatedOrder.measurements)),
        styleDetailsJson: JSON.stringify(normalizeStyleDetails(updatedOrder.styleDetails)), notes: updatedOrder.notes || '', updatedAt: new Date().toISOString()
      });
      this.invoiceRepository.updateAmounts(updatedOrder.id, totalAmount, paidAmount, remainingAmount, calculateOrderAmounts(totalAmount, paidAmount).paymentStatus);
    });

    updateTx();
    return true;
  }

  deleteOrder(orderId: string): boolean {
    const deleteTx = this.db.transaction(() => {
      const order = this.orderRepository.findById(orderId);
      if (!order) return;
      if (order.status !== 'cancelled') {
        const materials = this.orderRepository.listMaterialUsages(orderId) as any[];
        for (const material of materials) {
          if (material.item_id) {
            this.inventoryService.recordMovement(material.item_type, material.item_id, material.quantity, 'return', 'إرجاع مواد بسبب حذف الطلب', {
              type: 'order_delete', id: orderId, number: order.order_number
            });
          }
        }
      }

      const invoice = this.invoiceRepository.findByOrderId(orderId);
      if (invoice) {
        const ledgerPayments = this.cashRepository.listByOrderId(orderId);
        for (const payment of ledgerPayments) {
          const sourceId = payment.source_id || payment.id;
          const reversalId = `CASH-REV-${sourceId}`;
          if (!this.cashRepository.findById(reversalId)) {
            this.cashRepository.insert({
              id: reversalId, direction: 'out', sourceType: 'adjustment', sourceId,
              orderId, referenceNumber: order.order_number, amount: Number(payment.amount), paymentMethod: payment.payment_method,
              transactionDate: new Date().toISOString().slice(0, 10), description: `عكس دفعة بسبب حذف الطلب #${order.order_number}`,
              createdAt: new Date().toISOString()
            });
          }
        }
      }
      this.invoiceRepository.deleteByOrderId(orderId);
      this.orderWriteRepository.deleteMaterialUsages(orderId);
      this.orderWriteRepository.delete(orderId);
    });

    deleteTx();
    return true;
  }
}
