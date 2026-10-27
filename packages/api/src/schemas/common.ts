import { z } from "zod";

/** Texte facultatif : une chaîne vide devient `null`. */
export const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `${maxLength} caractères maximum`)
    .nullish()
    .transform((value) => value || null);

export const idSchema = z.number().int().positive();

export const byIdSchema = z.object({ id: idSchema });
