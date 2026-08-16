import { Order, OrderMaterialUsage, StockMovement } from '../../types';
import { normalizeMeasurements, normalizeStyleDetails } from '../../services/shared/measurementDefaults';
import { round2 } from '../../services/shared/inventoryRules';
import { CashRepository } from '../repositories/cashRepository';
import { OrderEventRepository } from '../repositories/orderEventRepository';
import { OrderRepository } from '../repositories/orderRepository';
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
}
