import { OrderEvent } from '../../types';
import { NotificationRepository } from '../repositories/notificationRepository';
import { OrderEventRepository } from '../repositories/orderEventRepository';
import { OrderRepository } from '../repositories/orderRepository';

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

  logPreparedMessage(phone: string, customerName: string, orderNumber: string, statusText: string): string {
    const prepared = this.prepareMessage(phone, customerName, orderNumber, statusText);
    const notifId = `NOTIF-${Date.now()}`;
    const now = new Date().toISOString();
    this.notificationRepository.insert({
      id: notifId,
      type: 'whatsapp',
      title: `تذكير واتساب - طلب #${orderNumber}`,
      message: `تم إرسال رسالة واتساب للعميل ${customerName} (${phone}) - الحالة: ${statusText}`,
      date: new Date().toLocaleString('ar-SA'),
      read: true,
      customerPhone: phone,
      orderId: prepared.orderId || null
    });
    if (prepared.orderId) {
      const event: OrderEvent = {
        id: `EVT-WHATSAPP-${notifId}`,
        orderId: prepared.orderId,
        type: 'whatsapp',
        title: 'فتح رسالة واتساب',
        description: `تم تجهيز رسالة واتساب للعميل ${customerName} عن حالة الطلب: ${statusText}.`,
        actor: 'النظام',
        metadata: { phone, orderNumber, statusText },
        createdAt: now
      };
      this.eventRepository.insert(event);
    }
    return prepared.url;
  }
}
