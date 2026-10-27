import { describe, expect, it } from "vite-plus/test";

import { allocatePayments, daysBetween, lineAmountFcfa, receivableLevel } from "./sales";

const day = (n: number) => new Date(2026, 0, n);

describe("allocatePayments", () => {
  const sales = [
    { date: day(1), id: 1, netFcfa: 100_000 },
    { date: day(10), id: 2, netFcfa: 50_000 },
  ];

  it("solde les ventes les plus anciennes d'abord avec les paiements libres", () => {
    const result = allocatePayments(sales, [{ amountFcfa: 120_000 }]);
    expect(result.sales.get(1)).toEqual({ dueFcfa: 0, paidFcfa: 100_000 });
    expect(result.sales.get(2)).toEqual({ dueFcfa: 30_000, paidFcfa: 20_000 });
    expect(result.totalDueFcfa).toBe(30_000);
    expect(result.oldestUnpaidDate).toEqual(day(10));
  });

  it("règle d'abord la vente à laquelle un paiement est rattaché", () => {
    // L'acompte versé sur la vente 2 ne sert pas à éponger la vente 1.
    const result = allocatePayments(sales, [{ amountFcfa: 50_000, saleId: 2 }]);
    expect(result.sales.get(2)?.dueFcfa).toBe(0);
    expect(result.sales.get(1)?.dueFcfa).toBe(100_000);
    expect(result.oldestUnpaidDate).toEqual(day(1));
  });

  it("reporte l'excédent d'un paiement rattaché sur les autres ventes, puis en avoir", () => {
    const result = allocatePayments(sales, [{ amountFcfa: 170_000, saleId: 2 }]);
    expect(result.totalDueFcfa).toBe(0);
    expect(result.creditFcfa).toBe(20_000);
    expect(result.oldestUnpaidDate).toBeNull();
  });

  it("transforme en avoir une remise accordée après paiement complet", () => {
    // Vente de 100 000 payée, puis remise de 10 000 : le net tombe à 90 000.
    const result = allocatePayments(
      [{ date: day(1), id: 1, netFcfa: 90_000 }],
      [{ amountFcfa: 100_000, saleId: 1 }],
    );
    expect(result.totalDueFcfa).toBe(0);
    expect(result.creditFcfa).toBe(10_000);
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
