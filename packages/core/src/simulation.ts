import { roundFcfa } from "./currency";
import type { ExchangeRates } from "./currency";
import type { AllocationMethod, FeeCurrency, SalePricingMode } from "./enums";
import { computeFeesFcfa, computeLandedCostsFromFees, feeToFcfa } from "./purchasing";
import type { LandedCostItem, LandedCostLine } from "./purchasing";
import { lineAmountFcfa } from "./sales";

/** Prix de vente d'une ligne : % ajouté au coût, % du prix de vente, ou prix saisi. */
export interface SalePricing {
  mode: SalePricingMode;
  value: number;
}

/** Plafond d'un taux de marge sur prix de vente (100 % voudrait dire un prix infini). */
export const MAX_MARGIN_RATE_PERCENT = 99;

export const salePriceFor = (unitCostFcfa: number, pricing: SalePricing): number => {
  if (pricing.mode === "price") {
    return roundFcfa(Math.max(pricing.value, 0));
  }
  if (pricing.mode === "markup") {
    return roundFcfa(unitCostFcfa * (1 + pricing.value / 100));
  }
  const rate = Math.min(pricing.value, MAX_MARGIN_RATE_PERCENT) / 100;
  return roundFcfa(unitCostFcfa / (1 - rate));
};

export interface PricingRates {
  unitMarginFcfa: number;
  /** Marge rapportée au coût (« coefficient »), en fraction : 0,3 = 30 %. */
  markupRate: number | null;
  /** Marge rapportée au prix de vente, en fraction. */
  marginRate: number | null;
}

export const pricingRates = (unitCostFcfa: number, salePriceFcfa: number): PricingRates => {
  const unitMarginFcfa = salePriceFcfa - unitCostFcfa;
  return {
    marginRate: salePriceFcfa > 0 ? unitMarginFcfa / salePriceFcfa : null,
    markupRate: unitCostFcfa > 0 ? unitMarginFcfa / unitCostFcfa : null,
    unitMarginFcfa,
  };
};

/** Le simulateur travaille en RMB : ses simulations enregistrées gardent `unitPriceRmb`. */
export interface SimulationLineInput extends Omit<LandedCostItem, "unitPrice"> {
  unitPriceRmb: number;
  label: string;
  unit: string;
  productId?: string | null;
  pricing: SalePricing;
}

export interface SimulationFeeInput {
  label: string;
  amount: number;
  currency: FeeCurrency;
  allocationMethod: AllocationMethod;
}

export interface SimulationInput {
  rates: ExchangeRates;
  freightCbm: number;
  freightRatePerCbmFcfa: number;
  freightAllocation: AllocationMethod;
  fees: readonly SimulationFeeInput[];
  lines: readonly SimulationLineInput[];
}

export interface SimulationLineResult extends LandedCostLine, PricingRates {
  salePriceFcfa: number;
  revenueFcfa: number;
  marginFcfa: number;
}

export interface SimulationResult {
  lines: SimulationLineResult[];
  fees: {
    label: string;
    amountFcfa: number;
    allocationMethod: AllocationMethod;
  }[];
  freightFcfa: number;
  goodsRmb: number;
  goodsUsd: number;
  goodsFcfa: number;
  feesFcfa: number;
  totalCostFcfa: number;
  totalWeightTons: number;
  revenueFcfa: number;
  marginFcfa: number;
  markupRate: number | null;
  marginRate: number | null;
}

/**
 * Calculatrice commerciale : prix de revient de chaque ligne (marchandise + fret CBM + frais
 * libres, chacun réparti selon sa méthode), puis prix de vente et marges.
 */
export const computeSimulation = (input: SimulationInput): SimulationResult => {
  const { freightFcfa } = computeFeesFcfa({
    freightCbm: input.freightCbm,
    freightRatePerCbmFcfa: input.freightRatePerCbmFcfa,
    localTransportFcfa: 0,
    otherFeesFcfa: 0,
  });
  const fees = input.fees.map((fee) => ({
    allocationMethod: fee.allocationMethod,
    amountFcfa: feeToFcfa(fee.amount, fee.currency, input.rates),
    label: fee.label,
  }));
  const costs = computeLandedCostsFromFees({
    currency: "rmb",
    fees: [{ allocationMethod: input.freightAllocation, amountFcfa: freightFcfa }, ...fees],
    items: input.lines.map((line) => ({ ...line, unitPrice: line.unitPriceRmb })),
    rates: input.rates,
  });

  const lines = costs.lines.map((line, index): SimulationLineResult => {
    const item = input.lines[index];
    const salePriceFcfa = item ? salePriceFor(line.unitCostFcfa, item.pricing) : 0;
    const revenueFcfa = lineAmountFcfa(item?.qty ?? 0, salePriceFcfa);
    return {
      ...line,
      ...pricingRates(line.unitCostFcfa, salePriceFcfa),
      marginFcfa: revenueFcfa - line.totalFcfa,
      revenueFcfa,
      salePriceFcfa,
    };
  });

  const revenueFcfa = lines.reduce((sum, line) => sum + line.revenueFcfa, 0);
  const marginFcfa = revenueFcfa - costs.totalFcfa;
  return {
    fees,
    feesFcfa: costs.feesFcfa,
    freightFcfa,
    goodsFcfa: costs.goodsFcfa,
    goodsRmb: costs.goodsAmount,
    goodsUsd: costs.goodsUsd,
    lines,
    marginFcfa,
    marginRate: revenueFcfa > 0 ? marginFcfa / revenueFcfa : null,
    markupRate: costs.totalFcfa > 0 ? marginFcfa / costs.totalFcfa : null,
    revenueFcfa,
    totalCostFcfa: costs.totalFcfa,
    totalWeightTons: costs.totalWeightTons,
  };
};
