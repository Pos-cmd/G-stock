import { PAYMENT_METHODS, PAYMENT_TYPES, SALE_STATUSES } from "@G-stock/core/enums";
import { z } from "zod";

import { idSchema, optionalText, reasonSchema } from "./common";

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
  lines: z.array(saleLineSchema).min(1, "Ajoutez au moins un produit").max(MAX_LINES),
  notes: optionalText(1000),
  /** Montant encaissé à la vente : ignoré au comptant (le total est encaissé). */
  paidFcfa: fcfaAmount.min(0, "Le montant ne peut pas être négatif").default(0),
  paymentMethod: z.enum(PAYMENT_METHODS).default("cash"),
  paymentType: z.enum(PAYMENT_TYPES),
  saleDate: z.date(),
});
export type SaleInput = z.output<typeof saleInputSchema>;

/** Aperçu du coût FIFO et du stock disponible, sans rien écrire. */
export const saleQuoteSchema = z.object({
  lines: z.array(z.object({ productId: idSchema, qty: z.number().min(0) })).max(MAX_LINES),
});

export const PAYMENT_STATES = ["paid", "due"] as const;

export const saleListSchema = z.object({
  customerId: idSchema.nullish(),
  from: z.date().nullish(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  paymentState: z.enum(PAYMENT_STATES).nullish(),
  productId: idSchema.nullish(),
  search: z.string().trim().nullish(),
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

export const paymentCancelSchema = z.object({
  id: idSchema,
  reason: reasonSchema,
});
