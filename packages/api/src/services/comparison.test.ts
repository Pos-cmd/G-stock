import type { Database } from "@G-stock/db";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { comparisonSchema } from "../schemas/comparison";
import { useTestDatabase } from "../testing/database";
import { getComparison } from "./comparison";
import { createProduct } from "./products";
import { createPurchaseOrder, getPurchaseOrder, receivePurchaseOrder } from "./purchases";
import { createSimulation } from "./simulations";

let db: Database;
const getDb = useTestDatabase();
beforeEach(() => {
  db = getDb();
});

const product = (name: string) =>
  createProduct(db, {
    alertThreshold: 0,
    category: null,
    name,
    notes: null,
    reference: null,
    referencePriceRmb: null,
    suggestedSalePriceFcfa: null,
    unit: "carton",
  });

/** Commande d'octobre reçue : galva à 4 300 RMB/T, fret 2 000 $ et douane 1 000 000. */
const receivedOrder = async (galvaId: number, pointesId: number) => {
  const order = await db.transaction((tx) =>
    createPurchaseOrder(tx, {
      allocationMethod: "weight",
      fcfaPerUsd: 600,
      freightCbm: 20,
      freightRatePerCbmFcfa: 100_000,
      items: [
        {
          pricingBasis: "weight",
          productId: galvaId,
          qty: 800,
          trips: 1,
          unitPriceRmb: 4300,
          weightTons: 8,
        },
        {
          pricingBasis: "weight",
          productId: pointesId,
          qty: 80,
          trips: 1,
          unitPriceRmb: 5000,
          weightTons: 2,
        },
      ],
      localTransportFcfa: 0,
      notes: null,
      orderDate: new Date(2026, 9, 1),
      otherFeesFcfa: 0,
      rmbPerUsd: 7.1,
      supplierId: null,
    }),
  );
  const detail = await getPurchaseOrder(db, order.id);
  await db.transaction((tx) =>
    receivePurchaseOrder(tx, {
      arrivedAt: null,
      billOfLading: null,
      containerNumber: null,
      fees: [
        {
          allocationMethod: "weight",
          amount: 2000,
          currency: "usd",
          label: "Fret maritime",
        },
        {
          allocationMethod: "value",
          amount: 1_000_000,
          currency: "fcfa",
          label: "Douane",
        },
      ],
      forwarder: null,
      id: order.id,
      items: detail.items.map((item) => ({
        id: item.id,
        qtyReceived: item.qty,
      })),
      receivedAt: new Date(2026, 9, 20),
    }),
  );
  return order;
};

describe("getComparison", () => {
  it("compare une simulation à une commande reçue, produit par produit et frais par frais", async () => {
    const galva = await product("Fil galva");
    const pointes = await product("Pointes de toiture");
    const order = await receivedOrder(galva.id, pointes.id);
    const simulation = await createSimulation(db, {
      data: {
        fees: [
          {
            allocationMethod: "value",
            amount: 1_500_000,
            currency: "fcfa",
            label: "douane",
          },
        ],
        freightAllocation: "weight",
        freightCbm: 24.8,
        freightRatePerCbmFcfa: 100_000,
        lines: [
          {
            label: "Fil galva",
            pricing: { mode: "markup", value: 25 },
            pricingBasis: "weight",
            productId: galva.id,
            qty: 800,
            trips: 1,
            unit: "carton",
            unitPriceRmb: 4450,
            weightTons: 8,
          },
          {
            // Même produit que le catalogue, saisi sans le rattacher : rapproché par son nom.
            label: "POINTES de toiture",
            pricing: { mode: "price", value: 16_000 },
            pricingBasis: "weight",
            productId: null,
            qty: 80,
            trips: 1,
            unit: "carton",
            unitPriceRmb: 5100,
            weightTons: 2,
          },
          {
            label: "Grillage",
            pricing: { mode: "markup", value: 30 },
            pricingBasis: "unit",
            productId: null,
            qty: 100,
            trips: 1,
            unit: "rouleau",
            unitPriceRmb: 50,
            weightTons: 1,
          },
        ],
        rates: { fcfaPerUsd: 598, rmbPerUsd: 7.2 },
      },
      name: "Conteneur décembre",
      notes: null,
    });

    const comparison = await getComparison(db, [
      { id: simulation.id, type: "simulation" },
      { id: order.id, type: "purchase_order" },
    ]);

    const [sim, received] = comparison.columns;
    expect(sim).toMatchObject({
      title: "Conteneur décembre",
      type: "simulation",
    });
    expect(received?.subtitle).toBe("Commande reçue (coûts réels)");
    expect(received?.revenueFcfa).toBeNull();
    // 2 000 $ × 600 + 1 000 000 de douane.
    expect(received?.feesFcfa).toBe(2_200_000);

    expect(
      comparison.productRows.map((row) => [
        row.label,
        row.cells.map((cell) => cell?.unitPriceRmb ?? null),
      ]),
    ).toEqual([
      ["Fil galva", [4450, 4300]],
      ["POINTES de toiture", [5100, 5000]],
      ["Grillage", [50, null]],
    ]);

    expect(comparison.feeRows).toEqual([
      { cells: [2_480_000, 1_200_000], label: "Fret maritime" },
      { cells: [1_500_000, 1_000_000], label: "douane" },
    ]);
  });

  it("limite la comparaison à 4 éléments", () => {
    const items = Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
      type: "simulation",
    }));
    expect(comparisonSchema.safeParse({ items }).success).toBe(false);
  });
});
