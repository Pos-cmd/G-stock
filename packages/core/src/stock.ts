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

export interface FifoLot {
  id: number;
  qtyRemaining: number;
  unitCostFcfa: number;
}

export interface FifoAllocation {
  lotId: number;
  qty: number;
  unitCostFcfa: number;
  /** Quantité restante dans le lot après le prélèvement. */
  qtyLeft: number;
}

/**
 * Plan de sortie FIFO : prélève `qty` sur les lots dans l'ordre donné (les plus anciens
 * d'abord). `missingQty` > 0 signifie que le stock ne suffit pas ; rien n'est écrit ici.
 */
export const planFifo = (
  lots: readonly FifoLot[],
  qty: number,
): { allocations: FifoAllocation[]; missingQty: number; costFcfa: number } => {
  const allocations: FifoAllocation[] = [];
  let missing = roundQty(qty);
  for (const lot of lots) {
    if (missing <= QTY_EPSILON) {
      break;
    }
    if (lot.qtyRemaining <= QTY_EPSILON) {
      continue;
    }
    const taken = roundQty(Math.min(lot.qtyRemaining, missing));
    allocations.push({
      lotId: lot.id,
      qty: taken,
      qtyLeft: roundQty(lot.qtyRemaining - taken),
      unitCostFcfa: lot.unitCostFcfa,
    });
    missing = roundQty(missing - taken);
  }
  const costFcfa = Math.round(
    allocations.reduce((sum, allocation) => sum + allocation.qty * allocation.unitCostFcfa, 0),
  );
  return { allocations, costFcfa, missingQty: Math.max(missing, 0) };
};
