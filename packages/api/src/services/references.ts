import type { Executor } from "@G-stock/db";
import { referenceSequences } from "@G-stock/db/schema/settings";
import { sql } from "drizzle-orm";

/**
 * Prochain numéro lisible d'une série (ex. « CF-2026-0004 »). Le compteur est stocké et ne
 * recule jamais : un numéro attribué puis supprimé n'est pas réutilisé (ni ses documents).
 * À appeler dans la transaction qui crée l'enregistrement.
 */
export const nextReference = async (
  executor: Executor,
  prefix: string,
  date: Date,
  digits: number,
): Promise<string> => {
  const series = `${prefix}-${date.getFullYear()}`;
  const [row] = await executor
    .insert(referenceSequences)
    .values({ lastNumber: 1, series })
    .onConflictDoUpdate({
      set: {
        lastNumber: sql`${referenceSequences.lastNumber} + 1`,
        updatedAt: new Date(),
      },
      target: referenceSequences.series,
    })
    .returning({ lastNumber: referenceSequences.lastNumber });
  if (!row) {
    throw new Error(`Impossible d'attribuer un numéro dans la série ${series}`);
  }
  return `${series}-${String(row.lastNumber).padStart(digits, "0")}`;
};
