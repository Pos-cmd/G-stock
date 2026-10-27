import { MOVEMENT_TYPES } from "@G-stock/core/enums";
import { z } from "zod";

import { idSchema, optionalText } from "./common";

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

export const lotListSchema = z.object({
  includeEmpty: z.boolean().default(true),
  productId: idSchema,
});

export const movementListSchema = z.object({
  from: z.date().nullish(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  productId: idSchema.nullish(),
  to: z.date().nullish(),
  type: z.enum(MOVEMENT_TYPES).nullish(),
});
export type MovementListInput = z.input<typeof movementListSchema>;
export type MovementFilters = z.output<typeof movementListSchema>;
