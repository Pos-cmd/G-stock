import {
  ALLOCATION_METHODS,
  FEE_CURRENCIES,
  PRICING_BASES,
  PURCHASE_CURRENCIES,
  PURCHASE_ORDER_STATUSES,
} from "@G-stock/core/enums";
import type { AllocationMethod, PricingBasis } from "@G-stock/core/enums";
import { z } from "zod";

import { idSchema, optionalText, reasonSchema } from "./common";

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
  /** Dans la devise de la commande. */
  unitPrice: z.number().min(0, "Le prix ne peut pas être négatif"),
  pricingBasis: z.enum(PRICING_BASES).default("unit"),
  weightTons: z.number().positive("Le poids doit être supérieur à zéro").nullish(),
});
export type PurchaseItemInput = z.input<typeof purchaseItemSchema>;

/** Champs d'une commande, sans les règles qui croisent plusieurs champs (voir `checkWeights`). */
export const purchaseOrderFieldsSchema = z.object({
  allocationMethod: z.enum(ALLOCATION_METHODS),
  currency: z.enum(PURCHASE_CURRENCIES),
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

interface WeightedOrder {
  allocationMethod: AllocationMethod;
  items: readonly { pricingBasis?: PricingBasis; weightTons?: number | null }[];
}

/** Un prix à la tonne, comme une répartition au poids, exige le poids de la ligne. */
export const checkWeights = (order: WeightedOrder, ctx: z.RefinementCtx): void => {
  for (const [index, item] of order.items.entries()) {
    if (item.weightTons) {
      continue;
    }
    if (item.pricingBasis === "weight") {
      ctx.addIssue({
        code: "custom",
        message: "Indiquez le poids pour un prix à la tonne",
        path: ["items", index, "weightTons"],
      });
    } else if (order.allocationMethod === "weight") {
      ctx.addIssue({
        code: "custom",
        message: "Poids requis pour répartir les frais au poids",
        path: ["items", index, "weightTons"],
      });
    }
  }
};

export const purchaseOrderInputSchema = purchaseOrderFieldsSchema.superRefine(checkWeights);
export type PurchaseOrderInput = z.output<typeof purchaseOrderInputSchema>;

export const purchaseOrderUpdateSchema = purchaseOrderFieldsSchema
  .extend({ id: idSchema })
  .superRefine(checkWeights);

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

export const purchaseFeeSchema = z.object({
  allocationMethod: z.enum(ALLOCATION_METHODS),
  amount: z.number().min(0, "Le montant ne peut pas être négatif"),
  currency: z.enum(FEE_CURRENCIES),
  label: z.string().trim().min(1, "Indiquez le libellé du frais").max(80, "80 caractères maximum"),
});
export type PurchaseFeeInput = z.input<typeof purchaseFeeSchema>;

const MAX_FEES = 30;

/** Saisie de la réception : arrivée, frais réels et quantités reçues. */
export const purchaseReceptionSchema = z.object({
  arrivedAt: z.date().nullish(),
  billOfLading: optionalText(60),
  containerNumber: optionalText(40),
  fees: z.array(purchaseFeeSchema).max(MAX_FEES, `${MAX_FEES} frais maximum`),
  forwarder: optionalText(120),
  id: idSchema,
  items: z
    .array(
      z.object({
        id: idSchema,
        qtyReceived: z.number().min(0, "La quantité ne peut pas être négative"),
      }),
    )
    .min(1),
});
export type PurchaseReceptionInput = z.output<typeof purchaseReceptionSchema>;

/** Validation de la réception : la saisie, plus la date d'entrée en stock. */
export const purchaseReceiveSchema = purchaseReceptionSchema.extend({ receivedAt: z.date() });
export type PurchaseReceiveInput = z.output<typeof purchaseReceiveSchema>;

export const supplierPaymentInputSchema = z.object({
  amountFcfa: fcfaAmount.positive("Le montant doit être supérieur à zéro"),
  /** FCFA pour 1 unité de la devise de la commande, obtenu ce jour-là ; vide = taux de la commande. */
  fcfaRate: exchangeRate.nullish(),
  notes: optionalText(500),
  orderId: idSchema,
  paymentDate: z.date(),
});
export type SupplierPaymentInput = z.output<typeof supplierPaymentInputSchema>;

export const supplierPaymentCancelSchema = z.object({
  id: idSchema,
  reason: reasonSchema,
});
