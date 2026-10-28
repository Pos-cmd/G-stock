import { purchaseAmountToFcfa, purchaseAmountToUsd, roundFcfa } from "./currency";
import type { ExchangeRates } from "./currency";
import type { AllocationMethod, FeeCurrency, PricingBasis, PurchaseCurrency } from "./enums";

export interface LandedCostItem {
  /** Quantité qui entre en stock, dans l'unité du produit (cartons, rouleaux…). */
  qty: number;
  /**
   * Prix fournisseur dans la devise de la commande (RMB ou USD), par unité de stock, ou par tonne
   * si `pricingBasis` vaut `weight`.
   */
  unitPrice: number;
  /** Nombre de voyages : base de la répartition proportionnelle. */
  trips: number;
  pricingBasis?: PricingBasis;
  /** Poids de la ligne en tonnes : base du prix à la tonne et de la répartition au poids. */
  weightTons?: number | null;
  /** Quantité effectivement reçue : le coût de la ligne est réparti sur elle (manquants, casse). */
  receivedQty?: number | null;
}

/** Un frais d'approche déjà converti en FCFA, avec sa propre méthode de répartition. */
export interface FeeAllocation {
  amountFcfa: number;
  allocationMethod: AllocationMethod;
}

export interface LandedCostFees {
  freightCbm: number;
  freightRatePerCbmFcfa: number;
  localTransportFcfa: number;
  otherFeesFcfa: number;
}

export interface LandedCostInput extends LandedCostFees {
  allocationMethod: AllocationMethod;
  /** Devise des prix fournisseur. */
  currency: PurchaseCurrency;
  rates: ExchangeRates;
  items: readonly LandedCostItem[];
  /** Coût réel de la marchandise (paiements au taux du jour) ; sinon conversion aux taux. */
  goodsFcfa?: number;
}

export interface LandedCostLine {
  /** Valeur de la marchandise dans la devise de la commande. */
  goodsAmount: number;
  /** Coût de revient d'une tonne, si le poids de la ligne est connu. */
  costPerTonFcfa: number | null;
  goodsFcfa: number;
  transportShareFcfa: number;
  totalFcfa: number;
  unitCostFcfa: number;
}

export interface LandedCostBreakdown {
  lines: LandedCostLine[];
  currency: PurchaseCurrency;
  /** Valeur de la marchandise dans la devise de la commande. */
  goodsAmount: number;
  goodsUsd: number;
  goodsFcfa: number;
  feesFcfa: number;
  totalFcfa: number;
  totalWeightTons: number;
}

export interface LandedCostResult extends LandedCostBreakdown {
  freightFcfa: number;
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

/** Valeur de la marchandise d'une ligne dans la devise de la commande (à l'unité ou à la tonne). */
export const lineGoodsAmount = (item: LandedCostItem): number =>
  item.pricingBasis === "weight"
    ? (item.weightTons ?? 0) * item.unitPrice
    : item.qty * item.unitPrice;

export const totalGoodsAmount = (items: readonly LandedCostItem[]): number =>
  items.reduce((sum, item) => sum + lineGoodsAmount(item), 0);

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

/** Montant d'un frais converti en FCFA avec les taux de la commande. */
export const feeToFcfa = (amount: number, currency: FeeCurrency, rates: ExchangeRates): number =>
  currency === "fcfa" ? roundFcfa(amount) : purchaseAmountToFcfa(amount, currency, rates);

const allocationWeight = (
  method: AllocationMethod,
  item: LandedCostItem,
  goodsFcfa: number,
): number => {
  if (method === "proportional") {
    return Math.max(item.trips, 0);
  }
  if (method === "weight") {
    return Math.max(item.weightTons ?? 0, 0);
  }
  if (method === "value") {
    return goodsFcfa;
  }
  return 1;
};

/**
 * Prix de revient d'une commande à partir d'une liste de frais : marchandise convertie en FCFA
 * (RMB → USD → FCFA, ou USD → FCFA, à l'unité ou à la tonne), puis chaque frais réparti entre
 * les lignes selon sa propre méthode. Le coût unitaire divise le total de la ligne par la
 * quantité reçue si elle est connue, sinon par la quantité commandée.
 *
 * Si `goodsFcfa` est fourni (marchandise payée en plusieurs tranches à des taux différents), ce
 * montant remplace la conversion aux taux et se répartit entre les lignes selon leur valeur.
 */
export const computeLandedCostsFromFees = (input: {
  items: readonly LandedCostItem[];
  fees: readonly FeeAllocation[];
  currency: PurchaseCurrency;
  rates: ExchangeRates;
  goodsFcfa?: number;
}): LandedCostBreakdown => {
  const goodsAmountByLine = input.items.map(lineGoodsAmount);
  const goodsFcfaByLine =
    input.goodsFcfa === undefined
      ? goodsAmountByLine.map((amount) => purchaseAmountToFcfa(amount, input.currency, input.rates))
      : allocateAmount(input.goodsFcfa, goodsAmountByLine);
  const goods = goodsAmountByLine.map((goodsAmount, index) => ({
    goodsAmount,
    goodsFcfa: goodsFcfaByLine[index] ?? 0,
  }));

  // Les frais d'une même méthode sont additionnés puis répartis en une fois : aucune perte d'arrondi.
  const totalsByMethod = new Map<AllocationMethod, number>();
  for (const fee of input.fees) {
    totalsByMethod.set(
      fee.allocationMethod,
      (totalsByMethod.get(fee.allocationMethod) ?? 0) + fee.amountFcfa,
    );
  }
  const shares = input.items.map(() => 0);
  for (const [method, total] of totalsByMethod) {
    const weights = input.items.map((item, index) =>
      allocationWeight(method, item, goods[index]?.goodsFcfa ?? 0),
    );
    for (const [index, share] of allocateAmount(total, weights).entries()) {
      shares[index] = (shares[index] ?? 0) + share;
    }
  }

  const lines = input.items.map((item, index): LandedCostLine => {
    const { goodsAmount = 0, goodsFcfa = 0 } = goods[index] ?? {};
    const transportShareFcfa = shares[index] ?? 0;
    const totalFcfa = goodsFcfa + transportShareFcfa;
    const stockQty = item.receivedQty ?? item.qty;
    return {
      costPerTonFcfa: item.weightTons ? roundFcfa(totalFcfa / item.weightTons) : null,
      goodsAmount,
      goodsFcfa,
      totalFcfa,
      transportShareFcfa,
      unitCostFcfa: stockQty > 0 ? roundFcfa(totalFcfa / stockQty) : 0,
    };
  });

  const goodsAmount = lines.reduce((sum, line) => sum + line.goodsAmount, 0);
  const goodsFcfa = lines.reduce((sum, line) => sum + line.goodsFcfa, 0);
  const feesFcfa = input.fees.reduce((sum, fee) => sum + fee.amountFcfa, 0);
  return {
    currency: input.currency,
    feesFcfa,
    goodsAmount,
    goodsFcfa,
    goodsUsd: purchaseAmountToUsd(goodsAmount, input.currency, input.rates),
    lines,
    totalFcfa: goodsFcfa + feesFcfa,
    totalWeightTons: input.items.reduce((sum, item) => sum + (item.weightTons ?? 0), 0),
  };
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
 * Prix de revient estimé à la commande : fret (CBM × coût par CBM), transport local et autres
 * frais, tous répartis avec la méthode de la commande. À la réception, les frais réels
 * (`computeLandedCostsFromFees`) remplacent cette estimation.
 */
export const computeLandedCosts = (input: LandedCostInput): LandedCostResult => {
  const { freightFcfa, feesFcfa } = computeFeesFcfa(input);
  return {
    ...computeLandedCostsFromFees({
      currency: input.currency,
      fees: [{ allocationMethod: input.allocationMethod, amountFcfa: feesFcfa }],
      goodsFcfa: input.goodsFcfa,
      items: input.items,
      rates: input.rates,
    }),
    freightFcfa,
  };
};
