import { describe, expect, it } from "vite-plus/test";

import { isUuid, uuidv7 } from "./ids";

describe("uuidv7", () => {
  it("produit des UUID version 7 valides", () => {
    const id = uuidv7();
    expect(isUuid(id)).toBe(true);
    expect(id[14]).toBe("7");
    expect("89ab").toContain(id[19]);
  });

  it("ne produit jamais deux fois le même identifiant", () => {
    const ids = Array.from({ length: 10_000 }, () => uuidv7());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("garde l'ordre de création, même dans la même milliseconde", () => {
    const ids = Array.from({ length: 5000 }, () => uuidv7());
    expect(ids.toSorted()).toEqual(ids);
  });

  it("encode l'horodatage dans les premiers caractères", () => {
    const before = Date.now();
    const id = uuidv7();
    const timestamp = Number.parseInt(id.replace("-", "").slice(0, 12), 16);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp - before).toBeLessThan(1000);
  });
});
