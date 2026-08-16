import { Order, OrderMaterialUsage, PaymentRecord, StockMovement } from '../../types';
import { normalizeMeasurements, normalizeStyleDetails } from '../../services/shared/measurementDefaults';
import { round2 } from '../../services/shared/inventoryRules';
import { CashRepository } from '../repositories/cashRepository';
import { OrderEventRepository } from '../repositories/orderEventRepository';
import { OrderRepository } from '../repositories/orderRepository';
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

    const rate = fabricConsumptionRate || 3.5;
    const garmentCount = orderData.garmentCount || 1;
    const requiredMeters = garmentCount * rate;
    const tx = this.db.transaction(() => {
      const orderId = orderData.id || `ORD-${Date.now()}`;
      const orderNumber = orderData.orderNumber || `${1001 + this.orderRepository.count()}`;
      const totalAmount = orderData.totalAmount || 0;
      const paidAmount = orderData.paidAmount || 0;
      const remainingAmount = totalAmount - paidAmount;
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

      this.orderRepository.insertOrder({
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
          id: `OMU-${Date.now()}-fabric`,
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
        this.orderRepository.insertMaterialUsage({ ...usage, itemId: usage.itemId || '', sourceMovementId: usage.sourceMovementId || '' });
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
          id: `OMU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
        this.orderRepository.insertMaterialUsage({ ...usage, itemId: usage.itemId || '', sourceMovementId: usage.sourceMovementId || '' });
        materialUsages.push(usage);
      }

      const invId = `INV-${orderNumber}`;
      const paymentMethod = (orderData as any).initialPaymentMethod || 'cash';
      const paymentId = paidAmount > 0 ? `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` : undefined;
      const initialPayments = paidAmount > 0 ? [{
        id: paymentId,
        invoiceId: invId,
        orderId,
        amount: paidAmount,
        paymentDate: orderDate,
        method: paymentMethod,
        note: 'دفعة أولى عند إنشاء الطلب'
      }] : [];
      this.orderRepository.insertInvoice({
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

      const materialCost = round2(materialUsages.reduce((sum, usage) => sum + usage.totalCost, 0));
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

      const rate = fabricConsumptionRate || 3.5;
      const newMeters = (updatedOrder.garmentCount || 1) * rate;
      const oldMaterials = this.orderRepository.listMaterialUsages(updatedOrder.id) as any[];
      const fabricChanged = existing.fabric_id !== updatedOrder.fabricId;
      const countChanged = existing.garment_count !== updatedOrder.garmentCount;
      const oldAccessorySignature = oldMaterials
        .filter((row) => row.item_type !== 'fabric')
        .map((row) => `${row.item_type}:${row.item_id}:${row.quantity}:${row.unit}:${row.unit_cost_at_usage}`)
        .sort()
        .join('|');
      const newAccessorySignature = (updatedOrder.materialUsages || [])
        .filter((material) => material.itemType !== 'fabric' && Boolean(material.itemId))
        .map((material) => `${material.itemType}:${material.itemId}:${material.quantity}:${material.unit || ''}:${material.unitCostAtUsage ?? ''}`)
        .sort()
        .join('|');
      const materialPayloadChanged = updatedOrder.materialUsages !== undefined && oldAccessorySignature !== newAccessorySignature;
      const materialChanged = fabricChanged || countChanged || materialPayloadChanged;

      if (materialChanged && existing.status !== 'cancelled') {
        for (const oldMaterial of oldMaterials) {
          if (oldMaterial.item_id) {
            this.inventoryService.recordMovement(oldMaterial.item_type, oldMaterial.item_id, oldMaterial.quantity, 'return', 'إرجاع استهلاك مادة بعد تعديل الطلب', {
              type: 'order_update', id: updatedOrder.id, number: existing.order_number
            });
          }
        }

        this.orderRepository.deleteMaterialUsages(updatedOrder.id);
        if (updatedOrder.fabricId) {
          const newFabric = this.inventoryService.getMeta('fabric', updatedOrder.fabricId);
          const fabricBuyPrice = fabricChanged
            ? newFabric.purchasePrice || 0
            : existing.fabric_buy_price_at_order || updatedOrder.fabricBuyPriceAtOrder || 0;
          const newFabricMovement = this.inventoryService.recordMovement('fabric', updatedOrder.fabricId, -newMeters, 'sale', 'استهلاك قماش بعد تعديل الطلب', {
            type: 'order_update', id: updatedOrder.id, number: existing.order_number
          });
          this.orderRepository.insertMaterialUsage({
            id: `OMU-${Date.now()}-fabric-update`, orderId: updatedOrder.id, itemType: 'fabric', itemId: updatedOrder.fabricId,
            itemName: updatedOrder.fabricName || 'قماش', quantity: newMeters, unit: 'متر', unitCostAtUsage: fabricBuyPrice,
            totalCost: round2(newMeters * fabricBuyPrice), sourceMovementId: newFabricMovement.id, createdAt: new Date().toISOString()
          });
          for (const material of (updatedOrder.materialUsages || oldMaterials.filter((row) => row.item_type !== 'fabric'))) {
            const itemId = material.itemId || (material as any).item_id;
            const itemType = material.itemType || (material as any).item_type;
            if (!itemId || (itemType === 'fabric' && itemId === updatedOrder.fabricId)) continue;
            const quantity = Number(material.quantity);
            if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('كمية المادة المرتبطة بالطلب غير صحيحة');
            const meta = this.inventoryService.getMeta(itemType, itemId);
            const movement = this.inventoryService.recordMovement(itemType, itemId, -quantity, 'sale', 'استهلاك مادة بعد تعديل الطلب', {
              type: 'order_update', id: updatedOrder.id, number: existing.order_number
            });
            const unitCost = Number(material.unitCostAtUsage ?? (material as any).unit_cost_at_usage ?? meta.purchasePrice ?? 0);
            this.orderRepository.insertMaterialUsage({
              id: `OMU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, orderId: updatedOrder.id,
              itemType, itemId, itemName: material.itemName || (material as any).item_name || meta.name,
              quantity, unit: material.unit || meta.unit, unitCostAtUsage: unitCost, totalCost: round2(quantity * unitCost),
              sourceMovementId: movement.id, createdAt: new Date().toISOString()
            });
          }
        }
      }

      const totalAmount = updatedOrder.totalAmount || 0;
      const paidAmount = updatedOrder.paidAmount || 0;
      const remainingAmount = totalAmount - paidAmount;
      this.orderRepository.updateOrder({
        id: updatedOrder.id, customerName: updatedOrder.customerName, customerPhone: updatedOrder.customerPhone,
        thobeTypeId: updatedOrder.thobeTypeId, thobeTypeName: updatedOrder.thobeTypeName || 'ثوب',
        fabricId: updatedOrder.fabricId, fabricName: updatedOrder.fabricName || 'قماش', fabricColor: updatedOrder.fabricColor || 'أبيض',
        garmentCount: updatedOrder.garmentCount || 1, fabricConsumptionMeters: newMeters, deliveryDate: updatedOrder.deliveryDate,
        status: updatedOrder.status, totalAmount, paidAmount, remainingAmount,
        measurementsJson: JSON.stringify(normalizeMeasurements(updatedOrder.measurements)),
        styleDetailsJson: JSON.stringify(normalizeStyleDetails(updatedOrder.styleDetails)), notes: updatedOrder.notes || '', updatedAt: new Date().toISOString()
      });
      this.invoiceRepository.updateAmounts(updatedOrder.id, totalAmount, paidAmount, remainingAmount, remainingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid');
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
        const payments: PaymentRecord[] = JSON.parse(invoice.payments_json || '[]');
        for (const payment of payments) {
          const reversalId = `CASH-REV-${payment.id}`;
          if (!this.cashRepository.findById(reversalId)) {
            this.cashRepository.insert({
              id: reversalId, direction: 'out', sourceType: 'adjustment', sourceId: payment.id,
              referenceNumber: order.order_number, amount: payment.amount, paymentMethod: payment.method,
              transactionDate: new Date().toISOString().slice(0, 10), description: `عكس دفعة بسبب حذف الطلب #${order.order_number}`,
              createdAt: new Date().toISOString()
            });
          }
        }
      }
      this.invoiceRepository.deleteByOrderId(orderId);
      this.orderRepository.deleteMaterialUsages(orderId);
      this.orderRepository.delete(orderId);
    });

    deleteTx();
    return true;
  }
}
