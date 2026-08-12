import { Order, Customer, FabricItem, AccessoryItem, ThobeType, ColorItem, NotificationItem } from '../types';

export interface DatabaseSettings {
  fabricConsumptionRatePerGarment: number; // default 3.5 meters
  autoBackupIntervalHours: number; // default 1 hour
  maxBackupFiles: number; // default 14
  lastBackupTimestamp?: string;
  schemaVersion: number; // current: 1
}

export const CURRENT_SCHEMA_VERSION = 1;

export const CREATE_TABLES_SQL = `
-- Enable PRAGMA FKs and WAL
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- System Settings
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  measurements_json TEXT,
  style_details_json TEXT
);

-- Customer Measurement History
CREATE TABLE IF NOT EXISTS customer_measurement_history (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  note TEXT,
  measurements_json TEXT NOT NULL,
  style_details_json TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Fabrics
CREATE TABLE IF NOT EXISTS fabrics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  color_hex TEXT,
  purchase_price REAL NOT NULL DEFAULT 0,
  selling_price REAL NOT NULL DEFAULT 0,
  quantity_meters REAL NOT NULL DEFAULT 0,
  min_stock_meters REAL NOT NULL DEFAULT 10,
  created_at TEXT NOT NULL
);

-- Accessories
CREATE TABLE IF NOT EXISTS accessories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  min_stock REAL NOT NULL DEFAULT 5,
  unit TEXT NOT NULL DEFAULT 'حبة',
  created_at TEXT NOT NULL
);

-- Thobe/Dress Types
CREATE TABLE IF NOT EXISTS dress_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  default_price REAL NOT NULL DEFAULT 0,
  description TEXT
);

-- Colors
CREATE TABLE IF NOT EXISTS colors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hex TEXT NOT NULL
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  thobe_type_id TEXT,
  thobe_type_name TEXT NOT NULL,
  fabric_id TEXT,
  fabric_name TEXT NOT NULL,
  fabric_color TEXT NOT NULL,
  fabric_consumption_meters REAL NOT NULL DEFAULT 3.5,
  fabric_buy_price_at_order REAL NOT NULL DEFAULT 0,
  garment_count INTEGER NOT NULL DEFAULT 1,
  order_date TEXT NOT NULL,
  delivery_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  total_amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  remaining_amount REAL NOT NULL DEFAULT 0,
  is_custom_measurement INTEGER NOT NULL DEFAULT 0,
  measurements_json TEXT NOT NULL,
  style_details_json TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (fabric_id) REFERENCES fabrics(id),
  FOREIGN KEY (thobe_type_id) REFERENCES dress_types(id)
);

-- Invoices & Payments
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  order_date TEXT NOT NULL,
  total_amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  remaining_amount REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  payments_json TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  date TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  customer_phone TEXT
);

-- Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_history_customer ON customer_measurement_history(customer_id);
`;
