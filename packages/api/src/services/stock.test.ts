import type { Database } from "@G-stock/db";
import { stockLots, stockMovements } from "@G-stock/db/schema/stock";
import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { useTestDatabase } from "../testing/database";
import {
  createProduct,
  getProduct,
  getStockSummary,
  setProductArchived,
  updateProduct,
} from "./products";
import { getSettings } from "./settings";
import {
  adjustLot,
  buildLotCode,
  consumeFifo,
  createLot,
  listLots,
  listMovements,
  unpackProduct,
} from "./stock";

let db: Database;

const JAN_1 = new Date(2026, 0, 1);
const FEB_1 = new Date(2026, 1, 1);

const newProduct = (name: string, alertThreshold = 0) =>
  createProduct(db, {
    alertThreshold,
    category: "Textile",
    name,
    notes: null,
    reference: null,
    referencePriceRmb: null,
    suggestedSalePriceFcfa: null,
    unit: "rouleau",
  });

const entry = (productId: number, qty: number, unitCostFcfa: number, receivedAt: Date) =>
  db.transaction((tx) =>
    createLot(tx, {
      productId,
      qty,
      receivedAt,
      source: "initial",
      unitCostFcfa,
    }),
  );

const getDb = useTestDatabase();
beforeEach(() => {
  db = getDb();
});

describe("migrations", () => {
  it("insère les taux de change par défaut", async () => {
    const settings = await getSettings(db);
    expect(settings.rmbPerUsd).toBe(7.2);
    expect(settings.fcfaPerUsd).toBe(598);
  });
});

describe("createLot", () => {
  it("crée le lot, son code et un mouvement d'entrée", async () => {
    const product = await newProduct("Tissu wax");
    const lot = await entry(product.id, 10, 1500, JAN_1);

    expect(lot.lotCode).toBe(buildLotCode(JAN_1, lot.id));
    // Suffixe tiré de la partie aléatoire de l'UUID : pas de compteur.
    expect(lot.lotCode).toMatch(/^LOT-20260101-[\dA-F]{6}$/u);
    expect(lot.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-7/u);
    expect(lot.qtyRemaining).toBe(10);

    const movements = await db.select().from(stockMovements);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      lotId: lot.id,
      qty: 10,
      type: "in",
      unitCostFcfa: 1500,
    });
  });

  it("refuse un produit archivé", async () => {
    const product = await newProduct("Ancien produit");
    await setProductArchived(db, product.id, true);
    await expect(entry(product.id, 1, 100, JAN_1)).rejects.toThrow(/archivé/u);
  });
});

describe("adjustLot", () => {
  it("met à jour la quantité et trace l'écart signé", async () => {
    const product = await newProduct("Fil");
    const lot = await entry(product.id, 10, 200, JAN_1);

    const result = await db.transaction((tx) =>
      adjustLot(tx, { lotId: lot.id, newQty: 7.5, reason: "Inventaire" }),
    );

    expect(result.delta).toBe(-2.5);
    const [updated] = await db.select().from(stockLots).where(eq(stockLots.id, lot.id));
    expect(updated?.qtyRemaining).toBe(7.5);
    const movements = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.type, "adjustment"));
    expect(movements[0]?.qty).toBe(-2.5);
  });

  it("refuse une quantité négative ou un motif vide", async () => {
    const product = await newProduct("Bouton");
    const lot = await entry(product.id, 5, 50, JAN_1);

    await expect(adjustLot(db, { lotId: lot.id, newQty: -1, reason: "Casse" })).rejects.toThrow();
    await expect(adjustLot(db, { lotId: lot.id, newQty: 3, reason: "  " })).rejects.toThrow();
  });
});

describe("consumeFifo", () => {
  it("prélève d'abord sur le lot le plus ancien", async () => {
    const product = await newProduct("Tissu bazin");
    // Le lot le plus récent est saisi en premier pour vérifier le tri par date de réception.
    const recent = await entry(product.id, 10, 2000, FEB_1);
    const old = await entry(product.id, 4, 1000, JAN_1);

    const allocations = await db.transaction((tx) =>
      consumeFifo(tx, { productId: product.id, qty: 6, referenceType: "sale" }),
    );

    expect(allocations).toEqual([
      { lotId: old.id, qty: 4, unitCostFcfa: 1000 },
      { lotId: recent.id, qty: 2, unitCostFcfa: 2000 },
    ]);
    const lots = await db.select().from(stockLots).orderBy(asc(stockLots.id));
    expect(lots.map((lot) => lot.qtyRemaining)).toEqual([8, 0]);
    const outs = await db.select().from(stockMovements).where(eq(stockMovements.type, "out"));
    expect(outs.map((movement) => movement.qty)).toEqual([-4, -2]);
  });

  it("n'écrit rien si le stock est insuffisant", async () => {
    const product = await newProduct("Perles");
    await entry(product.id, 3, 100, JAN_1);

    await expect(
      consumeFifo(db, { productId: product.id, qty: 5, referenceType: "sale" }),
    ).rejects.toThrow(/Stock insuffisant/u);

    const [lot] = await db.select().from(stockLots);
    expect(lot?.qtyRemaining).toBe(3);
    const outs = await db.select().from(stockMovements).where(eq(stockMovements.type, "out"));
    expect(outs).toHaveLength(0);
  });
});

describe("statistiques de stock", () => {
  it("calcule quantité, valeur, coût moyen pondéré et statut", async () => {
    const product = await newProduct("Dentelle", 20);
    await entry(product.id, 10, 1000, JAN_1);
    await entry(product.id, 5, 2500, FEB_1);

    const stats = await getProduct(db, product.id);
    expect(stats.stockQty).toBe(15);
    expect(stats.stockValueFcfa).toBe(22_500);
    expect(stats.averageCostFcfa).toBe(1500);
    expect(stats.status).toBe("low");

    await newProduct("Sans stock");
    const summary = await getStockSummary(db);
    expect(summary).toEqual({
      lowCount: 1,
      outCount: 1,
      productCount: 2,
      stockValueFcfa: 22_500,
    });
  });
});

describe("unpackProduct (ouverture de cartons)", () => {
  const galva = async (piecesPerUnit: number | null) => {
    const product = await createProduct(db, {
      alertThreshold: 0,
      category: "Quincaillerie",
      name: "Fil galva",
      notes: null,
      piecesPerUnit,
      reference: null,
      referencePriceRmb: null,
      suggestedSalePriceFcfa: 11_500,
      unit: "carton",
    });
    // Deux lots de cartons à des coûts différents : l'ouverture suit le FIFO.
    await entry(product.id, 1, 8864, JAN_1);
    await entry(product.id, 10, 9000, FEB_1);
    return product;
  };
  const unpack = (productId: string, qty: number) =>
    db.transaction((tx) => unpackProduct(tx, { productId, qty }));

  it("sort les cartons en FIFO et crée les pièces au coût du carton divisé", async () => {
    const product = await galva(5);
    const result = await unpack(product.id, 2);
    expect(result).toMatchObject({
      lotCount: 2,
      pieceCount: 10,
      pieceProductName: "Fil galva (pièce)",
    });

    const piece = await getProduct(db, result.pieceProductId);
    expect(piece.unit).toBe("pièce");
    expect(piece.category).toBe("Quincaillerie");
    expect(piece.suggestedSalePriceFcfa).toBe(2300);
    expect(piece.stockQty).toBe(10);
    // 8 864 / 5 = 1 772,8 → 1 773 ; 9 000 / 5 = 1 800.
    const pieceLots = await listLots(db, piece.id, true);
    const byCost = pieceLots.toSorted((a, b) => a.unitCostFcfa - b.unitCostFcfa);
    expect(byCost.map((lot) => [lot.qtyInitial, lot.unitCostFcfa, lot.source])).toEqual([
      [5, 1773, "unpack"],
      [5, 1800, "unpack"],
    ]);
    expect(piece.packProducts).toEqual([
      { id: product.id, name: "Fil galva", piecesPerUnit: 5, unit: "carton" },
    ]);

    const pack = await getProduct(db, product.id);
    expect(pack.stockQty).toBe(9);
    expect(pack.pieceProduct?.id).toBe(piece.id);

    const out = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.productId, product.id));
    expect(out.filter((movement) => movement.referenceType === "unpack")).toHaveLength(2);
  });

  it("réutilise le produit pièce aux ouvertures suivantes", async () => {
    const product = await galva(5);
    const first = await unpack(product.id, 1);
    const second = await unpack(product.id, 1);
    expect(second.pieceProductId).toBe(first.pieceProductId);
    const piece = await getProduct(db, first.pieceProductId);
    expect(piece.stockQty).toBe(10);
  });

  it("exige le nombre de pièces et assez de cartons", async () => {
    const product = await galva(null);
    await expect(unpack(product.id, 1)).rejects.toThrow("nombre de pièces");

    await updateProduct(db, product.id, {
      alertThreshold: 0,
      category: "Quincaillerie",
      name: "Fil galva",
      notes: null,
      piecesPerUnit: 10,
      reference: null,
      referencePriceRmb: null,
      suggestedSalePriceFcfa: null,
      unit: "carton",
    });
    await expect(unpack(product.id, 12)).rejects.toThrow("Stock insuffisant");
    // Tout ou rien : ni produit pièce, ni sortie de cartons.
    const pack = await getProduct(db, product.id);
    expect(pack.stockQty).toBe(11);
    expect(pack.pieceProduct).toBeNull();
  });
});

describe("date de l'operation", () => {
  it("date l'entree d'un lot au jour de sa reception", async () => {
    const product = await newProduct("Tissu");
    await entry(product.id, 3, 1000, JAN_1);

    const [movement] = await db.select().from(stockMovements);
    expect(movement?.occurredAt).toEqual(JAN_1);
    // La date d'enregistrement reste celle de la saisie.
    expect(movement?.createdAt.getTime()).toBeGreaterThan(JAN_1.getTime());
  });

  it("date un ajustement au jour choisi", async () => {
    const product = await newProduct("Fil");
    const lot = await entry(product.id, 10, 200, JAN_1);

    await db.transaction((tx) =>
      adjustLot(tx, { lotId: lot.id, newQty: 8, occurredAt: FEB_1, reason: "Inventaire" }),
    );

    const [movement] = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.type, "adjustment"));
    expect(movement?.occurredAt).toEqual(FEB_1);
  });

  it("filtre sur la date de l'operation, pas sur celle de la saisie", async () => {
    const product = await newProduct("Bazin");
    const lot = await entry(product.id, 10, 1000, JAN_1);
    await db.transaction((tx) =>
      adjustLot(tx, { lotId: lot.id, newQty: 9, occurredAt: FEB_1, reason: "Casse" }),
    );

    const january = await listMovements(db, { from: JAN_1, page: 1, pageSize: 25, to: JAN_1 });
    expect(january.items.map((item) => item.type)).toEqual(["in"]);

    const february = await listMovements(db, { from: FEB_1, page: 1, pageSize: 25, to: FEB_1 });
    expect(february.items.map((item) => item.type)).toEqual(["adjustment"]);

    const all = await listMovements(db, { page: 1, pageSize: 25 });
    expect(all.total).toBe(2);
  });

  it("ne nomme aucun tiers pour un ajustement manuel", async () => {
    const product = await newProduct("Bouton");
    const lot = await entry(product.id, 4, 100, JAN_1);
    await db.transaction((tx) =>
      adjustLot(tx, { lotId: lot.id, newQty: 3, reason: "Casse" }),
    );

    const { items } = await listMovements(db, { page: 1, pageSize: 25 });
    expect(items.every((item) => item.party === null)).toBe(true);
  });
});
