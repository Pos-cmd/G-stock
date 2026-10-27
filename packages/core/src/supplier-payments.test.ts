import { describe, expect, it } from "vite-plus/test";

import { DEFAULT_EXCHANGE_RATES } from "./currency";
import { computeLandedCostsFromFees } from "./purchasing";
import { orderFcfaPerRmb, summarizeSupplierPayments } from "./supplier-payments";

// Taux de la commande : 598 / 7,2 ≈ 83,06 FCFA pour 1 RMB.
const rates = DEFAULT_EXCHANGE_RATES;
const ORDER_RATE = 598 / 7.2;

describe("summarizeSupplierPayments", () => {
  it("sans versement : tout reste à payer au taux de la commande", () => {
    const summary = summarizeSupplierPayments({
      goodsRmb: 72_000,
      payments: [],
      rates,
    });
    expect(orderFcfaPerRmb(rates)).toBeCloseTo(ORDER_RATE, 10);
    expect(summary.paidFcfa).toBe(0);
    expect(summary.averageFcfaPerRmb).toBeNull();
    expect(summary.remainingRmb).toBe(72_000);
    expect(summary.remainingFcfa).toBe(5_980_000);
    expect(summary.goodsFcfa).toBe(5_980_000);
    expect(summary.isPaid).toBe(false);
  });

  it("convertit chaque tranche à son taux, le reste au taux de la commande", () => {
    // 5 M FCFA à 85 → 58 823,53 RMB ; 2 M FCFA sans taux → 24 080,27 RMB au taux de la commande.
    const summary = summarizeSupplierPayments({
      goodsRmb: 100_000,
      payments: [
        { amountFcfa: 5_000_000, fcfaPerRmb: 85 },
        { amountFcfa: 2_000_000, fcfaPerRmb: null },
      ],
      rates,
    });
    expect(summary.lines[0]?.rmb).toBeCloseTo(58_823.529, 3);
    expect(summary.lines[1]?.usesOrderRate).toBe(true);
    expect(summary.lines[1]?.rmb).toBeCloseTo(24_080.268, 3);
    expect(summary.paidFcfa).toBe(7_000_000);
    expect(summary.remainingRmb).toBeCloseTo(17_096.203, 3);
    // Coût réel : 7 M versés + 17 096,20 RMB × 83,06 = 8 419 976 FCFA.
    expect(summary.goodsFcfa).toBe(Math.round(7_000_000 + summary.remainingRmb * ORDER_RATE));
    expect(summary.averageFcfaPerRmb).toBeCloseTo(7_000_000 / summary.paidRmb, 10);
  });

  it("solde la commande malgré les arrondis de conversion", () => {
    const summary = summarizeSupplierPayments({
      goodsRmb: 1000,
      payments: [{ amountFcfa: 85_000, fcfaPerRmb: 85.0000001 }],
      rates,
    });
    expect(summary.isPaid).toBe(true);
    expect(summary.remainingRmb).toBe(0);
    expect(summary.overpaidRmb).toBe(0);
    expect(summary.goodsFcfa).toBe(85_000);
  });

  it("ne compte pas une avance dans le coût de la marchandise", () => {
    // 1 100 RMB versés à 80 pour 1 000 RMB de marchandise : 100 RMB d'avance.
    const summary = summarizeSupplierPayments({
      goodsRmb: 1000,
      payments: [{ amountFcfa: 88_000, fcfaPerRmb: 80 }],
      rates,
    });
    expect(summary.overpaidRmb).toBeCloseTo(100, 6);
    expect(summary.goodsFcfa).toBe(80_000);
    expect(summary.isPaid).toBe(true);
  });
});

describe("computeLandedCostsFromFees avec un coût réel de marchandise", () => {
  it("répartit le coût réel selon la valeur RMB des lignes", () => {
    const costs = computeLandedCostsFromFees({
      fees: [{ allocationMethod: "equal", amountFcfa: 100_000 }],
      goodsFcfa: 1_000_001,
      items: [
        { qty: 10, trips: 1, unitPriceRmb: 300 },
        { qty: 10, trips: 1, unitPriceRmb: 100 },
      ],
      rates,
    });
    expect(costs.lines.map((line) => line.goodsFcfa)).toEqual([750_001, 250_000]);
    expect(costs.goodsFcfa).toBe(1_000_001);
    expect(costs.totalFcfa).toBe(1_100_001);
    expect(costs.lines[0]?.unitCostFcfa).toBe(80_000);
  });
});
