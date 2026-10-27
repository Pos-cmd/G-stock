import type { Database } from "@G-stock/db";
import { products } from "@G-stock/db/schema/catalog";
import { asc } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { simulationInputSchema } from "../schemas/simulations";
import type { SimulationSaveInput } from "../schemas/simulations";
import { useTestDatabase } from "../testing/database";
import { createProduct } from "./products";
import { getPurchaseOrder } from "./purchases";
import {
  convertSimulationToOrder,
  createSimulation,
  duplicateSimulation,
  getSimulation,
  listSimulations,
} from "./simulations";

let db: Database;
const getDb = useTestDatabase();
beforeEach(() => {
  db = getDb();
});

const simulation = (productId: number | null = null): SimulationSaveInput => ({
  data: {
    fees: [
      {
        allocationMethod: "value",
        amount: 1000,
        currency: "usd",
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
        productId,
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
        productId: null,
        qty: 80,
        trips: 1,
        unit: "carton",
        unitPriceRmb: 5100,
        weightTons: 2,
      },
    ],
    rates: { fcfaPerUsd: 598, rmbPerUsd: 7.2 },
  },
  name: "Conteneur Yiwu novembre",
  notes: null,
});

describe("simulations", () => {
  it("enregistre une simulation et en recalcule les résultats", async () => {
    const created = await createSimulation(db, simulation());
    const detail = await getSimulation(db, created.id);
    // 1 000 000 de fret + 598 000 de douane (1 000 $).
    expect(detail.result.feesFcfa).toBe(1_598_000);
    expect(detail.result.lines[1]?.revenueFcfa).toBe(1_280_000);

    const [listed] = await listSimulations(db);
    expect(listed).toMatchObject({
      lineCount: 2,
      name: "Conteneur Yiwu novembre",
      revenueFcfa: detail.result.revenueFcfa,
    });
  });

  it("duplique une simulation pour comparer", async () => {
    const created = await createSimulation(db, simulation());
    const copy = await duplicateSimulation(db, created.id);
    expect(copy.name).toBe("Conteneur Yiwu novembre (copie)");
    expect(copy.data).toEqual(created.data);
  });

  it("exige le poids quand le fret est réparti au poids", () => {
    const input = simulation();
    const [first, second] = input.data.lines;
    if (!first || !second) {
      throw new Error("Jeu de données incomplet");
    }
    const parsed = simulationInputSchema.safeParse({
      ...input,
      data: {
        ...input.data,
        lines: [{ ...first, pricingBasis: "unit", weightTons: null }, second],
      },
    });
    expect(parsed.error?.issues[0]?.path).toEqual(["data", "lines", 0, "weightTons"]);
  });
});

describe("convertSimulationToOrder", () => {
  it("crée la commande, rattache les produits existants et crée les autres", async () => {
    await createProduct(db, {
      alertThreshold: 0,
      category: null,
      name: "fil GALVA",
      notes: null,
      reference: null,
      referencePriceRmb: null,
      suggestedSalePriceFcfa: null,
      unit: "carton",
    });
    const created = await createSimulation(db, simulation());
    const result = await db.transaction((tx) => convertSimulationToOrder(tx, created.id));
    expect(result.reference).toBe("CF-2026-0001");
    expect(result.createdProducts).toEqual(["Pointes de toiture"]);

    const catalog = await db.select().from(products).orderBy(asc(products.id));
    expect(catalog.map((product) => product.name)).toEqual(["fil GALVA", "Pointes de toiture"]);
    // Le prix de vente simulé devient le prix conseillé du produit créé.
    expect(catalog[1]?.suggestedSalePriceFcfa).toBe(16_000);

    const order = await getPurchaseOrder(db, result.orderId);
    expect(order.status).toBe("draft");
    expect(order.otherFeesFcfa).toBe(598_000);
    expect(order.items.map((item) => [item.productName, item.qty, item.weightTons])).toEqual([
      ["fil GALVA", 800, 8],
      ["Pointes de toiture", 80, 2],
    ]);

    const detail = await getSimulation(db, created.id);
    expect(detail.orderReference).toBe("CF-2026-0001");
    await expect(db.transaction((tx) => convertSimulationToOrder(tx, created.id))).rejects.toThrow(
      "déjà été transformée",
    );
  });
});
