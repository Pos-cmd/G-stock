import { z } from "zod";

const positiveRate = z.number().positive("Le taux doit être supérieur à zéro");
const days = z.number().int().min(1, "Au moins 1 jour");

export const appSettingsSchema = z
  .object({
    /** Coordonnées imprimées en tête des documents (reçus, fiches). */
    companyAddress: z.string().trim().max(200, "200 caractères maximum"),
    companyName: z.string().trim().max(120, "120 caractères maximum"),
    companyPhone: z.string().trim().max(60, "60 caractères maximum"),
    /** Dossier local où sont rangés les PDF générés. */
    documentsFolder: z
      .string()
      .trim()
      .min(1, "Indiquez un dossier")
      .max(500, "500 caractères maximum"),
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
