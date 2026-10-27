import type { Database } from "@G-stock/db";
import { stockLots, stockMovements } from "@G-stock/db/schema/stock";
import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import type { PurchaseOrderInput } from "../schemas/purchases";
import { useTestDatabase } from "../testing/database";
import { createProduct, getProduct, setProductArchived } from "./products";
import {
  createPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  receivePurchaseOrder,
  removePurchaseOrder,
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

const receive = (id: number) =>
  db.transaction((tx) => receivePurchaseOrder(tx, { id, receivedAt: APRIL_15 }));

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
