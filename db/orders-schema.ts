/** Estrutura das tabelas usada pelo Drizzle para gerar as migrações SQL. Alterar este arquivo não aplica uma mudança ao banco por si só. */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  number: integer('number').notNull(),
  createdAt: integer('created_at').notNull(),
  customer: text('customer').notNull(),
  phone: text('phone').notNull(),
  address: text('address').notNull(),
  items: text('items').notNull(),
  subtotal: integer('subtotal').notNull(),
  discount: integer('discount').notNull(),
  delivery: integer('delivery').notNull(),
  total: integer('total').notNull(),
  coupon: text('coupon'),
  payment: text('payment').notNull(),
  changeFor: integer('change_for'),
  paymentStatus: text('payment_status').notNull().default('pending'),
  status: text('status').notNull().default('received'),
  notes: text('notes').notNull().default(''),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  requestHash: text('request_hash').notNull(),
  receiptHash: text('receipt_hash').notNull(),
  serviceType: text('service_type').notNull().default('delivery'),
  tableNumber: integer('table_number'),
});
export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  expiresAt: integer('expires_at').notNull(),
});
export const loginAttempts = sqliteTable('login_attempts', {
  id: text('id').primaryKey(),
  ipHash: text('ip_hash').notNull(),
  createdAt: integer('created_at').notNull(),
});
export const coupons = sqliteTable('coupons', {
  code: text('code').primaryKey(),
  kind: text('kind').notNull(),
  value: integer('value').notNull(),
  active: integer('active').notNull().default(1),
});
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
export const audit = sqliteTable('audit', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull(),
  action: text('action').notNull(),
  createdAt: integer('created_at').notNull(),
});
