import { z } from "zod";

const positiveRate = z.number().positive("Le taux doit être supérieur à zéro");
const days = z.number().int().min(1, "Au moins 1 jour");

export const appSettingsSchema = z
  .object({
    fcfaPerUsd: positiveRate,
    receivableAlertDays: days,
    receivableCriticalDays: days,
    receivableWarningDays: days,
    rmbPerUsd: positiveRate,
  })
  .refine(
    (value) =>
      value.receivableWarningDays < value.receivableAlertDays &&
      value.receivableAlertDays < value.receivableCriticalDays,
    {
      message: "Les seuils d'ancienneté doivent être croissants",
      path: ["receivableCriticalDays"],
    },
  );
export type AppSettings = z.output<typeof appSettingsSchema>;
