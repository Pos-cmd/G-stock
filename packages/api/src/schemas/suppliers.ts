import { z } from "zod";

import { idSchema, optionalText } from "./common";

export const supplierInputSchema = z.object({
  contact: optionalText(120),
  country: z.string().trim().min(1, "Le pays est obligatoire").max(60, "60 caractères maximum"),
  name: z.string().trim().min(1, "Le nom est obligatoire").max(120, "120 caractères maximum"),
  notes: optionalText(1000),
  phone: optionalText(40),
});
export type SupplierInput = z.input<typeof supplierInputSchema>;

export const supplierUpdateSchema = supplierInputSchema.extend({ id: idSchema });
