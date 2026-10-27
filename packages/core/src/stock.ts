import type { StockStatus } from "./enums";

/** Tolérance pour les quantités décimales (kg, mètres…) stockées en REAL. */
export const QTY_EPSILON = 1e-9;

const QTY_DECIMALS_FACTOR = 1000;

/** Arrondit au millième pour neutraliser les erreurs de virgule flottante. */
export const roundQty = (qty: number): number =>
  Math.round(qty * QTY_DECIMALS_FACTOR) / QTY_DECIMALS_FACTOR;

export const getStockStatus = (qty: number, alertThreshold: number): StockStatus => {
  if (qty <= QTY_EPSILON) {
    return "out";
  }
  if (qty <= alertThreshold) {
    return "low";
  }
  return "ok";
};

/** Coût moyen pondéré par les quantités restantes, arrondi au FCFA. */
export const weightedAverageCost = (
  lots: readonly { qtyRemaining: number; unitCostFcfa: number }[],
): number => {
  let totalQty = 0;
  let totalValue = 0;
  for (const lot of lots) {
    totalQty += lot.qtyRemaining;
    totalValue += lot.qtyRemaining * lot.unitCostFcfa;
  }
  return totalQty > QTY_EPSILON ? Math.round(totalValue / totalQty) : 0;
};
