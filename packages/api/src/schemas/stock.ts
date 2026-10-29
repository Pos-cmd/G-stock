import { MOVEMENT_TYPES } from "@G-stock/core/enums";
import { z } from "zod";

import { idSchema, optionalText, sortSchema } from "./common";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

export const lotEntrySchema = z.object({
  notes: optionalText(500),
  productId: idSchema,
  qty: z.number().positive("La quantité doit être supérieure à zéro"),
  receivedAt: z.date(),
  unitCostFcfa: z.number().int("Montant entier en FCFA").min(0, "Le coût ne peut pas être négatif"),
});
export type LotEntryInput = z.input<typeof lotEntrySchema>;

export const lotAdjustSchema = z.object({
  lotId: idSchema,
  newQty: z.number().min(0, "La quantité ne peut pas être négative"),
  reason: z.string().trim().min(3, "Indiquez le motif de l'ajustement").max(500),
});
export type LotAdjustInput = z.input<typeof lotAdjustSchema>;

/** Ouvrir des cartons : leurs pièces passent dans le produit « pièce ». */
export const unpackSchema = z.object({
  productId: idSchema,
  qty: z.number().int("Nombre entier de cartons").positive("Au moins un carton"),
});
export type UnpackInput = z.output<typeof unpackSchema>;

export const lotListSchema = z.object({
  includeEmpty: z.boolean().default(true),
  productId: idSchema,
});

/** Colonnes de tri de l'historique des mouvements. */
export const MOVEMENT_SORT_COLUMNS = ["createdAt", "productName", "qty", "unitCostFcfa"] as const;

export const movementListSchema = z.object({
  from: z.date().nullish(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  productId: idSchema.nullish(),
  /** Produit, code de lot ou motif. */
  search: z.string().trim().nullish(),
  sort: sortSchema(MOVEMENT_SORT_COLUMNS),
  to: z.date().nullish(),
  type: z.enum(MOVEMENT_TYPES).nullish(),
});
export type MovementListInput = z.input<typeof movementListSchema>;
export type MovementFilters = z.output<typeof movementListSchema>;
