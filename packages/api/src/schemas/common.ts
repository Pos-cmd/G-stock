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

/** Tri d'une liste paginée par le serveur : colonne (parmi `columns`) et sens. */
export const sortSchema = <T extends readonly [string, ...string[]]>(columns: T) =>
  z.object({ desc: z.boolean(), id: z.enum(columns) }).nullish();

/** Motif obligatoire d'une annulation ou d'une remise. */
export const reasonSchema = z
  .string()
  .trim()
  .min(3, "Indiquez le motif (3 caractères minimum)")
  .max(500, "500 caractères maximum");
