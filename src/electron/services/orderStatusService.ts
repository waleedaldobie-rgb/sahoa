import { OrderEvent, OrderStatus } from '../../types';
import { OrderEventRepository } from '../repositories/orderEventRepository';
import { OrderRepository } from '../repositories/orderRepository';
import { OrderWriteRepository } from '../repositories/orderWriteRepository';
import { InventoryService } from './inventoryService';
import { createSafeId } from '../../domain/idGenerator';

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
    const tx = this.db.transaction(() => {
      const order = this.orderRepository.findById(orderId);
      if (!order) return false;
      if (order.status === status) return true;
      if (!ALLOWED_TRANSITIONS[order.status]?.includes(status)) {
        throw new Error(`انتقال حالة الطلب من ${order.status} إلى ${status} غير مسموح`);
      }

      const materials = this.orderRepository.listMaterialUsages(orderId);
      if (status === 'cancelled') {
        for (const material of materials) {
          if (material.item_id) {
            this.inventoryService.recordMovement(material.item_type, material.item_id, material.quantity, 'return', 'إرجاع مواد بسبب إلغاء الطلب', {
              type: 'order_cancel', id: orderId, number: order.order_number
            });
          }
          this.orderWriteRepository.updateMaterialUsageSourceMovement(material.id, null);
        }
      } else if (order.status === 'cancelled' && status === 'new') {
        for (const material of materials) {
          if (!material.item_id) continue;
          const movement = this.inventoryService.recordMovement(material.item_type, material.item_id, -material.quantity, 'sale', 'إعادة استهلاك مواد بعد إلغاء الإلغاء', {
            type: 'order_reactivate', id: orderId, number: order.order_number
          });
          this.orderWriteRepository.updateMaterialUsageSourceMovement(material.id, movement.id);
        }
      }

      const updatedAt = new Date().toISOString();
      this.orderWriteRepository.updateStatus(orderId, status as OrderStatus, updatedAt);
      const event: OrderEvent = {
        id: createSafeId(`EVT-STATUS-${orderId}`),
        orderId,
        type: 'status_changed',
        title: `تغيير الحالة إلى ${status}`,
        description: `تم تغيير حالة الطلب من ${order.status} إلى ${status}${status === 'cancelled' ? ' مع إعادة المواد للمخزون' : order.status === 'cancelled' ? ' مع إعادة استهلاك المواد' : ''}.`,
        fromStatus: order.status,
        toStatus: status,
        actor: 'النظام',
        createdAt: updatedAt
      };
      this.eventRepository.insert(event);
      return true;
    });
    return tx();
  }
}
