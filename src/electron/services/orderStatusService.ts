import { OrderEvent, OrderStatus } from '../../types';
import { OrderEventRepository } from '../repositories/orderEventRepository';
import { OrderRepository } from '../repositories/orderRepository';
import { OrderWriteRepository } from '../repositories/orderWriteRepository';
import { InventoryService } from './inventoryService';
import { createSafeId } from '../../domain/idGenerator';
import { assertValidOrderStatus } from '../../domain/orderRules';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  new: ['processing', 'cancelled'],
  processing: ['ready', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: ['new']
};

export class OrderStatusService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly orderWriteRepository: OrderWriteRepository,
    private readonly inventoryService: InventoryService,
    private readonly eventRepository: OrderEventRepository,
    private readonly db: { transaction<T>(callback: () => T): () => T }
  ) {}

  updateStatus(orderId: string, status: string): boolean {
    const validatedStatus = assertValidOrderStatus(status);
    const tx = this.db.transaction(() => {
      const order = this.orderRepository.findById(orderId);
      if (!order) return false;
      if (order.status === validatedStatus) return true;
      if (!ALLOWED_TRANSITIONS[order.status]?.includes(validatedStatus)) {
        throw new Error(`انتقال حالة الطلب من ${order.status} إلى ${status} غير مسموح`);
      }

      const materials = this.orderRepository.listMaterialUsages(orderId);
      if (validatedStatus === 'cancelled') {
        for (const material of materials) {
          if (material.item_id) {
            this.inventoryService.recordMovement(material.item_type, material.item_id, material.quantity, 'return', 'إرجاع مواد بسبب إلغاء الطلب', {
              type: 'order_cancel', id: orderId, number: order.order_number
            });
          }
          this.orderWriteRepository.updateMaterialUsageSourceMovement(material.id, null);
        }
      } else if (order.status === 'cancelled' && validatedStatus === 'new') {
        for (const material of materials) {
          if (!material.item_id) continue;
          const movement = this.inventoryService.recordMovement(material.item_type, material.item_id, -material.quantity, 'sale', 'إعادة استهلاك مواد بعد إلغاء الإلغاء', {
            type: 'order_reactivate', id: orderId, number: order.order_number
          });
          this.orderWriteRepository.updateMaterialUsageSourceMovement(material.id, movement.id);
        }
      }

      const updatedAt = new Date().toISOString();
      this.orderWriteRepository.updateStatus(orderId, validatedStatus, updatedAt);
      const event: OrderEvent = {
        id: createSafeId(`EVT-STATUS-${orderId}`),
        orderId,
        type: 'status_changed',
        title: `تغيير الحالة إلى ${validatedStatus}`,
        description: `تم تغيير حالة الطلب من ${order.status} إلى ${validatedStatus}${validatedStatus === 'cancelled' ? ' مع إعادة المواد للمخزون' : order.status === 'cancelled' ? ' مع إعادة استهلاك المواد' : ''}.`,
        fromStatus: order.status,
        toStatus: validatedStatus,
        actor: 'النظام',
        createdAt: updatedAt
      };
      this.eventRepository.insert(event);
      return true;
    });
    return tx();
  }
}
