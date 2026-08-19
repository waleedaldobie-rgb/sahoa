import { OrderEvent } from '../../types';
import { NotificationRepository } from '../repositories/notificationRepository';
import { OrderEventRepository } from '../repositories/orderEventRepository';
import { OrderRepository } from '../repositories/orderRepository';
import { createSafeId } from '../../domain/idGenerator';

export type WhatsAppDeliveryResult = 'opened' | 'failed';

export class WhatsAppService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly orderRepository: OrderRepository,
    private readonly eventRepository: OrderEventRepository
  ) {}

  prepareMessage(phone: string, customerName: string, orderNumber: string, statusText: string): { url: string; message: string; orderId?: string } {
    const internationalPhone = phone.startsWith('0') ? '966' + phone.slice(1) : phone;
    const message = `مرحباً بك أ/ ${customerName}، نفيدك بنتيجة متابعة طلبك رقم (#${orderNumber}) لدى صهوة للخياطة. حالياً: ${statusText}. يسعدنا تواصلكم دائماً!`;
    const order = this.orderRepository.findByOrderNumber(orderNumber);
    return {
      url: `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`,
      message,
      orderId: order?.id
    };
  }

  recordDeliveryResult(
    phone: string,
    customerName: string,
    orderNumber: string,
    statusText: string,
    prepared: { orderId?: string },
    result: WhatsAppDeliveryResult
  ): void {
    const notificationId = createSafeId('NOTIF');
    const now = new Date().toISOString();
    const succeeded = result === 'opened';
    this.notificationRepository.insert({
      id: notificationId,
      type: 'whatsapp',
      title: `${succeeded ? 'تم فتح' : 'فشل فتح'} واتساب - طلب #${orderNumber}`,
      message: `${succeeded ? 'تم فتح' : 'فشل فتح'} رسالة واتساب للعميل ${customerName} (${phone}) - الحالة: ${statusText}`,
      date: new Date().toLocaleString('ar-SA'),
      read: true,
      customerPhone: phone,
      orderId: prepared.orderId || null
    });
    if (prepared.orderId) {
      const event: OrderEvent = {
        id: `EVT-WHATSAPP-${notificationId}`,
        orderId: prepared.orderId,
        type: 'whatsapp',
        title: succeeded ? 'فتح رسالة واتساب' : 'فشل فتح رسالة واتساب',
        description: `${succeeded ? 'تم فتح' : 'فشل فتح'} رسالة واتساب للعميل ${customerName} عن حالة الطلب: ${statusText}.`,
        actor: 'النظام',
        metadata: { phone, orderNumber, statusText, result },
        createdAt: now
      };
      this.eventRepository.insert(event);
    }
  }
}
