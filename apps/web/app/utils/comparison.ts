import type { ComparisonItem } from "@G-stock/api/schemas/comparison";

/** Sélection d'une comparaison dans l'URL : « s12,c3 » = simulation 12, commande 3. */
const PREFIXES = { purchase_order: "c", simulation: "s" } as const;

export const encodeComparisonItems = (items: readonly ComparisonItem[]): string =>
  items.map((item) => `${PREFIXES[item.type]}${item.id}`).join(",");

export const decodeComparisonItems = (value: unknown): ComparisonItem[] => {
  if (typeof value !== "string" || !value) {
    return [];
  }
  return value.split(",").flatMap((token): ComparisonItem[] => {
    const id = Number(token.slice(1));
    if (!Number.isInteger(id) || id <= 0) {
      return [];
    }
    if (token.startsWith(PREFIXES.simulation)) {
      return [{ id, type: "simulation" }];
    }
    if (token.startsWith(PREFIXES.purchase_order)) {
      return [{ id, type: "purchase_order" }];
    }
    return [];
  });
};

export const comparisonLink = (items: readonly ComparisonItem[]) => ({
  path: "/simulateur/comparer",
  query: items.length > 0 ? { elements: encodeComparisonItems(items) } : {},
});
