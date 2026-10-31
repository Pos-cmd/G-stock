import {
  PAYMENT_METHODS,
  PAYMENT_TYPES,
  RETURN_REFUND_METHODS,
  SALE_STATUSES,
} from "@G-stock/core/enums";
import { z } from "zod";

import { idSchema, optionalText, reasonSchema, sortSchema } from "./common";

const MAX_LINES = 100;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

const fcfaAmount = z.number().int("Montant entier en FCFA");

export const saleLineSchema = z.object({
  productId: idSchema,
  qty: z.number().positive("La quantité doit être supérieure à zéro"),
  unitPriceFcfa: fcfaAmount.min(0, "Le prix ne peut pas être négatif"),
});
export type SaleLineInput = z.input<typeof saleLineSchema>;

export const saleInputSchema = z.object({
  customerId: idSchema,
  lines: z
    .array(saleLineSchema)
    .min(1, "Ajoutez au moins un produit")
    .max(MAX_LINES),
  notes: optionalText(1000),
  /** Montant encaissé à la vente : ignoré au comptant (le total est encaissé). */
  paidFcfa: fcfaAmount.min(0, "Le montant ne peut pas être négatif").default(0),
  paymentMethod: z.enum(PAYMENT_METHODS).default("cash"),
  paymentType: z.enum(PAYMENT_TYPES),
  saleDate: z.date(),
});
export type SaleInput = z.output<typeof saleInputSchema>;

/** Modification d'une vente enregistrée : les lignes absentes sont retirées, motif obligatoire. */
export const saleUpdateSchema = z.object({
  id: idSchema,
  items: z
    .array(
      saleLineSchema.extend({
        /** Ligne existante à modifier ; absente pour une ligne ajoutée. */
        id: idSchema.nullish(),
      })
    )
    .min(1, "Une vente doit garder au moins un produit")
    .max(MAX_LINES),
  notes: optionalText(1000),
  reason: reasonSchema,
  saleDate: z.date(),
});
export type SaleUpdateInput = z.output<typeof saleUpdateSchema>;

/** Reprise d'articles : ce qui revient, ce qui repart en stock et l'argent rendu. */
export const saleReturnSchema = z.object({
  items: z
    .array(
      z.object({
        qty: z.number().positive("La quantité doit être supérieure à zéro"),
        /** Remise en stock ; sinon la marchandise est perdue (casse, invendable). */
        restocked: z.boolean().default(true),
        saleItemId: idSchema,
      })
    )
    .min(1, "Choisissez au moins un article repris")
    .max(MAX_LINES),
  reason: reasonSchema,
  refundMethod: z.enum(RETURN_REFUND_METHODS).default("credit"),
  returnDate: z.date(),
  saleId: idSchema,
});
export type SaleReturnInput = z.output<typeof saleReturnSchema>;

/** Aperçu du coût FIFO et du stock disponible, sans rien écrire. */
export const saleQuoteSchema = z.object({
  lines: z
    .array(z.object({ productId: idSchema, qty: z.number().min(0) }))
    .max(MAX_LINES),
});

export const PAYMENT_STATES = ["paid", "due"] as const;

/** Colonnes de tri de l'historique des ventes. */
export const SALE_SORT_COLUMNS = [
  "saleDate",
  "reference",
  "customerName",
  "netFcfa",
] as const;

export const saleListSchema = z.object({
  customerId: idSchema.nullish(),
  from: z.date().nullish(),
  page: z.number().int().min(1).default(1),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  paymentState: z.enum(PAYMENT_STATES).nullish(),
  productId: idSchema.nullish(),
  search: z.string().trim().nullish(),
  sort: sortSchema(SALE_SORT_COLUMNS),
  status: z.enum(SALE_STATUSES).nullish(),
  to: z.date().nullish(),
});
export type SaleFilters = z.output<typeof saleListSchema>;

export const productSalesSummarySchema = z.object({
  customerId: idSchema.nullish(),
  from: z.date().nullish(),
  to: z.date().nullish(),
});
export type ProductSalesFilters = z.output<typeof productSalesSummarySchema>;

export const saleCancelSchema = z.object({
  id: idSchema,
  reason: reasonSchema,
});

export const saleDiscountSchema = z.object({
  amountFcfa: fcfaAmount.positive("La remise doit être supérieure à zéro"),
  discountDate: z.date(),
  reason: reasonSchema,
  saleId: idSchema,
});
export type SaleDiscountInput = z.output<typeof saleDiscountSchema>;

export const paymentInputSchema = z.object({
  amountFcfa: fcfaAmount.positive("Le montant doit être supérieur à zéro"),
  customerId: idSchema,
  method: z.enum(PAYMENT_METHODS),
  notes: optionalText(500),
  paymentDate: z.date(),
  /** Vente réglée en priorité ; sinon le paiement solde les ventes les plus anciennes. */
  saleId: idSchema.nullish(),
});
export type PaymentInput = z.output<typeof paymentInputSchema>;

/** Correction d'un paiement déjà saisi : mêmes champs, mais rien n'est recréé. */
export const paymentUpdateSchema = paymentInputSchema
  .omit({ customerId: true })
  .extend({
    id: idSchema,
  });
export type PaymentUpdateInput = z.output<typeof paymentUpdateSchema>;

/** Relevé des paiements : fenêtre en mois, 12 par défaut (le calendrier en couvre 12). */
export const paymentLedgerSchema = z.object({
  customerId: idSchema,
  months: z.number().int().min(1).max(24).default(12),
});
export type PaymentLedgerInput = z.output<typeof paymentLedgerSchema>;

export const paymentCancelSchema = z.object({
  id: idSchema,
  reason: reasonSchema,
});
