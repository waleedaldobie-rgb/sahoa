// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { initElectronMock, db, DEFAULT_MEASUREMENTS, DEFAULT_STYLE_DETAILS } from '../services/electronMock';
import { AppData, Order, FabricItem } from '../types';

describe('db.transaction - Atomic Operations & Rollback Tests', () => {
  let sampleFabric: FabricItem;

  beforeEach(() => {
    // Clear localStorage before each test run
    localStorage.clear();
    // Re-initialize mock window.electronAPI
    initElectronMock();

    sampleFabric = {
      id: 'FAB-TEST-001',
      name: 'قماش ياباني أبيض فاخر',
      color: 'أبيض',
      colorHex: '#FFFFFF',
      purchasePrice: 40,
      sellingPrice: 60,
      quantityMeters: 50,
      minStockMeters: 10
    };

    // Seed initial test AppData into localStorage
    const initialData: AppData = {
      customers: [
        {
          id: 'CUST-001',
          name: 'أحمد علي',
          phone: '0501234567',
          createdAt: '2026-01-01',
          measurements: { ...DEFAULT_MEASUREMENTS },
          styleDetails: { ...DEFAULT_STYLE_DETAILS },
          measurementHistory: []
        }
      ],
      orders: [],
      invoices: [],
      fabrics: [sampleFabric],
      accessories: [],
      thobeTypes: [],
      colors: [],
      notifications: []
    };

    localStorage.setItem('sahwa_tailoring_app_data_v1', JSON.stringify(initialData));
  });

  it('1. Successfully creates an order and deducts fabric stock atomically', async () => {
    const orderData: Partial<Order> = {
      customerId: 'CUST-001',
      customerName: 'أحمد علي',
      customerPhone: '0501234567',
      fabricId: 'FAB-TEST-001',
      fabricName: 'قماش ياباني أبيض فاخر',
      garmentCount: 2, // 2 garments * 3.5m = 7 meters
      totalAmount: 300,
      paidAmount: 100,
      orderDate: '2026-08-01'
    };

    const newOrder = await window.electronAPI.createOrder(orderData);
    expect(newOrder).toBeDefined();
    expect(newOrder.fabricConsumptionMeters).toBe(7);

    // Verify stored data
    const updatedData = await window.electronAPI.getData();
    expect(updatedData.orders.length).toBe(1);
    expect(updatedData.invoices.length).toBe(1);

    // Verify fabric stock deducted atomically (50m - 7m = 43m)
    const fab = updatedData.fabrics.find((f) => f.id === 'FAB-TEST-001');
    expect(fab?.quantityMeters).toBe(43);
  });

  it('2. Rolls back transaction completely if fabric stock is insufficient', async () => {
    // Attempting to order 20 garments * 3.5m = 70m (only 50m available in inventory)
    const excessOrderData: Partial<Order> = {
      customerId: 'CUST-001',
      customerName: 'أحمد علي',
      customerPhone: '0501234567',
      fabricId: 'FAB-TEST-001',
      fabricName: 'قماش ياباني أبيض فاخر',
      garmentCount: 20, // Requires 70 meters
      totalAmount: 3000,
      paidAmount: 500
    };

    // Expect error due to insufficient stock
    await expect(window.electronAPI.createOrder(excessOrderData)).rejects.toThrow(
      /غير كافية/
    );

    // Verify atomic rollback: fabric stock untouched, no order or invoice saved
    const currentData = await window.electronAPI.getData();
    expect(currentData.orders.length).toBe(0);
    expect(currentData.invoices.length).toBe(0);

    const fab = currentData.fabrics.find((f) => f.id === 'FAB-TEST-001');
    expect(fab?.quantityMeters).toBe(50); // Unchanged 50m
  });

  it('3. Rolls back completely if an unexpected error occurs during custom transaction callback', async () => {
    await expect(
      db.transaction((draft) => {
        // Mutate draft state mid-way
        const fab = draft.fabrics.find((f) => f.id === 'FAB-TEST-001');
        if (fab) {
          fab.quantityMeters = 0; // Partial mutation
        }
        draft.orders.push({ id: 'ORD-TEMP' } as any);

        // Throw error mid-transaction
        throw new Error('خطأ غير متوقع في قاعدة البيانات');
      })
    ).rejects.toThrow('خطأ غير متوقع في قاعدة البيانات');

    // Verify that partial mutations were NOT committed to storage
    const storedData = await window.electronAPI.getData();
    expect(storedData.orders.length).toBe(0);
    const fab = storedData.fabrics.find((f) => f.id === 'FAB-TEST-001');
    expect(fab?.quantityMeters).toBe(50);
  });

  it('4. Deleting an active order atomically restores fabric meters', async () => {
    // First, create an order deducting 7 meters (leaving 43m)
    const order = await window.electronAPI.createOrder({
      customerId: 'CUST-001',
      customerName: 'أحمد علي',
      fabricId: 'FAB-TEST-001',
      garmentCount: 2,
      totalAmount: 300
    });

    let data = await window.electronAPI.getData();
    expect(data.fabrics[0].quantityMeters).toBe(43);
    expect(data.orders.length).toBe(1);

    // Delete the order
    const success = await window.electronAPI.deleteOrder(order.id);
    expect(success).toBe(true);

    // Verify fabric stock was restored back to 50m and order/invoice removed
    data = await window.electronAPI.getData();
    expect(data.orders.length).toBe(0);
    expect(data.invoices.length).toBe(0);
    expect(data.fabrics[0].quantityMeters).toBe(50);
  });

  it('5. Cancelling an order restores fabric stock, and deleting a cancelled order avoids double restoration', async () => {
    // 1. Create order (deducts 7m -> stock 43m)
    const order = await window.electronAPI.createOrder({
      customerId: 'CUST-001',
      customerName: 'أحمد علي',
      fabricId: 'FAB-TEST-001',
      garmentCount: 2,
      totalAmount: 300
    });

    // 2. Change status to 'cancelled' (should restore 7m -> stock 50m)
    await window.electronAPI.updateOrderStatus(order.id, 'cancelled');
    let data = await window.electronAPI.getData();
    expect(data.fabrics[0].quantityMeters).toBe(50);
    expect(data.orders[0].status).toBe('cancelled');

    // 3. Deleting a cancelled order should NOT restore fabric again
    await window.electronAPI.deleteOrder(order.id);
    data = await window.electronAPI.getData();
    expect(data.fabrics[0].quantityMeters).toBe(50); // Remains 50m!
  });

  it('6. Triggers stock alert notification automatically when stock falls below minStockMeters', async () => {
    // Stock is 50m, minStockMeters is 10m.
    // Order 12 garments * 3.5m = 42 meters => Stock becomes 8 meters (<= 10m minStock)
    const { alertMessages } = await db.transaction(async (draft) => {
      const fab = draft.fabrics.find(f => f.id === 'FAB-TEST-001');
      if (fab) {
        fab.quantityMeters = 8;
      }
      const newOrder = {
        id: 'ORD-TEST-001',
        orderNumber: '1002',
        customerId: 'CUST-001',
        customerName: 'أحمد علي',
        customerPhone: '0501234567',
        thobeTypeId: 'THOBE-1',
        thobeTypeName: 'ثوب سعودي',
        fabricId: 'FAB-TEST-001',
        fabricName: 'قماش ياباني أبيض فاخر',
        fabricColor: 'أبيض',
        fabricConsumptionMeters: 42,
        fabricBuyPriceAtOrder: 25,
        garmentCount: 12,
        orderDate: '2026-06-01',
        deliveryDate: '2026-06-10',
        status: 'new' as const,
        totalAmount: 1800,
        paidAmount: 0,
        remainingAmount: 1800,
        isCustomMeasurement: false,
        measurements: { ...DEFAULT_MEASUREMENTS },
        styleDetails: { ...DEFAULT_STYLE_DETAILS },
        notes: '',
        createdAt: new Date().toISOString()
      };
      draft.orders = [newOrder, ...draft.orders];
    });

    const data = await window.electronAPI.getData();
    expect(data.fabrics[0].quantityMeters).toBe(8); // Below minStock 10
    expect(data.notifications.length).toBeGreaterThan(0);
    expect(data.notifications[0].type).toBe('stock');
    expect(data.notifications[0].message).toContain('قماش ياباني أبيض فاخر');
    expect(alertMessages.length).toBeGreaterThan(0);
  });

  it('7. Persists pocket, jabzour, neck and new measurement fields for customers and orders', async () => {
    const selectedStyleDetails = {
      ...DEFAULT_STYLE_DETAILS,
      neckType: 'قلاب',
      neckShape: 'فرنسي',
      neckPadding: 'بلاستيك حديد',
      chestPocketStyle: 'جيب مربع',
      chestPocketWidth: '13',
      chestPocketDrop: '7',
      bottomHemShape: 'جبزور مثلث',
      habroorLength: '12'
    };
    const selectedMeasurements = {
      ...DEFAULT_MEASUREMENTS,
      neckHeight: '4.5'
    };

    await window.electronAPI.createCustomer({
      id: 'CUST-NEW-FIELDS',
      name: 'عميل الاختبار',
      phone: '0555555555',
      measurements: selectedMeasurements,
      styleDetails: selectedStyleDetails
    });

    let data = await window.electronAPI.getData();
    const customer = data.customers.find((item) => item.id === 'CUST-NEW-FIELDS');
    expect(customer?.measurements.neckHeight).toBe('4.5');
    expect(customer?.styleDetails.neckType).toBe('قلاب');
    expect(customer?.styleDetails.neckShape).toBe('فرنسي');
    expect(customer?.styleDetails.chestPocketStyle).toBe('جيب مربع');
    expect(customer?.styleDetails.chestPocketWidth).toBe('13');
    expect(customer?.styleDetails.chestPocketDrop).toBe('7');
    expect(customer?.styleDetails.bottomHemShape).toBe('جبزور مثلث');
    expect(customer?.styleDetails.habroorLength).toBe('12');

    await window.electronAPI.createOrder({
      id: 'ORD-NEW-FIELDS',
      customerId: 'CUST-NEW-FIELDS',
      customerName: 'عميل الاختبار',
      customerPhone: '0555555555',
      garmentCount: 1,
      totalAmount: 250,
      paidAmount: 0,
      measurements: selectedMeasurements,
      styleDetails: selectedStyleDetails
    });

    data = await window.electronAPI.getData();
    const order = data.orders.find((item) => item.id === 'ORD-NEW-FIELDS');
    expect(order?.measurements.neckHeight).toBe('4.5');
    expect(order?.styleDetails.neckType).toBe('قلاب');
    expect(order?.styleDetails.neckShape).toBe('فرنسي');
    expect(order?.styleDetails.chestPocketStyle).toBe('جيب مربع');
    expect(order?.styleDetails.chestPocketWidth).toBe('13');
    expect(order?.styleDetails.chestPocketDrop).toBe('7');
    expect(order?.styleDetails.bottomHemShape).toBe('جبزور مثلث');
    expect(order?.styleDetails.habroorLength).toBe('12');
  });

  it('8. Backfills missing measurement fields without changing legacy values', async () => {
    localStorage.setItem('sahwa_tailoring_app_data_v1', JSON.stringify({
      customers: [{
        id: 'LEGACY-CUSTOMER',
        name: 'عميل قديم',
        phone: '0500000000',
        measurements: { frontLength: '150' },
        styleDetails: { buttonsType: 'سادة' },
        measurementHistory: [{
          id: 'LEGACY-HISTORY',
          savedAt: '2025-01-01',
          measurements: { frontLength: '151' },
          styleDetails: {}
        }]
      }],
      orders: [{
        id: 'LEGACY-ORDER',
        measurements: { shoulderWidth: '44' },
        styleDetails: {}
      }],
      invoices: [],
      fabrics: [],
      accessories: [],
      thobeTypes: [],
      colors: [],
      notifications: []
    }));

    const data = await window.electronAPI.getData();
    expect(data.customers[0].measurements.frontLength).toBe('150');
    expect(data.customers[0].measurements.shoulderWidth).toBe('');
    expect(data.customers[0].styleDetails.buttonsType).toBe('سادة');
    expect(data.customers[0].styleDetails.chestPocketDrop).toBe('');
    expect(data.customers[0].measurementHistory[0].measurements.frontLength).toBe('151');
    expect(data.orders[0].measurements.shoulderWidth).toBe('44');
    expect(data.orders[0].styleDetails.chestPocketDrop).toBe('');
  });
});
