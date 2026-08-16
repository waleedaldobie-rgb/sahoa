import { OrderEvent } from '../../types';
import { CashRepository } from '../repositories/cashRepository';
import { OrderEventRepository } from '../repositories/orderEventRepository';
import { OrderRepository } from '../repositories/orderRepository';
import { InventoryService } from './inventoryService';

export class OrderStatusService {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly inventoryService: InventoryService,
    private readonly eventRepository: OrderEventRepository,
    private readonly db: { transaction<T>(callback: () => T): () => T }
  ) {}

  updateStatus(orderId: string, status: string): boolean {
    const tx = this.db.transaction(() => {
      const order = this.orderRepository.findById(orderId);
      if (!order) return false;
      const materials = this.orderRepository.listMaterialUsages(orderId);
      if (status === 'cancelled' && order.status !== 'cancelled') {
        for (const material of materials) {
          if (material.item_id) {
            this.inventoryService.recordMovement(material.item_type, material.item_id, material.quantity, 'return', 'إرجاع مواد بسبب إلغاء الطلب', {
              type: 'order_cancel', id: orderId, number: order.order_number
            });
          }
        }
      } else if (order.status === 'cancelled' && status !== 'cancelled') {
        for (const material of materials) {
          if (material.item_id) {
            this.inventoryService.recordMovement(material.item_type, material.item_id, -material.quantity, 'sale', 'إعادة استهلاك مواد بعد إلغاء الإلغاء', {
              type: 'order_reactivate', id: orderId, number: order.order_number
            });
          }
        }
      }

      const updatedAt = new Date().toISOString();
      this.orderRepository.updateStatus(orderId, status, updatedAt);
      if (order.status !== status) {
        const event: OrderEvent = {
          id: `EVT-STATUS-${orderId}-${Date.now()}`,
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
      }
      return true;
    });
    return tx();
  }
}
