import { z } from "zod";

import { idSchema } from "./common";

/** Documents que l'application sait produire. */
export const GENERATED_DOCUMENT_TYPES = [
  "simulation",
  "receipt",
  "receipt_mobile",
  "cost_sheet",
] as const;
export type GeneratedDocumentType = (typeof GENERATED_DOCUMENT_TYPES)[number];

export const documentGenerateSchema = z.object({
  referenceId: idSchema,
  type: z.enum(GENERATED_DOCUMENT_TYPES),
});

export const documentListSchema = z.object({
  search: z.string().trim().nullish(),
  type: z.enum(GENERATED_DOCUMENT_TYPES).nullish(),
});
export type DocumentFilters = z.output<typeof documentListSchema>;
