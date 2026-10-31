import { describe, expect, it } from "vite-plus/test";

import {
  allocatePaymentCoverage,
  allocatePayments,
  daysBetween,
  lineAmountFcfa,
  receivableLevel,
} from "./sales";

const day = (n: number) => new Date(2026, 0, n);

describe("allocatePayments", () => {
  const sales = [
    { date: day(1), id: "vente-1", netFcfa: 100_000 },
    { date: day(10), id: "vente-2", netFcfa: 50_000 },
  ];

  it("solde les ventes les plus anciennes d'abord avec les paiements libres", () => {
    const result = allocatePayments(sales, [{ amountFcfa: 120_000 }]);
    expect(result.sales.get("vente-1")).toEqual({
      dueFcfa: 0,
      paidFcfa: 100_000,
    });
    expect(result.sales.get("vente-2")).toEqual({
      dueFcfa: 30_000,
      paidFcfa: 20_000,
    });
    expect(result.totalDueFcfa).toBe(30_000);
    expect(result.oldestUnpaidDate).toEqual(day(10));
  });

  it("règle d'abord la vente à laquelle un paiement est rattaché", () => {
    // L'acompte versé sur la vente 2 ne sert pas à éponger la vente 1.
    const result = allocatePayments(sales, [
      { amountFcfa: 50_000, saleId: "vente-2" },
    ]);
    expect(result.sales.get("vente-2")?.dueFcfa).toBe(0);
    expect(result.sales.get("vente-1")?.dueFcfa).toBe(100_000);
    expect(result.oldestUnpaidDate).toEqual(day(1));
  });

  it("reporte l'excédent d'un paiement rattaché sur les autres ventes, puis en avoir", () => {
    const result = allocatePayments(sales, [
      { amountFcfa: 170_000, saleId: "vente-2" },
    ]);
    expect(result.totalDueFcfa).toBe(0);
    expect(result.creditFcfa).toBe(20_000);
    expect(result.oldestUnpaidDate).toBeNull();
  });

  it("transforme en avoir une remise accordée après paiement complet", () => {
    // Vente de 100 000 payée, puis remise de 10 000 : le net tombe à 90 000.
    const result = allocatePayments(
      [{ date: day(1), id: "vente-1", netFcfa: 90_000 }],
      [{ amountFcfa: 100_000, saleId: "vente-1" }]
    );
    expect(result.totalDueFcfa).toBe(0);
    expect(result.creditFcfa).toBe(10_000);
  });
});

describe("allocatePaymentCoverage", () => {
  const sales = [
    { date: day(1), id: "vente-1", netFcfa: 100_000 },
    { date: day(10), id: "vente-2", netFcfa: 50_000 },
  ];

  it("attribue un paiement libre aux ventes les plus anciennes", () => {
    const coverage = allocatePaymentCoverage(sales, [
      { amountFcfa: 120_000, id: "p1" },
    ]);
    expect(coverage.get("p1")).toEqual([
      { amountFcfa: 100_000, saleId: "vente-1" },
      { amountFcfa: 20_000, saleId: "vente-2" },
    ]);
  });

  it("respecte la vente rattachée, puis déborde sur les autres", () => {
    const coverage = allocatePaymentCoverage(sales, [
      { amountFcfa: 80_000, id: "p1", saleId: "vente-2" },
    ]);
    expect(coverage.get("p1")).toEqual([
      { amountFcfa: 50_000, saleId: "vente-2" },
      { amountFcfa: 30_000, saleId: "vente-1" },
    ]);
  });

  it("répartit plusieurs paiements dans l'ordre chronologique", () => {
    const coverage = allocatePaymentCoverage(sales, [
      { amountFcfa: 60_000, id: "p1" },
      { amountFcfa: 60_000, id: "p2" },
    ]);
    expect(coverage.get("p1")).toEqual([
      { amountFcfa: 60_000, saleId: "vente-1" },
    ]);
    expect(coverage.get("p2")).toEqual([
      { amountFcfa: 40_000, saleId: "vente-1" },
      { amountFcfa: 20_000, saleId: "vente-2" },
    ]);
  });

  it("donne les mêmes totaux par vente que allocatePayments", () => {
    const payments = [
      { amountFcfa: 30_000, id: "p1" },
      { amountFcfa: 70_000, id: "p2", saleId: "vente-2" },
      { amountFcfa: 90_000, id: "p3" },
    ];
    const coverage = allocatePaymentCoverage(sales, payments);
    const totals = new Map<string, number>();
    for (const parts of coverage.values()) {
      for (const part of parts) {
        totals.set(
          part.saleId,
          (totals.get(part.saleId) ?? 0) + part.amountFcfa
        );
      }
    }
    const allocation = allocatePayments(sales, payments);
    expect(totals.get("vente-1")).toBe(
      allocation.sales.get("vente-1")?.paidFcfa
    );
    expect(totals.get("vente-2")).toBe(
      allocation.sales.get("vente-2")?.paidFcfa
    );
    expect(allocation.creditFcfa).toBe(40_000);
  });
});

describe("créances", () => {
  const thresholds = {
    receivableAlertDays: 60,
    receivableCriticalDays: 90,
    receivableWarningDays: 30,
  };

  it("classe une créance selon son ancienneté", () => {
    expect(receivableLevel(10, thresholds)).toBe("current");
    expect(receivableLevel(30, thresholds)).toBe("warning");
    expect(receivableLevel(75, thresholds)).toBe("alert");
    expect(receivableLevel(120, thresholds)).toBe("critical");
  });

  it("compte les jours entiers écoulés", () => {
    expect(daysBetween(day(1), day(31))).toBe(30);
    expect(daysBetween(day(5), day(1))).toBe(0);
  });

  it("arrondit le montant d'une ligne au FCFA", () => {
    expect(lineAmountFcfa(2.5, 1999)).toBe(4998);
  });
});
