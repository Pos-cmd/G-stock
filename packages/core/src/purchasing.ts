import { rmbToFcfa, rmbToUsd, roundFcfa } from "./currency";
import type { ExchangeRates } from "./currency";
import type { AllocationMethod, PricingBasis } from "./enums";

export interface LandedCostItem {
  /** Quantité qui entre en stock, dans l'unité du produit (cartons, rouleaux…). */
  qty: number;
  /** Prix par unité de stock, ou par tonne si `pricingBasis` vaut `weight`. */
  unitPriceRmb: number;
  /** Nombre de voyages : base de la répartition proportionnelle. */
  trips: number;
  pricingBasis?: PricingBasis;
  /** Poids de la ligne en tonnes : base du prix à la tonne et de la répartition au poids. */
  weightTons?: number | null;
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
  /** Coût de revient d'une tonne, si le poids de la ligne est connu. */
  costPerTonFcfa: number | null;
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
  totalWeightTons: number;
}

const TON_UNITS = new Set(["t", "tonne", "tonnes"]);
const KG_PER_TON = 1000;

/**
 * Quantité de stock correspondant à un poids, quand l'unité du produit est une unité de masse
 * (tonne ou kg). `null` pour les autres unités (cartons, rouleaux…), qui se saisissent à part.
 */
export const stockQtyFromWeight = (unit: string, weightTons: number): number | null => {
  const normalized = unit.trim().toLowerCase();
  if (TON_UNITS.has(normalized)) {
    return weightTons;
  }
  if (normalized === "kg") {
    return weightTons * KG_PER_TON;
  }
  return null;
};

const lineGoodsRmb = (item: LandedCostItem): number =>
  item.pricingBasis === "weight"
    ? (item.weightTons ?? 0) * item.unitPriceRmb
    : item.qty * item.unitPriceRmb;

const allocationWeight = (method: AllocationMethod, item: LandedCostItem): number => {
  if (method === "proportional") {
    return Math.max(item.trips, 0);
  }
  if (method === "weight") {
    return Math.max(item.weightTons ?? 0, 0);
  }
  return 1;
};

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
 * au prorata des voyages (`proportional`), du poids (`weight`) ou à parts égales (`equal`).
 * Une ligne se paie à l'unité de stock ou à la tonne (`pricingBasis`).
 */
export const computeLandedCosts = (input: LandedCostInput): LandedCostResult => {
  const { freightFcfa, feesFcfa } = computeFeesFcfa(input);
  const weights = input.items.map((item) => allocationWeight(input.allocationMethod, item));
  const shares = allocateAmount(feesFcfa, weights);

  const lines = input.items.map((item, index): LandedCostLine => {
    const goodsRmb = lineGoodsRmb(item);
    const goodsFcfa = rmbToFcfa(goodsRmb, input.rates);
    const transportShareFcfa = shares[index] ?? 0;
    const totalFcfa = goodsFcfa + transportShareFcfa;
    return {
      costPerTonFcfa: item.weightTons ? roundFcfa(totalFcfa / item.weightTons) : null,
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
    totalWeightTons: input.items.reduce((sum, item) => sum + (item.weightTons ?? 0), 0),
  };
};
