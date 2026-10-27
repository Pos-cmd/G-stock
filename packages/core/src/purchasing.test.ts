import { describe, expect, it } from "vite-plus/test";

import { DEFAULT_EXCHANGE_RATES } from "./currency";
import { allocateAmount, computeLandedCosts } from "./purchasing";
import type { LandedCostInput } from "./purchasing";

// A : 100 × 72 RMB = 7 200 RMB = 1 000 $ = 598 000 FCFA, 3 voyages.
// B : 50 × 36 RMB = 1 800 RMB = 250 $ = 149 500 FCFA, 1 voyage.
// Frais : 2 CBM × 150 000 + 100 000 de transport local = 400 000 FCFA.
const order = (allocationMethod: LandedCostInput["allocationMethod"]): LandedCostInput => ({
  allocationMethod,
  freightCbm: 2,
  freightRatePerCbmFcfa: 150_000,
  items: [
    { qty: 100, trips: 3, unitPriceRmb: 72 },
    { qty: 50, trips: 1, unitPriceRmb: 36 },
  ],
  localTransportFcfa: 100_000,
  otherFeesFcfa: 0,
  rates: DEFAULT_EXCHANGE_RATES,
});

describe("allocateAmount", () => {
  it("répartit au prorata des poids", () => {
    expect(allocateAmount(400_000, [3, 1])).toEqual([300_000, 100_000]);
  });

  it("ne perd aucun FCFA à l'arrondi", () => {
    const shares = allocateAmount(100, [1, 1, 1]);
    expect(shares).toEqual([34, 33, 33]);
    expect(shares.reduce((sum, share) => sum + share, 0)).toBe(100);
  });

  it("répartit à parts égales si tous les poids sont nuls", () => {
    expect(allocateAmount(10, [0, 0])).toEqual([5, 5]);
  });

  it("renvoie une liste vide sans ligne", () => {
    expect(allocateAmount(1000, [])).toEqual([]);
  });
});

describe("computeLandedCosts", () => {
  it("convertit la marchandise et totalise les frais", () => {
    const result = computeLandedCosts(order("proportional"));
    expect(result.goodsRmb).toBe(9000);
    expect(result.goodsUsd).toBeCloseTo(1250);
    expect(result.goodsFcfa).toBe(747_500);
    expect(result.freightFcfa).toBe(300_000);
    expect(result.feesFcfa).toBe(400_000);
    expect(result.totalFcfa).toBe(1_147_500);
  });

  it("répartit les frais selon le nombre de voyages (méthode proportionnelle)", () => {
    const [a, b] = computeLandedCosts(order("proportional")).lines;
    expect(a?.transportShareFcfa).toBe(300_000);
    expect(a?.unitCostFcfa).toBe(8980);
    expect(b?.transportShareFcfa).toBe(100_000);
    expect(b?.unitCostFcfa).toBe(4990);
  });

  it("répartit les frais à parts égales (méthode égale)", () => {
    const [a, b] = computeLandedCosts(order("equal")).lines;
    expect(a?.transportShareFcfa).toBe(200_000);
    expect(a?.unitCostFcfa).toBe(7980);
    expect(b?.transportShareFcfa).toBe(200_000);
    expect(b?.unitCostFcfa).toBe(6990);
  });

  it("donne le prix converti seul quand il n'y a aucun frais", () => {
    const result = computeLandedCosts({
      ...order("equal"),
      freightCbm: 0,
      localTransportFcfa: 0,
    });
    expect(result.feesFcfa).toBe(0);
    expect(result.lines[0]?.unitCostFcfa).toBe(5980);
  });

  it("utilise les taux figés de la commande", () => {
    const result = computeLandedCosts({
      ...order("equal"),
      rates: { fcfaPerUsd: 600, rmbPerUsd: 7.2 },
    });
    expect(result.lines[0]?.goodsFcfa).toBe(600_000);
  });
});
