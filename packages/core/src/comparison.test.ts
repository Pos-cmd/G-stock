import { describe, expect, it } from "vite-plus/test";

import { compareValues, comparisonKey, normalizeLabel } from "./comparison";

describe("compareValues", () => {
  it("calcule l'écart à la référence et repère le moins cher", () => {
    const [reference, cheaper, dearer] = compareValues([10_000, 9000, 12_000], "lower");
    expect(reference).toMatchObject({
      deltaRatio: null,
      isBest: false,
      isWorst: false,
    });
    expect(cheaper?.deltaRatio).toBeCloseTo(-0.1);
    expect(cheaper?.isBest).toBe(true);
    expect(dearer?.deltaRatio).toBeCloseTo(0.2);
    expect(dearer?.isWorst).toBe(true);
  });

  it("met en avant la valeur la plus haute pour une marge", () => {
    const result = compareValues([500, 800], "higher");
    expect(result[1]?.isBest).toBe(true);
    expect(result[0]?.isWorst).toBe(true);
  });

  it("ignore les valeurs absentes et ne distingue rien sans écart", () => {
    const result = compareValues([1000, null, 1000], "lower");
    expect(result.map((item) => item.isBest || item.isWorst)).toEqual([false, false, false]);
    expect(result[1]?.deltaRatio).toBeNull();
    expect(result[2]?.deltaRatio).toBe(0);
  });
});

describe("rapprochement des lignes", () => {
  it("rapproche par produit du catalogue, sinon par libellé normalisé", () => {
    expect(
      comparisonKey({ label: "Fil galva", productId: "0192aa00-0000-7000-8000-000000000003" }),
    ).toBe("produit-0192aa00-0000-7000-8000-000000000003");
    expect(comparisonKey({ label: "  Barbelé   PVC " })).toBe(
      comparisonKey({ label: "barbele pvc" }),
    );
    expect(normalizeLabel("Pointes  de TOITURE")).toBe("pointes de toiture");
  });
});
