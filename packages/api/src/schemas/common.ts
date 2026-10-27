import { z } from "zod";

/** Texte facultatif : une chaîne vide devient `null`. */
export const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `${maxLength} caractères maximum`)
    .nullish()
    .transform((value) => value || null);

/** Identifiant UUID d'un enregistrement. */
export const idSchema = z.uuid("Identifiant invalide");

export const byIdSchema = z.object({ id: idSchema });
