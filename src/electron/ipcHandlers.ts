import { ipcMain } from 'electron';
import { SahwaDatabaseManager } from './db';
import { safeIpcHandle } from './errorHandler';
import { Order, Customer, FabricItem, AccessoryItem, ThobeType, ColorItem, Invoice, PaymentRecord, NotificationItem } from '../types';

export function registerIpcHandlers(dbManager: SahwaDatabaseManager) {
  const db = dbManager.getRawDb();

  // -------------------------------------------------------------
  // CUSTOMERS IPC HANDLERS
  // -------------------------------------------------------------
  safeIpcHandle(ipcMain, 'customers:list', async () => {
    const rawCustomers = db.prepare('SELECT * FROM customers ORDER BY name ASC').all() as any[];
    const rawHistory = db.prepare('SELECT * FROM customer_measurement_history ORDER BY saved_at DESC').all() as any[];

    const historyMap = new Map<string, any[]>();
    for (const h of rawHistory) {
      const list = historyMap.get(h.customer_id) || [];
      list.push({
        id: h.id,
        savedAt: h.saved_at,
        note: h.note || '',
        measurements: JSON.parse(h.measurements_json || '{}'),
        styleDetails: JSON.parse(h.style_details_json || '{}')
      });
      historyMap.set(h.customer_id, list);
    }

    return rawCustomers.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      createdAt: c.created_at,
      measurements: JSON.parse(c.measurements_json || '{}'),
      styleDetails: JSON.parse(c.style_details_json || '{}'),
      measurementHistory: historyMap.get(c.id) || []
    }));
  });

  safeIpcHandle(ipcMain, 'customers:create', async (_, customer: Partial<Customer>) => {
    const id = customer.id || `CUST-${Date.now()}`;
    const name = customer.name || 'عميل جديد';
    const phone = (customer.phone || '').trim();
    const createdAt = customer.createdAt || new Date().toISOString().slice(0, 10);
    
    // Check if phone number is already registered
    const existing = db.prepare('SELECT id FROM customers WHERE phone = ?').get(phone) as any;
    if (existing) {
      throw new Error('رقم الجوال مسجل بالفعل لعميل آخر');
    }

    const measurementsJson = JSON.stringify(customer.measurements || {});
    const styleDetailsJson = JSON.stringify(customer.styleDetails || {});

    db.prepare(`
      INSERT INTO customers (id, name, phone, created_at, measurements_json, style_details_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, phone, createdAt, measurementsJson, styleDetailsJson);

    return { id, name, phone, createdAt, measurements: customer.measurements, styleDetails: customer.styleDetails, measurementHistory: [] };
  });

  safeIpcHandle(ipcMain, 'customers:update', async (_, customer: Customer) => {
    const phone = (customer.phone || '').trim();
    // Check if phone is used by another customer
    const existing = db.prepare('SELECT id FROM customers WHERE phone = ? AND id != ?').get(phone, customer.id) as any;
    if (existing) {
      throw new Error('رقم الجوال مسجل بالفعل لعميل آخر');
    }

    db.prepare(`
      UPDATE customers 
      SET name = ?, phone = ?, measurements_json = ?, style_details_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      customer.name,
      phone,
      JSON.stringify(customer.measurements || {}),
      JSON.stringify(customer.styleDetails || {}),
      new Date().toISOString(),
      customer.id
    );

    return true;
  });

  safeIpcHandle(ipcMain, 'customers:delete', async (_, customerId: string) => {
    db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);
    return true;
  });

  safeIpcHandle(ipcMain, 'customers:saveMeasurementHistory', async (_, customerId: string, note: string) => {
    const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
    if (!cust) throw new Error('العميل غير موجود في قاعدة البيانات');

    const histId = `HIST-${Date.now()}`;
    const savedAt = new Date().toISOString().slice(0, 10);

    db.prepare(`
      INSERT INTO customer_measurement_history (id, customer_id, saved_at, note, measurements_json, style_details_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(histId, customerId, savedAt, note || 'تحديث مقاسات', cust.measurements_json, cust.style_details_json);

    return {
      id: histId,
      savedAt,
      note,
      measurements: JSON.parse(cust.measurements_json || '{}'),
      styleDetails: JSON.parse(cust.style_details_json || '{}')
    };
  });

  // -------------------------------------------------------------
  // FABRICS & INVENTORY IPC HANDLERS
  // -------------------------------------------------------------
  safeIpcHandle(ipcMain, 'fabrics:list', async () => {
    const rows = db.prepare('SELECT * FROM fabrics ORDER BY name ASC').all() as any[];
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      color: r.color,
      colorHex: r.color_hex,
      purchasePrice: r.purchase_price,
      sellingPrice: r.selling_price,
      quantityMeters: r.quantity_meters,
      minStockMeters: r.min_stock_meters
    }));
  });

  safeIpcHandle(ipcMain, 'fabrics:create', async (_, fabric: Partial<FabricItem>) => {
    const id = fabric.id || `FAB-${Date.now()}`;
    db.prepare(`
      INSERT INTO fabrics (id, name, color, color_hex, purchase_price, selling_price, quantity_meters, min_stock_meters, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      fabric.name || 'قماش جديد',
      fabric.color || 'أبيض',
      fabric.colorHex || '#ffffff',
      fabric.purchasePrice || 0,
      fabric.sellingPrice || 0,
      fabric.quantityMeters || 0,
      fabric.minStockMeters || 10,
      new Date().toISOString()
    );

    return { ...fabric, id };
  });

  safeIpcHandle(ipcMain, 'fabrics:update', async (_, fabric: FabricItem) => {
    db.prepare(`
      UPDATE fabrics
      SET name = ?, color = ?, color_hex = ?, purchase_price = ?, selling_price = ?, quantity_meters = ?, min_stock_meters = ?
      WHERE id = ?
    `).run(
      fabric.name, fabric.color, fabric.colorHex,
      fabric.purchasePrice, fabric.sellingPrice, fabric.quantityMeters,
      fabric.minStockMeters, fabric.id
    );
    return true;
  });

  safeIpcHandle(ipcMain, 'fabrics:delete', async (_, fabricId: string) => {
    db.prepare('DELETE FROM fabrics WHERE id = ?').run(fabricId);
    return true;
  });

  safeIpcHandle(ipcMain, 'accessories:list', async () => {
    const rows = db.prepare('SELECT * FROM accessories ORDER BY category ASC, name ASC').all() as any[];
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      quantity: r.quantity,
      minStock: r.min_stock,
      unit: r.unit
    }));
  });

  safeIpcHandle(ipcMain, 'accessories:create', async (_, acc: Partial<AccessoryItem>) => {
    const id = acc.id || `ACC-${Date.now()}`;
    db.prepare(`
      INSERT INTO accessories (id, name, category, quantity, min_stock, unit, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, acc.name || 'عنصر', acc.category || 'عام', acc.quantity || 0, acc.minStock || 5, acc.unit || 'حبة', new Date().toISOString());
    return { ...acc, id };
  });

  safeIpcHandle(ipcMain, 'accessories:update', async (_, acc: AccessoryItem) => {
    db.prepare(`
      UPDATE accessories SET name = ?, category = ?, quantity = ?, min_stock = ?, unit = ? WHERE id = ?
    `).run(acc.name, acc.category, acc.quantity, acc.minStock, acc.unit, acc.id);
    return true;
  });

  safeIpcHandle(ipcMain, 'accessories:delete', async (_, accId: string) => {
    db.prepare('DELETE FROM accessories WHERE id = ?').run(accId);
    return true;
  });


  // -------------------------------------------------------------
  // THOBE TYPES & COLORS IPC HANDLERS
  // -------------------------------------------------------------
  safeIpcHandle(ipcMain, 'thobeTypes:list', async () => {
    return db.prepare('SELECT id, name, default_price as defaultPrice, description FROM dress_types ORDER BY name ASC').all();
  });

  safeIpcHandle(ipcMain, 'thobeTypes:create', async (_, item: Partial<ThobeType>) => {
    const id = item.id || `TH-${Date.now()}`;
    db.prepare('INSERT INTO dress_types (id,name,default_price,description) VALUES (?,?,?,?)')
      .run(id, item.name || 'نوع جديد', item.defaultPrice || 0, item.description || '');
    return { ...item, id } as ThobeType;
  });

  safeIpcHandle(ipcMain, 'thobeTypes:update', async (_, item: ThobeType) => {
    db.prepare('UPDATE dress_types SET name=?, default_price=?, description=? WHERE id=?')
      .run(item.name, item.defaultPrice || 0, item.description || '', item.id);
    return true;
  });

  safeIpcHandle(ipcMain, 'colors:list', async () => {
    return db.prepare('SELECT id, name, hex FROM colors ORDER BY name ASC').all();
  });

  safeIpcHandle(ipcMain, 'colors:create', async (_, item: Partial<ColorItem>) => {
    const id = item.id || `COL-${Date.now()}`;
    db.prepare('INSERT INTO colors (id,name,hex) VALUES (?,?,?)')
      .run(id, item.name || 'لون جديد', item.hex || '#ffffff');
    return { ...item, id } as ColorItem;
  });

  safeIpcHandle(ipcMain, 'colors:update', async (_, item: ColorItem) => {
    db.prepare('UPDATE colors SET name=?, hex=? WHERE id=?')
      .run(item.name, item.hex, item.id);
    return true;
  });

  // -------------------------------------------------------------
  // ORDERS & TRANSACTIONS IPC HANDLERS
  // -------------------------------------------------------------
  safeIpcHandle(ipcMain, 'orders:list', async () => {
    const rows = db.prepare('SELECT * FROM orders ORDER BY order_date DESC, created_at DESC').all() as any[];
    return rows.map(o => ({
      id: o.id,
      orderNumber: o.order_number,
      customerId: o.customer_id,
      customerName: o.customer_name,
      customerPhone: o.customer_phone,
      thobeTypeId: o.thobe_type_id,
      thobeTypeName: o.thobe_type_name,
      fabricId: o.fabric_id,
      fabricName: o.fabric_name,
      fabricColor: o.fabric_color,
      fabricConsumptionMeters: o.fabric_consumption_meters,
      fabricBuyPriceAtOrder: o.fabric_buy_price_at_order,
      garmentCount: o.garment_count,
      orderDate: o.order_date,
      deliveryDate: o.delivery_date,
      status: o.status,
      totalAmount: o.total_amount,
      paidAmount: o.paid_amount,
      remainingAmount: o.remaining_amount,
      isCustomMeasurement: Boolean(o.is_custom_measurement),
      measurements: JSON.parse(o.measurements_json || '{}'),
      styleDetails: JSON.parse(o.style_details_json || '{}'),
      notes: o.notes,
      createdAt: o.created_at
    }));
  });

  /**
   * TRANSACTION REQUIREMENT: Create Order + Deduct Fabric Stock synchronously inside db.transaction()
   */
  safeIpcHandle(ipcMain, 'orders:create', async (_, orderData: Partial<Order>) => {
    const settings = dbManager.getSettings();
    const rate = settings.fabricConsumptionRatePerGarment || 3.5;
    const garmentCount = orderData.garmentCount || 1;
    const requiredMeters = garmentCount * rate;

    // Execute in a single atomic SQLite transaction
    const createOrderTx = db.transaction(() => {
      // 1. Check Fabric Stock Availability
      let fabricBuyPrice = 0;
      if (orderData.fabricId) {
        const fab = db.prepare('SELECT * FROM fabrics WHERE id = ?').get(orderData.fabricId) as any;
        if (!fab) {
          throw new Error('القماش المختار غير موجود في المخزون');
        }

        if (fab.quantity_meters < requiredMeters) {
          throw new Error(`كمية القماش المتوفرة (${fab.quantity_meters} متر) غير كافية لخصم الطلب الحالي (${requiredMeters} متر).`);
        }

        fabricBuyPrice = fab.purchase_price || 0;

        // Deduct Fabric Stock
        db.prepare('UPDATE fabrics SET quantity_meters = quantity_meters - ? WHERE id = ?').run(requiredMeters, orderData.fabricId);
      }

      // 2. Compute Financial Numbers (remaining = total - paid)
      const orderId = orderData.id || `ORD-${Date.now()}`;
      const count = (db.prepare('SELECT COUNT(*) as c FROM orders').get() as any).c;
      const orderNumber = orderData.orderNumber || `${1001 + count}`;
      const totalAmount = orderData.totalAmount || 0;
      const paidAmount = orderData.paidAmount || 0;
      const remainingAmount = totalAmount - paidAmount;

      // 3. Insert Order
      db.prepare(`
        INSERT INTO orders (
          id, order_number, customer_id, customer_name, customer_phone,
          thobe_type_id, thobe_type_name, fabric_id, fabric_name, fabric_color,
          fabric_consumption_meters, fabric_buy_price_at_order, garment_count,
          order_date, delivery_date, status, total_amount, paid_amount, remaining_amount,
          is_custom_measurement, measurements_json, style_details_json, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderId,
        orderNumber,
        orderData.customerId,
        orderData.customerName,
        orderData.customerPhone,
        orderData.thobeTypeId || null,
        orderData.thobeTypeName || 'ثوب',
        orderData.fabricId || null,
        orderData.fabricName || 'قماش',
        orderData.fabricColor || 'أبيض',
        requiredMeters,
        fabricBuyPrice,
        garmentCount,
        orderData.orderDate || new Date().toISOString().slice(0, 10),
        orderData.deliveryDate || new Date().toISOString().slice(0, 10),
        orderData.status || 'new',
        totalAmount,
        paidAmount,
        remainingAmount,
        orderData.isCustomMeasurement ? 1 : 0,
        JSON.stringify(orderData.measurements || {}),
        JSON.stringify(orderData.styleDetails || {}),
        orderData.notes || '',
        new Date().toISOString()
      );

      // 4. Create Matching Invoice Record
      const invId = `INV-${orderNumber}`;
      const pStatus = remainingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
      const initialPayments = paidAmount > 0 ? [{
        id: `PAY-${Date.now()}`,
        invoiceId: invId,
        orderId: orderId,
        amount: paidAmount,
        paymentDate: orderData.orderDate || new Date().toISOString().slice(0, 10),
        method: 'card',
        note: 'دفعة أولى عند إنشاء الطلب'
      }] : [];

      db.prepare(`
        INSERT INTO invoices (
          id, invoice_number, order_id, customer_name, customer_phone,
          order_date, total_amount, paid_amount, remaining_amount, payment_status, payments_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        invId,
        `INV-${orderNumber}`,
        orderId,
        orderData.customerName,
        orderData.customerPhone,
        orderData.orderDate || new Date().toISOString().slice(0, 10),
        totalAmount,
        paidAmount,
        remainingAmount,
        pStatus,
        JSON.stringify(initialPayments)
      );

      return { orderId, orderNumber, remainingAmount };
    });

    const result = createOrderTx();
    return { ...orderData, id: result.orderId, orderNumber: result.orderNumber, remainingAmount: result.remainingAmount };
  });

  /**
   * TRANSACTION REQUIREMENT: Update order + Adjust fabric deduction differences cleanly
   */
  safeIpcHandle(ipcMain, 'orders:update', async (_, updatedOrder: Order) => {
    const updateTx = db.transaction(() => {
      const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(updatedOrder.id) as any;
      if (!existing) throw new Error('الطلب المطلوب غير موجود');

      const settings = dbManager.getSettings();
      const rate = settings.fabricConsumptionRatePerGarment || 3.5;
      const newMeters = (updatedOrder.garmentCount || 1) * rate;

      // Handle Fabric Exchange logic if fabric changed or quantity changed
      const fabricChanged = existing.fabric_id !== updatedOrder.fabricId;
      const countChanged = existing.garment_count !== updatedOrder.garmentCount;

      if ((fabricChanged || countChanged) && existing.status !== 'cancelled') {
        // 1. Restore previous fabric deduction
        if (existing.fabric_id) {
          db.prepare('UPDATE fabrics SET quantity_meters = quantity_meters + ? WHERE id = ?')
            .run(existing.fabric_consumption_meters, existing.fabric_id);
        }

        // 2. Check stock & deduct new fabric
        if (updatedOrder.fabricId) {
          const newFab = db.prepare('SELECT * FROM fabrics WHERE id = ?').get(updatedOrder.fabricId) as any;
          if (!newFab) throw new Error('القماش الجديد المختار غير موجود');
          if (newFab.quantity_meters < newMeters) {
            throw new Error(`الكمية المتاحة من القماش الجديدة (${newFab.quantity_meters} متر) غير كافية للطلب (${newMeters} متر).`);
          }

          db.prepare('UPDATE fabrics SET quantity_meters = quantity_meters - ? WHERE id = ?')
            .run(newMeters, updatedOrder.fabricId);

          updatedOrder.fabricBuyPriceAtOrder = newFab.purchase_price || 0;
        }
      }

      // Financial Calculation
      const totalAmount = updatedOrder.totalAmount || 0;
      const paidAmount = updatedOrder.paidAmount || 0;
      const remainingAmount = totalAmount - paidAmount;

      db.prepare(`
        UPDATE orders SET
          customer_name = ?, customer_phone = ?, thobe_type_id = ?, thobe_type_name = ?,
          fabric_id = ?, fabric_name = ?, fabric_color = ?, garment_count = ?,
          fabric_consumption_meters = ?, delivery_date = ?, status = ?,
          total_amount = ?, paid_amount = ?, remaining_amount = ?,
          measurements_json = ?, style_details_json = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `).run(
        updatedOrder.customerName, updatedOrder.customerPhone,
        updatedOrder.thobeTypeId, updatedOrder.thobeTypeName,
        updatedOrder.fabricId, updatedOrder.fabricName, updatedOrder.fabricColor,
        updatedOrder.garmentCount || 1, newMeters, updatedOrder.deliveryDate,
        updatedOrder.status, totalAmount, paidAmount, remainingAmount,
        JSON.stringify(updatedOrder.measurements || {}),
        JSON.stringify(updatedOrder.styleDetails || {}),
        updatedOrder.notes || '', new Date().toISOString(),
        updatedOrder.id
      );

      // Update invoice as well
      const pStatus = remainingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';
      db.prepare(`
        UPDATE invoices SET
          total_amount = ?, paid_amount = ?, remaining_amount = ?, payment_status = ?
        WHERE order_id = ?
      `).run(totalAmount, paidAmount, remainingAmount, pStatus, updatedOrder.id);
    });

    updateTx();
    return true;
  });

  /**
   * TRANSACTION REQUIREMENT: Delete order + return fabric stock automatically
   */
  safeIpcHandle(ipcMain, 'orders:delete', async (_, orderId: string) => {
    const deleteTx = db.transaction(() => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
      if (order && order.fabric_id && order.status !== 'cancelled') {
        // Return fabric back to stock
        db.prepare('UPDATE fabrics SET quantity_meters = quantity_meters + ? WHERE id = ?')
          .run(order.fabric_consumption_meters, order.fabric_id);
      }

      db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
      db.prepare('DELETE FROM invoices WHERE order_id = ?').run(orderId);
    });

    deleteTx();
    return true;
  });

  /**
   * TRANSACTION REQUIREMENT: Status Change to Cancelled -> Restore fabric
   */
  safeIpcHandle(ipcMain, 'orders:updateStatus', async (_, orderId: string, status: string) => {
    const statusTx = db.transaction(() => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
      if (!order) return;

      if (status === 'cancelled' && order.status !== 'cancelled' && order.fabric_id) {
        // Return fabric meters
        db.prepare('UPDATE fabrics SET quantity_meters = quantity_meters + ? WHERE id = ?')
          .run(order.fabric_consumption_meters, order.fabric_id);
      } else if (order.status === 'cancelled' && status !== 'cancelled' && order.fabric_id) {
        // Re-check and re-deduct meters
        const fab = db.prepare('SELECT * FROM fabrics WHERE id = ?').get(order.fabric_id) as any;
        if (fab && fab.quantity_meters < order.fabric_consumption_meters) {
          throw new Error('لا توجد كمية قماش كافية لتغيير الحالة من ملغي إلى نشط.');
        }
        db.prepare('UPDATE fabrics SET quantity_meters = quantity_meters - ? WHERE id = ?')
          .run(order.fabric_consumption_meters, order.fabric_id);
      }

      db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), orderId);
    });

    statusTx();
    return true;
  });

  // -------------------------------------------------------------
  // INVOICES & PAYMENTS IPC
  // -------------------------------------------------------------
  safeIpcHandle(ipcMain, 'invoices:list', async () => {
    const rows = db.prepare('SELECT * FROM invoices ORDER BY order_date DESC').all() as any[];
    return rows.map(i => ({
      id: i.id,
      invoiceNumber: i.invoice_number,
      orderId: i.order_id,
      customerName: i.customer_name,
      customerPhone: i.customer_phone,
      orderDate: i.order_date,
      totalAmount: i.total_amount,
      paidAmount: i.paid_amount,
      remainingAmount: i.remaining_amount,
      paymentStatus: i.payment_status,
      payments: JSON.parse(i.payments_json || '[]')
    }));
  });

  safeIpcHandle(ipcMain, 'invoices:addPayment', async (_, invoiceId: string, amount: number, method: string, note: string) => {
    const paymentTx = db.transaction(() => {
      const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as any;
      if (!inv) throw new Error('الفاتورة غير موجودة');

      const existingPayments: PaymentRecord[] = JSON.parse(inv.payments_json || '[]');
      const newPayment: PaymentRecord = {
        id: `PAY-${Date.now()}`,
        invoiceId,
        orderId: inv.order_id,
        amount,
        paymentDate: new Date().toISOString().slice(0, 10),
        method: method as any,
        note
      };

      existingPayments.push(newPayment);

      const newPaid = inv.paid_amount + amount;
      const newRemaining = inv.total_amount - newPaid;
      const newStatus = newRemaining <= 0 ? 'paid' : 'partial';

      db.prepare(`
        UPDATE invoices SET
          paid_amount = ?, remaining_amount = ?, payment_status = ?, payments_json = ?
        WHERE id = ?
      `).run(newPaid, newRemaining, newStatus, JSON.stringify(existingPayments), invoiceId);

      // Synchronize order record as well
      db.prepare(`
        UPDATE orders SET
          paid_amount = ?, remaining_amount = ?
        WHERE id = ?
      `).run(newPaid, newRemaining, inv.order_id);
    });

    paymentTx();
    return true;
  });

  // -------------------------------------------------------------
  // SYSTEM & REPORTS IPC
  // -------------------------------------------------------------
  safeIpcHandle(ipcMain, 'system:backup', async () => {
    return dbManager.backupDatabase('manual_user');
  });

  safeIpcHandle(ipcMain, 'system:restore', async (_, jsonContent: string) => {
    return dbManager.restoreFromJson(jsonContent);
  });

  safeIpcHandle(ipcMain, 'reports:exportExcel', async (_, startDate?: string, endDate?: string) => {
    const buffer = dbManager.generateExcelReport(startDate, endDate);
    return buffer.toString('base64');
  });

  safeIpcHandle(ipcMain, 'settings:get', async () => {
    return dbManager.getSettings();
  });

  safeIpcHandle(ipcMain, 'settings:update', async (_, key: any, value: any) => {
    dbManager.updateSetting(key, value);
    return true;
  });

  safeIpcHandle(ipcMain, 'whatsapp:send', async (_, phone: string, customerName: string, orderNumber: string, statusText: string) => {
    const internationalPhone = phone.startsWith('0') ? '966' + phone.slice(1) : phone;
    const message = `مرحباً بك أ/ ${customerName}، نفيدك بنتيجة متابعة طلبك رقم (#${orderNumber}) لدى صهوة للخياطة. حالياً: ${statusText}. يسعدنا تواصلكم دائماً!`;
    const whatsappUrl = `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`;
    
    try {
      const { shell } = require('electron');
      await shell.openExternal(whatsappUrl);
    } catch (e) {
      console.error('Failed to open external WhatsApp URL:', e);
    }

    // Insert notification log into SQLite
    try {
      const notifId = `NOTIF-${Date.now()}`;
      const dateStr = new Date().toLocaleString('ar-SA');
      db.prepare(`
        INSERT INTO notifications (id, type, title, message, date, read, customer_phone)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        notifId,
        'whatsapp',
        `تذكير واتساب - طلب #${orderNumber}`,
        `تم إرسال رسالة واتساب للعميل ${customerName} (${phone}) - الحالة: ${statusText}`,
        dateStr,
        1,
        phone
      );
    } catch (err) {
      console.error('Failed to insert notification into database', err);
    }

    return true;
  });
}

