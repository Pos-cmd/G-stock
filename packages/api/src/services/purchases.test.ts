import type { Database } from "@G-stock/db";
import { stockLots, stockMovements } from "@G-stock/db/schema/stock";
import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { computeLandedCostsFromFees } from "@G-stock/core/purchasing";

import { purchaseOrderInputSchema } from "../schemas/purchases";
import type { PurchaseFeeInput, PurchaseOrderInput } from "../schemas/purchases";
import { useTestDatabase } from "../testing/database";
import { createProduct, getProduct, setProductArchived } from "./products";
import {
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  receivePurchaseOrder,
  removePurchaseOrder,
  saveReception,
  setPurchaseStatus,
  updatePurchaseOrder,
} from "./purchases";
import { listLots } from "./stock";
import { createSupplier, removeSupplier } from "./suppliers";

let db: Database;
const getDb = useTestDatabase();
beforeEach(() => {
  db = getDb();
});

const MARCH_1 = new Date(2026, 2, 1);
const APRIL_15 = new Date(2026, 3, 15);

const newProduct = (name: string) =>
  createProduct(db, {
    alertThreshold: 0,
    category: null,
    name,
    notes: null,
    reference: null,
    referencePriceRmb: null,
    suggestedSalePriceFcfa: null,
    unit: "rouleau",
  });

// Même jeu de données que les tests de @G-stock/core/purchasing :
// 400 000 FCFA de frais, répartis 3:1 → coûts unitaires 8 980 et 4 990 FCFA.
const orderInput = async (overrides: Partial<PurchaseOrderInput> = {}) => {
  const wax = await newProduct("Wax");
  const bazin = await newProduct("Bazin");
  const input: PurchaseOrderInput = {
    allocationMethod: "proportional",
    fcfaPerUsd: 598,
    freightCbm: 2,
    freightRatePerCbmFcfa: 150_000,
    items: [
      { productId: wax.id, qty: 100, trips: 3, unitPriceRmb: 72 },
      { productId: bazin.id, qty: 50, trips: 1, unitPriceRmb: 36 },
    ],
    localTransportFcfa: 100_000,
    notes: null,
    orderDate: MARCH_1,
    otherFeesFcfa: 0,
    rmbPerUsd: 7.2,
    supplierId: null,
    ...overrides,
  };
  return { bazin, input, wax };
};

const create = (input: PurchaseOrderInput) =>
  db.transaction((tx) => createPurchaseOrder(tx, input));

interface ReceptionOptions {
  fees?: PurchaseFeeInput[];
  qtyReceived?: (qty: number, index: number) => number;
}

/** Par défaut, réception « comme prévu » : frais réels = estimation, tout est reçu. */
const receptionInput = async (id: number, options: ReceptionOptions = {}) => {
  const detail = await getPurchaseOrder(db, id);
  return {
    arrivedAt: null,
    billOfLading: null,
    containerNumber: null,
    fees: options.fees ?? [
      {
        allocationMethod: detail.allocationMethod,
        amount: detail.estimate.feesFcfa,
        currency: "fcfa" as const,
        label: "Frais",
      },
    ],
    forwarder: null,
    id,
    items: detail.items.map((item, index) => ({
      id: item.id,
      qtyReceived: options.qtyReceived?.(item.qty, index) ?? item.qty,
    })),
  };
};

const receive = async (id: number, options?: ReceptionOptions) => {
  const input = await receptionInput(id, options);
  return db.transaction((tx) => receivePurchaseOrder(tx, { ...input, receivedAt: APRIL_15 }));
};

describe("createPurchaseOrder", () => {
  it("numérote les commandes par année et calcule le coût de revient de chaque ligne", async () => {
    const { input } = await orderInput();
    const first = await create(input);
    const second = await create(input);
    expect(first.reference).toBe("CF-2026-0001");
    expect(second.reference).toBe("CF-2026-0002");
    expect(first.status).toBe("draft");

    const detail = await getPurchaseOrder(db, first.id);
    expect(detail.items.map((item) => item.unitCostFcfa)).toEqual([8980, 4990]);
    expect(detail.items.map((item) => item.transportShareFcfa)).toEqual([300_000, 100_000]);
    expect(detail.costs.totalFcfa).toBe(1_147_500);
    expect(detail.isLocked).toBe(false);
  });

  it("refuse un produit archivé", async () => {
    const { input, wax } = await orderInput();
    await setProductArchived(db, wax.id, true);
    await expect(create(input)).rejects.toThrow("archivé");
  });
});

describe("updatePurchaseOrder", () => {
  it("remplace les lignes et recalcule les coûts", async () => {
    const { input } = await orderInput();
    const order = await create(input);
    await db.transaction((tx) =>
      updatePurchaseOrder(tx, order.id, { ...input, allocationMethod: "equal" }),
    );

    const detail = await getPurchaseOrder(db, order.id);
    expect(detail.items).toHaveLength(2);
    expect(detail.items.map((item) => item.unitCostFcfa)).toEqual([7980, 6990]);
  });
});

describe("receivePurchaseOrder", () => {
  it("crée un lot par ligne au coût de revient et trace les entrées", async () => {
    const { input, wax, bazin } = await orderInput();
    const order = await create(input);
    const result = await receive(order.id);
    expect(result.lotCount).toBe(2);

    const lots = await db.select().from(stockLots).orderBy(asc(stockLots.id));
    expect(lots.map((lot) => [lot.productId, lot.qtyInitial, lot.unitCostFcfa])).toEqual([
      [wax.id, 100, 8980],
      [bazin.id, 50, 4990],
    ]);
    expect(lots.every((lot) => lot.source === "purchase" && lot.orderItemId !== null)).toBe(true);
    expect(lots[0]?.receivedAt).toEqual(APRIL_15);

    const movements = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.referenceType, "purchase_order"));
    expect(movements).toHaveLength(2);
    expect(movements.every((movement) => movement.referenceId === order.id)).toBe(true);

    const detail = await getPurchaseOrder(db, order.id);
    expect(detail.status).toBe("received");
    expect(detail.receivedAt).toEqual(APRIL_15);
    expect(detail.isLocked).toBe(true);
    expect(detail.items.every((item) => item.lotCode?.startsWith("LOT-20260415-"))).toBe(true);

    const product = await getProduct(db, wax.id);
    expect(product.stockValueFcfa).toBe(898_000);
    const [waxLot] = await listLots(db, wax.id, true);
    expect(waxLot?.orderReference).toBe("CF-2026-0001");
  });

  it("verrouille la commande une fois reçue", async () => {
    const { input } = await orderInput();
    const order = await create(input);
    await receive(order.id);

    await expect(receive(order.id)).rejects.toThrow("déjà été réceptionnée");
    await expect(db.transaction((tx) => updatePurchaseOrder(tx, order.id, input))).rejects.toThrow(
      "déjà été réceptionnée",
    );
    await expect(setPurchaseStatus(db, order.id, "cancelled")).rejects.toThrow();
    await expect(removePurchaseOrder(db, order.id)).rejects.toThrow("brouillon ou annulées");
    expect(await db.select().from(stockLots)).toHaveLength(2);
  });

  it("refuse une commande annulée", async () => {
    const { input } = await orderInput();
    const order = await create(input);
    await setPurchaseStatus(db, order.id, "cancelled");
    await expect(receive(order.id)).rejects.toThrow("annulée");
  });
});

describe("listPurchaseOrders", () => {
  it("filtre par statut et recherche par référence ou fournisseur", async () => {
    const supplier = await createSupplier(db, {
      contact: null,
      country: "Chine",
      name: "Guangzhou Textile",
      notes: null,
      phone: null,
    });
    const { input } = await orderInput({ supplierId: supplier.id });
    const draft = await create(input);
    const ordered = await create({ ...input, supplierId: null });
    await setPurchaseStatus(db, ordered.id, "ordered");

    const byStatus = await listPurchaseOrders(db, { status: "ordered" });
    expect(byStatus.map((order) => order.id)).toEqual([ordered.id]);

    const bySupplier = await listPurchaseOrders(db, { search: "guangzhou" });
    expect(bySupplier.map((order) => order.id)).toEqual([draft.id]);
    expect(bySupplier[0]?.supplierName).toBe("Guangzhou Textile");
    expect(bySupplier[0]?.totalFcfa).toBe(1_147_500);
    expect(bySupplier[0]?.itemCount).toBe(2);
  });
});

describe("suppliers", () => {
  it("empêche de supprimer un fournisseur qui a des commandes", async () => {
    const supplier = await createSupplier(db, {
      contact: null,
      country: "Chine",
      name: "Yiwu Market",
      notes: null,
      phone: null,
    });
    const { input } = await orderInput({ supplierId: supplier.id });
    const order = await create(input);
    await expect(removeSupplier(db, supplier.id)).rejects.toThrow("a des commandes");

    await removePurchaseOrder(db, order.id);
    await expect(removeSupplier(db, supplier.id)).resolves.toEqual({
      id: supplier.id,
    });
  });
});

describe("commande à la tonne", () => {
  // Bon Yiwu : fil galva 800 cartons = 8 T à 4 450 RMB/T ; pointes 80 cartons = 2 T à 5 100 RMB/T.
  const tonnageInput = async (): Promise<PurchaseOrderInput> => {
    const { input, wax, bazin } = await orderInput();
    return {
      ...input,
      allocationMethod: "weight",
      freightCbm: 10,
      freightRatePerCbmFcfa: 100_000,
      items: [
        {
          pricingBasis: "weight",
          productId: wax.id,
          qty: 800,
          trips: 1,
          unitPriceRmb: 4450,
          weightTons: 8,
        },
        {
          pricingBasis: "weight",
          productId: bazin.id,
          qty: 80,
          trips: 1,
          unitPriceRmb: 5100,
          weightTons: 2,
        },
      ],
      localTransportFcfa: 0,
    };
  };

  it("enregistre le poids et réceptionne en cartons au coût de revient par carton", async () => {
    const order = await create(await tonnageInput());
    const detail = await getPurchaseOrder(db, order.id);
    expect(detail.costs.goodsRmb).toBe(45_800);
    expect(detail.costs.totalWeightTons).toBe(10);
    // Galva : 35 600 RMB = 2 956 778 FCFA + 800 000 FCFA de frais (8/10 de 1 000 000).
    expect(detail.items[0]).toMatchObject({
      pricingBasis: "weight",
      transportShareFcfa: 800_000,
      unitCostFcfa: 4696,
      weightTons: 8,
    });

    await receive(order.id);
    const lots = await db.select().from(stockLots).orderBy(asc(stockLots.id));
    expect(lots.map((lot) => [lot.qtyInitial, lot.unitCostFcfa])).toEqual([
      [800, 4696],
      [80, 13_090],
    ]);
  });

  it("exige le poids d'une ligne à la tonne ou d'une répartition au poids", async () => {
    const input = await tonnageInput();
    const [first, second] = input.items;
    if (!first || !second) {
      throw new Error("Jeu de données incomplet");
    }
    const missingWeight = purchaseOrderInputSchema.safeParse({
      ...input,
      items: [{ ...first, weightTons: null }, second],
    });
    expect(missingWeight.error?.issues[0]?.path).toEqual(["items", 0, "weightTons"]);
    expect(missingWeight.error?.issues[0]?.message).toBe(
      "Indiquez le poids pour un prix à la tonne",
    );

    const unitLineWithoutWeight = purchaseOrderInputSchema.safeParse({
      ...input,
      items: [first, { ...second, pricingBasis: "unit", weightTons: null }],
    });
    expect(unitLineWithoutWeight.error?.issues[0]?.message).toBe(
      "Poids requis pour répartir les frais au poids",
    );

    const unitOrder = purchaseOrderInputSchema.safeParse({
      ...input,
      allocationMethod: "equal",
      items: [first, { ...second, pricingBasis: "unit", weightTons: null }],
    });
    expect(unitOrder.success).toBe(true);
  });
});

describe("réception avec frais réels", () => {
  // Wax : 100 × 72 RMB (598 000 FCFA), 3 T ; Bazin : 50 × 36 RMB (149 500 FCFA), 1 T.
  const weightedOrder = async () => {
    const { input } = await orderInput();
    const [wax, bazin] = input.items;
    if (!wax || !bazin) {
      throw new Error("Jeu de données incomplet");
    }
    return create({
      ...input,
      items: [
        { ...wax, weightTons: 3 },
        { ...bazin, weightTons: 1 },
      ],
    });
  };

  const actualFees: PurchaseFeeInput[] = [
    { allocationMethod: "weight", amount: 1000, currency: "usd", label: "Fret maritime" },
    { allocationMethod: "value", amount: 200_000, currency: "fcfa", label: "Douane" },
  ];

  it("enregistre la saisie sans toucher au stock", async () => {
    const order = await weightedOrder();
    const input = await receptionInput(order.id, { fees: actualFees });
    await db.transaction((tx) =>
      saveReception(tx, {
        ...input,
        arrivedAt: APRIL_15,
        billOfLading: "MEDU1234567",
        containerNumber: "MSCU7654321",
        forwarder: "Bolloré Transit",
      }),
    );

    const detail = await getPurchaseOrder(db, order.id);
    expect(detail.status).toBe("draft");
    expect(detail).toMatchObject({
      billOfLading: "MEDU1234567",
      containerNumber: "MSCU7654321",
      forwarder: "Bolloré Transit",
    });
    // 1 000 $ × 598 = 598 000 FCFA.
    expect(detail.fees.map((fee) => [fee.label, fee.amountFcfa])).toEqual([
      ["Fret maritime", 598_000],
      ["Douane", 200_000],
    ]);
    expect(await db.select().from(stockLots)).toHaveLength(0);
  });

  it("calcule le coût de revient réel et met en stock les quantités reçues", async () => {
    const order = await weightedOrder();
    // 98 rouleaux de wax reçus sur 100 ; Bazin non livré.
    await receive(order.id, {
      fees: actualFees,
      qtyReceived: (qty, index) => (index === 0 ? 98 : 0),
    });

    const expected = computeLandedCostsFromFees({
      fees: [
        { allocationMethod: "weight", amountFcfa: 598_000 },
        { allocationMethod: "value", amountFcfa: 200_000 },
      ],
      items: [
        { qty: 100, receivedQty: 98, trips: 3, unitPriceRmb: 72, weightTons: 3 },
        { qty: 50, receivedQty: 0, trips: 1, unitPriceRmb: 36, weightTons: 1 },
      ],
      rates: { fcfaPerUsd: 598, rmbPerUsd: 7.2 },
    });
    const lots = await db.select().from(stockLots);
    expect(lots.map((lot) => [lot.qtyInitial, lot.unitCostFcfa])).toEqual([
      [98, expected.lines[0]?.unitCostFcfa],
    ]);

    const detail = await getPurchaseOrder(db, order.id);
    expect(detail.status).toBe("received");
    expect(detail.costs.totalFcfa).toBe(747_500 + 798_000);
    expect(detail.estimate.totalFcfa).toBe(1_147_500);
    expect(detail.items.map((item) => item.unitCostFcfa)).toEqual(
      expected.lines.map((line) => line.unitCostFcfa),
    );
    const [listed] = await listPurchaseOrders(db, {});
    expect(listed?.totalFcfa).toBe(747_500 + 798_000);
  });

  it("refuse une réception sans aucune quantité reçue", async () => {
    const order = await weightedOrder();
    await expect(receive(order.id, { qtyReceived: () => 0 })).rejects.toThrow(
      "Aucune quantité reçue",
    );
    const detail = await getPurchaseOrder(db, order.id);
    expect(detail.status).toBe("draft");
  });

  it("exige le poids de chaque ligne pour un frais réparti au poids", async () => {
    const { input } = await orderInput();
    const order = await create(input);
    await expect(receive(order.id, { fees: actualFees })).rejects.toThrow("Répartition au poids");
  });

  it("refuse une saisie dont les lignes ne correspondent plus à la commande", async () => {
    const order = await weightedOrder();
    const input = await receptionInput(order.id);
    await expect(
      db.transaction((tx) => saveReception(tx, { ...input, items: input.items.slice(0, 1) })),
    ).rejects.toThrow("rechargez la page");
  });
});

describe("numérotation", () => {
  it("ne réutilise jamais le numéro d'une commande supprimée", async () => {
    const { input } = await orderInput();
    const first = await create(input);
    await removePurchaseOrder(db, first.id);
    const second = await create(input);
    expect(first.reference).toBe("CF-2026-0001");
    expect(second.reference).toBe("CF-2026-0002");
  });
});
