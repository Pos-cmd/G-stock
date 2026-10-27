import { protectedProcedure } from "../index";
import { byIdSchema } from "../schemas/common";
import {
  purchaseOrderInputSchema,
  purchaseOrderListSchema,
  purchaseOrderUpdateSchema,
  purchaseReceiveSchema,
  purchaseStatusSchema,
} from "../schemas/purchases";
import {
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  receivePurchaseOrder,
  removePurchaseOrder,
  setPurchaseStatus,
  updatePurchaseOrder,
} from "../services/purchases";

export const purchasesRouter = {
  cancel: protectedProcedure
    .input(byIdSchema)
    .handler(({ context, input }) => setPurchaseStatus(context.db, input.id, "cancelled")),

  create: protectedProcedure
    .input(purchaseOrderInputSchema)
    .handler(({ context, input }) =>
      context.db.transaction((tx) => createPurchaseOrder(tx, input)),
    ),

  get: protectedProcedure
    .input(byIdSchema)
    .handler(({ context, input }) => getPurchaseOrder(context.db, input.id)),

  list: protectedProcedure
    .input(purchaseOrderListSchema)
    .handler(({ context, input }) => listPurchaseOrders(context.db, input)),

  receive: protectedProcedure
    .input(purchaseReceiveSchema)
    .handler(({ context, input }) =>
      context.db.transaction((tx) =>
        receivePurchaseOrder(tx, { ...input, userId: context.session.user.id }),
      ),
    ),

  remove: protectedProcedure
    .input(byIdSchema)
    .handler(({ context, input }) => removePurchaseOrder(context.db, input.id)),

  setStatus: protectedProcedure
    .input(purchaseStatusSchema)
    .handler(({ context, input }) => setPurchaseStatus(context.db, input.id, input.status)),

  update: protectedProcedure
    .input(purchaseOrderUpdateSchema)
    .handler(({ context, input: { id, ...data } }) =>
      context.db.transaction((tx) => updatePurchaseOrder(tx, id, data)),
    ),
};
