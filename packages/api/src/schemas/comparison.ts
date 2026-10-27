import { z } from "zod";

import { idSchema } from "./common";

export const MAX_COMPARED_ITEMS = 4;

export const comparisonItemSchema = z.object({
  id: idSchema,
  type: z.enum(["simulation", "purchase_order"]),
});
export type ComparisonItem = z.output<typeof comparisonItemSchema>;

export const comparisonSchema = z.object({
  items: z
    .array(comparisonItemSchema)
    .min(1, "Choisissez au moins un élément")
    .max(MAX_COMPARED_ITEMS, `${MAX_COMPARED_ITEMS} éléments au maximum`),
});
