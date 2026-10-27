import { STOCK_STATUSES } from "@G-stock/core/enums";
import { z } from "zod";

import { idSchema, optionalText } from "./common";

export const productInputSchema = z.object({
  alertThreshold: z.number().min(0, "Le seuil ne peut pas être négatif"),
  category: optionalText(60),
  name: z.string().trim().min(1, "Le nom est obligatoire").max(120, "120 caractères maximum"),
  notes: optionalText(1000),
  reference: optionalText(60),
  referencePriceRmb: z.number().min(0, "Le prix ne peut pas être négatif").nullish(),
  suggestedSalePriceFcfa: z
    .number()
    .int("Montant entier en FCFA")
    .min(0, "Le prix ne peut pas être négatif")
    .nullish(),
  unit: z.string().trim().min(1, "L'unité est obligatoire").max(30, "30 caractères maximum"),
});
export type ProductInput = z.input<typeof productInputSchema>;

export const productUpdateSchema = productInputSchema.extend({ id: idSchema });

export const productListSchema = z.object({
  category: z.string().nullish(),
  includeArchived: z.boolean().default(false),
  search: z.string().trim().nullish(),
  status: z.enum(STOCK_STATUSES).nullish(),
});
export type ProductListInput = z.input<typeof productListSchema>;
