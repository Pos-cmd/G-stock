import { describe, expect, it } from "vite-plus/test";

import { DEFAULT_EXCHANGE_RATES, rmbToFcfa, rmbToUsd, usdToFcfa } from "./currency";

describe("conversions de devises", () => {
  it("convertit RMB → USD avec ÷ 7,2", () => {
    expect(rmbToUsd(72, DEFAULT_EXCHANGE_RATES)).toBeCloseTo(10);
  });

  it("convertit USD → FCFA avec × 598", () => {
    expect(usdToFcfa(10, DEFAULT_EXCHANGE_RATES)).toBe(5980);
  });

  it("convertit RMB → FCFA et arrondit au FCFA", () => {
    // 100 / 7,2 × 598 = 8305,55…
    expect(rmbToFcfa(100, DEFAULT_EXCHANGE_RATES)).toBe(8306);
  });

  it("utilise les taux configurés", () => {
    expect(rmbToFcfa(70, { fcfaPerUsd: 600, rmbPerUsd: 7 })).toBe(6000);
  });

  it("refuse un taux nul", () => {
    expect(() => rmbToFcfa(10, { fcfaPerUsd: 598, rmbPerUsd: 0 })).toThrow();
  });
});
