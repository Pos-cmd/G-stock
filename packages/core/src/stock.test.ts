import { describe, expect, it } from "vite-plus/test";

import { getStockStatus, weightedAverageCost } from "./stock";

describe("getStockStatus", () => {
  it("signale une rupture à zéro", () => {
    expect(getStockStatus(0, 5)).toBe("out");
  });

  it("signale un stock bas au seuil ou en dessous", () => {
    expect(getStockStatus(5, 5)).toBe("low");
    expect(getStockStatus(2.5, 5)).toBe("low");
  });

  it("est ok au-dessus du seuil", () => {
    expect(getStockStatus(6, 5)).toBe("ok");
    expect(getStockStatus(1, 0)).toBe("ok");
  });
});

describe("weightedAverageCost", () => {
  it("pondère par les quantités restantes", () => {
    const lots = [
      { qtyRemaining: 10, unitCostFcfa: 1000 },
      { qtyRemaining: 30, unitCostFcfa: 2000 },
    ];
    expect(weightedAverageCost(lots)).toBe(1750);
  });

  it("vaut 0 sans stock", () => {
    expect(weightedAverageCost([])).toBe(0);
    expect(weightedAverageCost([{ qtyRemaining: 0, unitCostFcfa: 1000 }])).toBe(0);
  });
});
