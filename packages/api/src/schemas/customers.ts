import { z } from "zod";

import { idSchema, optionalText } from "./common";

export const customerInputSchema = z.object({
  address: optionalText(200),
  name: z.string().trim().min(1, "Le nom est obligatoire").max(120, "120 caractères maximum"),
  notes: optionalText(1000),
  phone: optionalText(40),
});
export type CustomerInput = z.input<typeof customerInputSchema>;

export const customerUpdateSchema = customerInputSchema.extend({
  id: idSchema,
});

export const customerListSchema = z.object({
  search: z.string().trim().nullish(),
  /** Seulement les clients qui doivent de l'argent. */
  withDebtOnly: z.boolean().default(false),
});
export type CustomerFilters = z.output<typeof customerListSchema>;
