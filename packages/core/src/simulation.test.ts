import { describe, expect, it } from "vite-plus/test";

import { DEFAULT_EXCHANGE_RATES } from "./currency";
import { computeSimulation, pricingRates, salePriceFor } from "./simulation";
import type { SimulationInput } from "./simulation";

describe("prix de vente", () => {
  it("applique un % sur le prix de revient", () => {
    expect(salePriceFor(10_000, { mode: "markup", value: 30 })).toBe(13_000);
  });

  it("applique un % du prix de vente", () => {
    // 10 000 / (1 − 0,30) = 14 285,7…
    expect(salePriceFor(10_000, { mode: "margin", value: 30 })).toBe(14_286);
  });

  it("garde le prix saisi", () => {
    expect(salePriceFor(10_000, { mode: "price", value: 12_500 })).toBe(12_500);
  });

  it("donne les deux taux pour comparer", () => {
    const rates = pricingRates(10_000, 13_000);
    expect(rates.unitMarginFcfa).toBe(3000);
    expect(rates.markupRate).toBeCloseTo(0.3);
    expect(rates.marginRate).toBeCloseTo(0.2308, 3);
  });
});

describe("computeSimulation", () => {
  // Galva : 8 T × 4 450 RMB = 2 956 778 FCFA ; Pointes : 2 T × 5 100 RMB = 847 167 FCFA.
  const input: SimulationInput = {
    fees: [
      {
        allocationMethod: "value",
        amount: 500_000,
        currency: "fcfa",
        label: "Douane",
      },
    ],
    freightAllocation: "weight",
    freightCbm: 10,
    freightRatePerCbmFcfa: 100_000,
    lines: [
      {
        label: "Fil galva",
        pricing: { mode: "markup", value: 25 },
        pricingBasis: "weight",
        qty: 800,
        trips: 1,
        unit: "carton",
        unitPriceRmb: 4450,
        weightTons: 8,
      },
      {
        label: "Pointes de toiture",
        pricing: { mode: "price", value: 16_000 },
        pricingBasis: "weight",
        qty: 80,
        trips: 1,
        unit: "carton",
        unitPriceRmb: 5100,
        weightTons: 2,
      },
    ],
    rates: DEFAULT_EXCHANGE_RATES,
  };

  it("calcule le prix de revient avec le fret et les frais libres", () => {
    const result = computeSimulation(input);
    expect(result.freightFcfa).toBe(1_000_000);
    expect(result.feesFcfa).toBe(1_500_000);
    expect(result.totalCostFcfa).toBe(2_956_778 + 847_167 + 1_500_000);
    expect(result.fees).toEqual([
      { allocationMethod: "value", amountFcfa: 500_000, label: "Douane" },
    ]);
  });

  it("fixe le prix de vente de chaque ligne et calcule la marge", () => {
    const result = computeSimulation(input);
    const [galva, pointes] = result.lines;
    expect(galva?.salePriceFcfa).toBe(Math.round((galva?.unitCostFcfa ?? 0) * 1.25));
    expect(pointes?.salePriceFcfa).toBe(16_000);
    expect(pointes?.revenueFcfa).toBe(1_280_000);
    expect(result.revenueFcfa).toBe((galva?.revenueFcfa ?? 0) + 1_280_000);
    expect(result.marginFcfa).toBe(result.revenueFcfa - result.totalCostFcfa);
  });
});
