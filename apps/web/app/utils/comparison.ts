import type { ComparisonItem } from "@G-stock/api/schemas/comparison";
import { isUuid } from "@G-stock/core/ids";

/** Sélection d'une comparaison dans l'URL : « s<uuid>,c<uuid> » = une simulation, une commande. */
const PREFIXES = { purchase_order: "c", simulation: "s" } as const;

export const encodeComparisonItems = (items: readonly ComparisonItem[]): string =>
  items.map((item) => `${PREFIXES[item.type]}${item.id}`).join(",");

export const decodeComparisonItems = (value: unknown): ComparisonItem[] => {
  if (typeof value !== "string" || !value) {
    return [];
  }
  return value.split(",").flatMap((token): ComparisonItem[] => {
    const id = token.slice(1);
    if (!isUuid(id)) {
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
