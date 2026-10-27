/** Sens d'un indicateur : un coût est meilleur bas, une marge est meilleure haute. */
export type Preference = "lower" | "higher";

export interface ComparedValue {
  value: number | null;
  /** Écart relatif à la référence (première valeur) : 0,1 = +10 %. */
  deltaRatio: number | null;
  isBest: boolean;
  isWorst: boolean;
}

/**
 * Compare une série de valeurs à la première (la référence) et repère la meilleure et la
 * moins bonne. Les valeurs absentes sont ignorées ; sans écart, personne n'est mis en avant.
 */
export const compareValues = (
  values: readonly (number | null | undefined)[],
  preference: Preference,
): ComparedValue[] => {
  const present = values.filter((value): value is number => typeof value === "number");
  const min = present.length > 0 ? Math.min(...present) : null;
  const max = present.length > 0 ? Math.max(...present) : null;
  const distinct = present.length >= 2 && min !== max;
  const best = preference === "lower" ? min : max;
  const worst = preference === "lower" ? max : min;
  const [reference] = values;

  return values.map((raw, index) => {
    const value = typeof raw === "number" ? raw : null;
    const comparable =
      index > 0 && value !== null && typeof reference === "number" && reference !== 0;
    return {
      deltaRatio: comparable ? (value - reference) / Math.abs(reference) : null,
      isBest: distinct && value === best,
      isWorst: distinct && value === worst,
      value,
    };
  });
};

const DIACRITICS = /\p{Mn}/gu;
const SPACES = /\s+/gu;

/** Libellé normalisé : sans accents, casse ni espaces superflus. */
export const normalizeLabel = (label: string): string =>
  label.normalize("NFD").replaceAll(DIACRITICS, "").replaceAll(SPACES, " ").trim().toLowerCase();

/**
 * Clé de rapprochement d'une ligne entre simulations et commandes : le produit du catalogue
 * s'il est connu, sinon le libellé normalisé.
 */
export const comparisonKey = (line: { productId?: number | null; label: string }): string =>
  line.productId ? `produit-${line.productId}` : `libelle-${normalizeLabel(line.label)}`;
