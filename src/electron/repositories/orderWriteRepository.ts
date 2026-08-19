import Database from 'better-sqlite3';

export class OrderWriteRepository {
  constructor(private readonly db: Database.Database) {}

  updatePayment(orderId: string, paidAmount: number, remainingAmount: number): void {
    this.db.prepare(`
      UPDATE orders SET paid_amount = ?, remaining_amount = ?
      WHERE id = ?
    `).run(paidAmount, remainingAmount, orderId);
  }

  updateStatus(orderId: string, status: string, updatedAt: string): void {
    this.db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(status, updatedAt, orderId);
  }

  insertOrder(row: {
    id: string; orderNumber: string; customerId?: string; customerName?: string; customerPhone?: string;
    thobeTypeId?: string | null; thobeTypeName: string; fabricId?: string | null; fabricName: string; fabricColor: string;
    fabricConsumptionMeters: number; fabricBuyPriceAtOrder: number; garmentCount: number; orderDate: string; deliveryDate: string;
    status: string; totalAmount: number; paidAmount: number; remainingAmount: number; isCustomMeasurement: boolean;
    measurementsJson: string; styleDetailsJson: string; notes: string; createdAt: string;
  }): void {
    this.db.prepare(`
      INSERT INTO orders (
        id, order_number, customer_id, customer_name, customer_phone,
        thobe_type_id, thobe_type_name, fabric_id, fabric_name, fabric_color,
        fabric_consumption_meters, fabric_buy_price_at_order, garment_count,
        order_date, delivery_date, status, total_amount, paid_amount, remaining_amount,
        is_custom_measurement, measurements_json, style_details_json, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.id, row.orderNumber, row.customerId, row.customerName, row.customerPhone,
      row.thobeTypeId || null, row.thobeTypeName, row.fabricId || null, row.fabricName, row.fabricColor,
      row.fabricConsumptionMeters, row.fabricBuyPriceAtOrder, row.garmentCount, row.orderDate, row.deliveryDate,
      row.status, row.totalAmount, row.paidAmount, row.remainingAmount, row.isCustomMeasurement ? 1 : 0,
      row.measurementsJson, row.styleDetailsJson, row.notes, row.createdAt
    );
  }

  insertMaterialUsage(row: {
    id: string; orderId: string; itemType: string; itemId: string; itemName: string; quantity: number;
    unit: string; unitCostAtUsage: number; totalCost: number; sourceMovementId?: string; createdAt: string;
  }): void {
    this.db.prepare(`
      INSERT INTO order_material_usages (id, order_id, item_type, item_id, item_name, quantity, unit, unit_cost_at_usage, total_cost, source_movement_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(row.id, row.orderId, row.itemType, row.itemId, row.itemName, row.quantity, row.unit, row.unitCostAtUsage, row.totalCost, row.sourceMovementId || null, row.createdAt);
  }

  insertInvoice(row: {
    id: string; invoiceNumber: string; orderId: string; customerName?: string; customerPhone?: string; orderDate: string;
    totalAmount: number; paidAmount: number; remainingAmount: number; paymentStatus: string; paymentsJson: string;
  }): void {
    this.db.prepare(`
      INSERT INTO invoices (
        id, invoice_number, order_id, customer_name, customer_phone,
        order_date, total_amount, paid_amount, remaining_amount, payment_status, payments_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(row.id, row.invoiceNumber, row.orderId, row.customerName, row.customerPhone, row.orderDate, row.totalAmount, row.paidAmount, row.remainingAmount, row.paymentStatus, row.paymentsJson);
  }

  deleteMaterialUsages(orderId: string): void {
    this.db.prepare('DELETE FROM order_material_usages WHERE order_id = ?').run(orderId);
  }

  updateMaterialUsageSourceMovement(usageId: string, sourceMovementId: string | null): void {
    this.db.prepare('UPDATE order_material_usages SET source_movement_id = ? WHERE id = ?').run(sourceMovementId, usageId);
  }

  updateOrder(row: {
    id: string; customerName?: string; customerPhone?: string; thobeTypeId?: string | null; thobeTypeName: string;
    fabricId?: string | null; fabricName: string; fabricColor: string; garmentCount: number; fabricConsumptionMeters: number;
    deliveryDate: string; status: string; totalAmount: number; paidAmount: number; remainingAmount: number;
    measurementsJson: string; styleDetailsJson: string; notes: string; updatedAt: string;
  }): void {
    this.db.prepare(`
      UPDATE orders SET
        customer_name = ?, customer_phone = ?, thobe_type_id = ?, thobe_type_name = ?,
        fabric_id = ?, fabric_name = ?, fabric_color = ?, garment_count = ?,
        fabric_consumption_meters = ?, delivery_date = ?, status = ?,
        total_amount = ?, paid_amount = ?, remaining_amount = ?,
        measurements_json = ?, style_details_json = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(
      row.customerName, row.customerPhone, row.thobeTypeId || null, row.thobeTypeName,
      row.fabricId || null, row.fabricName, row.fabricColor, row.garmentCount, row.fabricConsumptionMeters,
      row.deliveryDate, row.status, row.totalAmount, row.paidAmount, row.remainingAmount,
      row.measurementsJson, row.styleDetailsJson, row.notes, row.updatedAt, row.id
    );
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM orders WHERE id = ?').run(id);
  }
}
