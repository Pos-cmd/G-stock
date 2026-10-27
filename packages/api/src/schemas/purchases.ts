import { ALLOCATION_METHODS, PURCHASE_ORDER_STATUSES } from "@G-stock/core/enums";
import { z } from "zod";

import { idSchema, optionalText } from "./common";

const MAX_ITEMS = 200;

/** Statuts qu'on peut choisir à la main ; « reçue » et « annulée » passent par leurs actions. */
export const EDITABLE_PURCHASE_STATUSES = ["draft", "ordered", "in_transit"] as const;

const fcfaAmount = z
  .number()
  .int("Montant entier en FCFA")
  .min(0, "Le montant ne peut pas être négatif");

const exchangeRate = z.number().positive("Le taux doit être supérieur à zéro");

export const purchaseItemSchema = z.object({
  productId: idSchema,
  qty: z.number().positive("La quantité doit être supérieure à zéro"),
  trips: z.number().positive("Au moins un voyage"),
  unitPriceRmb: z.number().min(0, "Le prix ne peut pas être négatif"),
});
export type PurchaseItemInput = z.input<typeof purchaseItemSchema>;

export const purchaseOrderInputSchema = z.object({
  allocationMethod: z.enum(ALLOCATION_METHODS),
  fcfaPerUsd: exchangeRate,
  freightCbm: z.number().min(0, "Le volume ne peut pas être négatif"),
  freightRatePerCbmFcfa: fcfaAmount,
  items: z.array(purchaseItemSchema).min(1, "Ajoutez au moins un produit").max(MAX_ITEMS),
  localTransportFcfa: fcfaAmount,
  notes: optionalText(1000),
  orderDate: z.date(),
  otherFeesFcfa: fcfaAmount,
  rmbPerUsd: exchangeRate,
  supplierId: idSchema.nullish(),
});
export type PurchaseOrderInput = z.output<typeof purchaseOrderInputSchema>;

export const purchaseOrderUpdateSchema = purchaseOrderInputSchema.extend({ id: idSchema });

export const purchaseOrderListSchema = z.object({
  search: z.string().trim().nullish(),
  status: z.enum(PURCHASE_ORDER_STATUSES).nullish(),
  supplierId: idSchema.nullish(),
});
export type PurchaseOrderFilters = z.output<typeof purchaseOrderListSchema>;

export const purchaseStatusSchema = z.object({
  id: idSchema,
  status: z.enum(EDITABLE_PURCHASE_STATUSES),
});

export const purchaseReceiveSchema = z.object({
  id: idSchema,
  receivedAt: z.date(),
});
