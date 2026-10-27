import { rmbToFcfa, rmbToUsd, roundFcfa } from "./currency";
import type { ExchangeRates } from "./currency";
import type { AllocationMethod } from "./enums";

export interface LandedCostItem {
  qty: number;
  unitPriceRmb: number;
  /** Nombre de voyages : base de la répartition proportionnelle. */
  trips: number;
}

export interface LandedCostFees {
  freightCbm: number;
  freightRatePerCbmFcfa: number;
  localTransportFcfa: number;
  otherFeesFcfa: number;
}

export interface LandedCostInput extends LandedCostFees {
  allocationMethod: AllocationMethod;
  rates: ExchangeRates;
  items: readonly LandedCostItem[];
}

export interface LandedCostLine {
  goodsRmb: number;
  goodsFcfa: number;
  transportShareFcfa: number;
  totalFcfa: number;
  unitCostFcfa: number;
}

export interface LandedCostResult {
  lines: LandedCostLine[];
  goodsRmb: number;
  goodsUsd: number;
  goodsFcfa: number;
  freightFcfa: number;
  feesFcfa: number;
  totalFcfa: number;
}

/**
 * Répartit un montant entier selon des poids, sans perte d'arrondi :
 * la somme des parts vaut toujours `total` (méthode du plus fort reste).
 * Si tous les poids sont nuls, la répartition est égale.
 */
export const allocateAmount = (total: number, weights: readonly number[]): number[] => {
  if (weights.length === 0) {
    return [];
  }
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const effective = weightSum > 0 ? weights : weights.map(() => 1);
  const effectiveSum = weightSum > 0 ? weightSum : weights.length;

  const exact = effective.map((weight) => (total * weight) / effectiveSum);
  const shares = exact.map((value) => Math.floor(value));
  let remainder = total - shares.reduce((sum, share) => sum + share, 0);

  const byRemainder = exact
    .map((value, index) => ({ fraction: value - Math.floor(value), index }))
    .toSorted((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of byRemainder) {
    if (remainder <= 0) {
      break;
    }
    shares[index] = (shares[index] ?? 0) + 1;
    remainder -= 1;
  }
  return shares;
};

export const computeFeesFcfa = (
  fees: LandedCostFees,
): { freightFcfa: number; feesFcfa: number } => {
  const freightFcfa = roundFcfa(fees.freightCbm * fees.freightRatePerCbmFcfa);
  return {
    feesFcfa: freightFcfa + fees.localTransportFcfa + fees.otherFeesFcfa,
    freightFcfa,
  };
};

/**
 * Prix de revient d'une commande fournisseur : marchandise convertie RMB → USD → FCFA,
 * plus les frais d'approche (fret CBM, transport local, divers) répartis entre les lignes
 * au prorata des voyages (`proportional`) ou à parts égales (`equal`).
 */
export const computeLandedCosts = (input: LandedCostInput): LandedCostResult => {
  const { freightFcfa, feesFcfa } = computeFeesFcfa(input);
  const weights = input.items.map((item) =>
    input.allocationMethod === "proportional" ? Math.max(item.trips, 0) : 1,
  );
  const shares = allocateAmount(feesFcfa, weights);

  const lines = input.items.map((item, index): LandedCostLine => {
    const goodsRmb = item.qty * item.unitPriceRmb;
    const goodsFcfa = rmbToFcfa(goodsRmb, input.rates);
    const transportShareFcfa = shares[index] ?? 0;
    const totalFcfa = goodsFcfa + transportShareFcfa;
    return {
      goodsFcfa,
      goodsRmb,
      totalFcfa,
      transportShareFcfa,
      unitCostFcfa: item.qty > 0 ? roundFcfa(totalFcfa / item.qty) : 0,
    };
  });

  const goodsRmb = lines.reduce((sum, line) => sum + line.goodsRmb, 0);
  const goodsFcfa = lines.reduce((sum, line) => sum + line.goodsFcfa, 0);
  return {
    feesFcfa,
    freightFcfa,
    goodsFcfa,
    goodsRmb,
    goodsUsd: rmbToUsd(goodsRmb, input.rates),
    lines,
    totalFcfa: goodsFcfa + feesFcfa,
  };
};
