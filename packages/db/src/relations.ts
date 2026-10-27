import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

const businessRelations = defineRelations(schema, (r) => ({
  customers: {
    payments: r.many.payments({
      from: r.customers.id,
      to: r.payments.customerId,
    }),
    sales: r.many.sales({ from: r.customers.id, to: r.sales.customerId }),
  },
  payments: {
    customer: r.one.customers({
      from: r.payments.customerId,
      to: r.customers.id,
      optional: false,
    }),
    sale: r.one.sales({ from: r.payments.saleId, to: r.sales.id }),
  },
  products: {
    lots: r.many.stockLots({ from: r.products.id, to: r.stockLots.productId }),
    movements: r.many.stockMovements({
      from: r.products.id,
      to: r.stockMovements.productId,
    }),
  },
  purchaseOrderItems: {
    lots: r.many.stockLots({
      from: r.purchaseOrderItems.id,
      to: r.stockLots.orderItemId,
    }),
    order: r.one.purchaseOrders({
      from: r.purchaseOrderItems.orderId,
      to: r.purchaseOrders.id,
      optional: false,
    }),
    product: r.one.products({
      from: r.purchaseOrderItems.productId,
      to: r.products.id,
      optional: false,
    }),
  },
  purchaseOrderFees: {
    order: r.one.purchaseOrders({
      from: r.purchaseOrderFees.orderId,
      to: r.purchaseOrders.id,
      optional: false,
    }),
  },
  purchaseOrders: {
    fees: r.many.purchaseOrderFees({
      from: r.purchaseOrders.id,
      to: r.purchaseOrderFees.orderId,
    }),
    items: r.many.purchaseOrderItems({
      from: r.purchaseOrders.id,
      to: r.purchaseOrderItems.orderId,
    }),
    supplier: r.one.suppliers({
      from: r.purchaseOrders.supplierId,
      to: r.suppliers.id,
    }),
  },
  saleDiscounts: {
    sale: r.one.sales({
      from: r.saleDiscounts.saleId,
      to: r.sales.id,
      optional: false,
    }),
  },
  saleItemLots: {
    item: r.one.saleItems({
      from: r.saleItemLots.saleItemId,
      to: r.saleItems.id,
      optional: false,
    }),
    lot: r.one.stockLots({
      from: r.saleItemLots.lotId,
      to: r.stockLots.id,
      optional: false,
    }),
  },
  saleItems: {
    lots: r.many.saleItemLots({
      from: r.saleItems.id,
      to: r.saleItemLots.saleItemId,
    }),
    product: r.one.products({
      from: r.saleItems.productId,
      to: r.products.id,
      optional: false,
    }),
    sale: r.one.sales({
      from: r.saleItems.saleId,
      to: r.sales.id,
      optional: false,
    }),
  },
  sales: {
    customer: r.one.customers({
      from: r.sales.customerId,
      to: r.customers.id,
      optional: false,
    }),
    discounts: r.many.saleDiscounts({ from: r.sales.id, to: r.saleDiscounts.saleId }),
    items: r.many.saleItems({ from: r.sales.id, to: r.saleItems.saleId }),
    payments: r.many.payments({ from: r.sales.id, to: r.payments.saleId }),
  },
  stockLots: {
    movements: r.many.stockMovements({
      from: r.stockLots.id,
      to: r.stockMovements.lotId,
    }),
    orderItem: r.one.purchaseOrderItems({
      from: r.stockLots.orderItemId,
      to: r.purchaseOrderItems.id,
    }),
    product: r.one.products({
      from: r.stockLots.productId,
      to: r.products.id,
      optional: false,
    }),
  },
  stockMovements: {
    author: r.one.user({ from: r.stockMovements.createdBy, to: r.user.id }),
    lot: r.one.stockLots({
      from: r.stockMovements.lotId,
      to: r.stockLots.id,
      optional: false,
    }),
    product: r.one.products({
      from: r.stockMovements.productId,
      to: r.products.id,
      optional: false,
    }),
  },
  suppliers: {
    purchaseOrders: r.many.purchaseOrders({
      from: r.suppliers.id,
      to: r.purchaseOrders.supplierId,
    }),
  },
}));

export const relations = {
  ...businessRelations,
  ...schema.authRelations,
};
