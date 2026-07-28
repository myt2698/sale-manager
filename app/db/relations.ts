import { relations } from "drizzle-orm";
import {
  users,
  customers,
  customerDocuments,
  sampleOrders,
  salesOrders,
  orderChecklists,
  productionConfirmations,
  logisticsTracking,
  returnReceipts,
  statements,
  invoices,
  paymentRecords,
} from "./schema";

export const customersRelations = relations(customers, ({ many, one }) => ({
  documents: many(customerDocuments),
  sampleOrders: many(sampleOrders),
  salesOrders: many(salesOrders),
  assignedUser: one(users, {
    fields: [customers.assignedTo],
    references: [users.id],
  }),
}));

export const customerDocumentsRelations = relations(customerDocuments, ({ one }) => ({
  customer: one(customers, {
    fields: [customerDocuments.customerId],
    references: [customers.id],
  }),
}));

export const sampleOrdersRelations = relations(sampleOrders, ({ one }) => ({
  customer: one(customers, {
    fields: [sampleOrders.customerId],
    references: [customers.id],
  }),
}));

export const salesOrdersRelations = relations(salesOrders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [salesOrders.customerId],
    references: [customers.id],
  }),
  checklist: one(orderChecklists),
  productionConfirmations: many(productionConfirmations),
  logisticsTracking: one(logisticsTracking),
  returnReceipt: one(returnReceipts),
  statements: many(statements),
  invoices: many(invoices),
  payments: many(paymentRecords),
}));

export const orderChecklistsRelations = relations(orderChecklists, ({ one }) => ({
  order: one(salesOrders, {
    fields: [orderChecklists.orderId],
    references: [salesOrders.id],
  }),
}));

export const productionConfirmationsRelations = relations(productionConfirmations, ({ one }) => ({
  order: one(salesOrders, {
    fields: [productionConfirmations.orderId],
    references: [salesOrders.id],
  }),
}));

export const logisticsTrackingRelations = relations(logisticsTracking, ({ one }) => ({
  order: one(salesOrders, {
    fields: [logisticsTracking.orderId],
    references: [salesOrders.id],
  }),
}));

export const returnReceiptsRelations = relations(returnReceipts, ({ one }) => ({
  order: one(salesOrders, {
    fields: [returnReceipts.orderId],
    references: [salesOrders.id],
  }),
}));

export const statementsRelations = relations(statements, ({ one, many }) => ({
  order: one(salesOrders, {
    fields: [statements.orderId],
    references: [salesOrders.id],
  }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  order: one(salesOrders, {
    fields: [invoices.orderId],
    references: [salesOrders.id],
  }),
  statement: one(statements, {
    fields: [invoices.statementId],
    references: [statements.id],
  }),
  payments: many(paymentRecords),
}));

export const paymentRecordsRelations = relations(paymentRecords, ({ one }) => ({
  order: one(salesOrders, {
    fields: [paymentRecords.orderId],
    references: [salesOrders.id],
  }),
  invoice: one(invoices, {
    fields: [paymentRecords.invoiceId],
    references: [invoices.id],
  }),
}));
