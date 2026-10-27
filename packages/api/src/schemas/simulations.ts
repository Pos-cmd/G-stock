import { ALLOCATION_METHODS, PRICING_BASES, SALE_PRICING_MODES } from "@G-stock/core/enums";
import { MAX_MARGIN_RATE_PERCENT } from "@G-stock/core/simulation";
import { z } from "zod";

import { idSchema, optionalText } from "./common";
import { purchaseFeeSchema } from "./purchases";

const MAX_LINES = 200;
const MAX_FEES = 30;

export const salePricingSchema = z
  .object({
    mode: z.enum(SALE_PRICING_MODES),
    value: z.number().min(0, "La valeur ne peut pas être négative"),
  })
  .refine((pricing) => pricing.mode !== "margin" || pricing.value <= MAX_MARGIN_RATE_PERCENT, {
    message: `La marge sur prix de vente doit rester sous ${MAX_MARGIN_RATE_PERCENT + 1} %`,
    path: ["value"],
  });

export const simulationLineSchema = z.object({
  label: z.string().trim().min(1, "Indiquez le produit").max(120, "120 caractères maximum"),
  pricing: salePricingSchema,
  pricingBasis: z.enum(PRICING_BASES).default("unit"),
  /** Produit du catalogue ; sans produit, la ligne garde son libellé. */
  productId: idSchema.nullish(),
  qty: z.number().positive("La quantité doit être supérieure à zéro"),
  trips: z.number().positive("Au moins un voyage").default(1),
  unit: z.string().trim().min(1, "L'unité est obligatoire").max(30, "30 caractères maximum"),
  unitPriceRmb: z.number().min(0, "Le prix ne peut pas être négatif"),
  weightTons: z.number().positive("Le poids doit être supérieur à zéro").nullish(),
});

const exchangeRate = z.number().positive("Le taux doit être supérieur à zéro");

export const simulationDataFieldsSchema = z.object({
  fees: z.array(purchaseFeeSchema).max(MAX_FEES, `${MAX_FEES} frais maximum`),
  freightAllocation: z.enum(ALLOCATION_METHODS),
  freightCbm: z.number().min(0, "Le volume ne peut pas être négatif"),
  freightRatePerCbmFcfa: z
    .number()
    .int("Montant entier en FCFA")
    .min(0, "Le montant ne peut pas être négatif"),
  lines: z.array(simulationLineSchema).min(1, "Ajoutez au moins un produit").max(MAX_LINES),
  rates: z.object({ fcfaPerUsd: exchangeRate, rmbPerUsd: exchangeRate }),
});

interface WeightedSimulation {
  freightAllocation: string;
  fees: readonly { allocationMethod: string }[];
  lines: readonly { pricingBasis?: string; weightTons?: number | null }[];
}

/** Un prix à la tonne, comme un frais réparti au poids, exige le poids de chaque ligne. */
export const checkSimulationWeights = (data: WeightedSimulation, ctx: z.RefinementCtx): void => {
  const usesWeight =
    data.freightAllocation === "weight" ||
    data.fees.some((fee) => fee.allocationMethod === "weight");
  for (const [index, line] of data.lines.entries()) {
    if (line.weightTons) {
      continue;
    }
    if (line.pricingBasis === "weight" || usesWeight) {
      ctx.addIssue({
        code: "custom",
        message:
          line.pricingBasis === "weight"
            ? "Indiquez le poids pour un prix à la tonne"
            : "Poids requis pour répartir des frais au poids",
        path: ["lines", index, "weightTons"],
      });
    }
  }
};

export const simulationDataSchema = simulationDataFieldsSchema.superRefine(checkSimulationWeights);

export const simulationInputSchema = z.object({
  data: simulationDataSchema,
  name: z
    .string()
    .trim()
    .min(1, "Donnez un nom à la simulation")
    .max(120, "120 caractères maximum"),
  notes: optionalText(1000),
});
export type SimulationSaveInput = z.output<typeof simulationInputSchema>;

export const simulationUpdateSchema = simulationInputSchema.extend({ id: idSchema });
