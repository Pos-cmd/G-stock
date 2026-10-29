import type { Database } from "@G-stock/db";
import { payments } from "@G-stock/db/schema/sales";
import { stockLots, stockMovements } from "@G-stock/db/schema/stock";
import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import type { SaleInput } from "../schemas/sales";
import { useTestDatabase } from "../testing/database";
import { createCustomer, getCustomer, listCustomers, removeCustomer } from "./customers";
import { createProduct, getProduct } from "./products";
import {
  addSaleDiscount,
  cancelPayment,
  cancelSale,
  createPayment,
  createSale,
  getSale,
  listSales,
  productSalesSummary,
  quoteSale,
  salesActivity,
  salesByHour,
  salesSummary,
  salesTrends,
} from "./sales";
import { createLot } from "./stock";

let db: Database;
const getDb = useTestDatabase();
beforeEach(() => {
  db = getDb();
});

const JAN_1 = new Date(2026, 0, 1);
const FEB_1 = new Date(2026, 1, 1);
const MARCH_1 = new Date(2026, 2, 1);
const MARCH_10 = new Date(2026, 2, 10);

const newProduct = (name: string) =>
  createProduct(db, {
    alertThreshold: 0,
    category: null,
    name,
    notes: null,
    reference: null,
    referencePriceRmb: null,
    suggestedSalePriceFcfa: 1500,
    unit: "rouleau",
  });

const newCustomer = (name: string) =>
  createCustomer(db, { address: null, name, notes: null, phone: null });

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

/** Wax : 5 rouleaux à 1 000 (janvier) puis 10 à 1 200 (février). */
const setup = async () => {
  const wax = await newProduct("Wax");
  const bazin = await newProduct("Bazin");
  const oldLot = await entry(wax.id, 5, 1000, JAN_1);
  const newLot = await entry(wax.id, 10, 1200, FEB_1);
  await entry(bazin.id, 20, 500, JAN_1);
  const awa = await newCustomer("Awa");
  const moussa = await newCustomer("Moussa");
  return { awa, bazin, moussa, newLot, oldLot, wax };
};

const sell = (input: Partial<SaleInput> & Pick<SaleInput, "customerId" | "lines">) =>
  db.transaction((tx) =>
    createSale(tx, {
      notes: null,
      paidFcfa: 0,
      paymentMethod: "cash",
      paymentType: "cash",
      saleDate: MARCH_1,
      ...input,
    }),
  );

const stockOf = async (productId: number) => {
  const product = await getProduct(db, productId);
  return product.stockQty;
};

const saleDue = async (saleId: number) => {
  const sale = await getSale(db, saleId);
  return sale.summary.dueFcfa;
};

const lotQty = async (lotId: number) => {
  const [lot] = await db.select().from(stockLots).where(eq(stockLots.id, lotId));
  return lot?.qtyRemaining;
};

describe("createSale", () => {
  it("sort le stock en FIFO, fige le coût et encaisse le comptant", async () => {
    const { awa, oldLot, newLot, wax } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 8, unitPriceFcfa: 1500 }],
    });
    expect(sale.reference).toBe("V-2026-00001");

    const detail = await getSale(db, sale.id);
    // 5 × 1 000 + 3 × 1 200 = 8 600 de coût pour 12 000 de vente.
    expect(detail.items[0]?.costFcfa).toBe(8600);
    expect(detail.items[0]?.lots.map((lot) => [lot.lotId, lot.qty])).toEqual([
      [oldLot.id, 5],
      [newLot.id, 3],
    ]);
    expect(detail.summary).toMatchObject({
      dueFcfa: 0,
      marginFcfa: 3400,
      netFcfa: 12_000,
      paidFcfa: 12_000,
    });
    expect(await lotQty(oldLot.id)).toBe(0);
    expect(await lotQty(newLot.id)).toBe(7);

    const movements = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.referenceType, "sale"));
    expect(movements.map((movement) => movement.qty)).toEqual([-5, -3]);
    expect(await stockOf(wax.id)).toBe(7);
  });

  it("enregistre une vente à crédit avec acompte", async () => {
    const { awa, wax } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 4, unitPriceFcfa: 1500 }],
      paidFcfa: 2000,
      paymentType: "credit",
    });
    const detail = await getSale(db, sale.id);
    expect(detail.summary).toMatchObject({ dueFcfa: 4000, paidFcfa: 2000 });
    const customer = await getCustomer(db, awa.id);
    expect(customer.dueFcfa).toBe(4000);
    expect(customer.oldestUnpaidDate).toEqual(MARCH_1);
  });

  it("n'écrit rien si le stock d'un produit ne suffit pas", async () => {
    const { awa, bazin, oldLot, wax } = await setup();
    await expect(
      sell({
        customerId: awa.id,
        lines: [
          { productId: bazin.id, qty: 2, unitPriceFcfa: 800 },
          { productId: wax.id, qty: 50, unitPriceFcfa: 1500 },
        ],
      }),
    ).rejects.toThrow("Wax — Stock insuffisant");
    expect(await lotQty(oldLot.id)).toBe(5);
    expect(await stockOf(bazin.id)).toBe(20);
    expect(await listSales(db, { page: 1, pageSize: 25 })).toMatchObject({
      total: 0,
    });
  });

  it("refuse un acompte supérieur au total", async () => {
    const { awa, wax } = await setup();
    await expect(
      sell({
        customerId: awa.id,
        lines: [{ productId: wax.id, qty: 1, unitPriceFcfa: 1500 }],
        paidFcfa: 5000,
        paymentType: "credit",
      }),
    ).rejects.toThrow("L'acompte dépasse");
  });
});

describe("quoteSale", () => {
  it("prévoit le coût FIFO, ligne après ligne, sans rien écrire", async () => {
    const { oldLot, wax } = await setup();
    const quote = await quoteSale(db, [
      { productId: wax.id, qty: 4 },
      { productId: wax.id, qty: 4 },
      { productId: wax.id, qty: 10 },
    ]);
    expect(quote.map((line) => [line.costFcfa, line.missingQty])).toEqual([
      [4000, 0],
      // 1 × 1 000 + 3 × 1 200
      [4600, 0],
      [8400, 3],
    ]);
    expect(await lotQty(oldLot.id)).toBe(5);
  });
});

describe("annulation et remise", () => {
  it("annule une vente : stock remis dans ses lots, paiements annulés, trace conservée", async () => {
    const { awa, oldLot, newLot, wax } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 8, unitPriceFcfa: 1500 }],
    });
    const result = await db.transaction((tx) =>
      cancelSale(tx, { id: sale.id, reason: "Erreur de saisie" }),
    );
    expect(result.cancelledPaymentsFcfa).toBe(12_000);
    expect(await lotQty(oldLot.id)).toBe(5);
    expect(await lotQty(newLot.id)).toBe(10);

    const detail = await getSale(db, sale.id);
    expect(detail.status).toBe("cancelled");
    expect(detail.cancelReason).toBe("Erreur de saisie");
    expect(detail.payments.every((payment) => payment.cancelledAt !== null)).toBe(true);
    const customer = await getCustomer(db, awa.id);
    expect(customer).toMatchObject({
      creditFcfa: 0,
      dueFcfa: 0,
      purchasedFcfa: 0,
    });

    await expect(
      db.transaction((tx) => cancelSale(tx, { id: sale.id, reason: "Encore" })),
    ).rejects.toThrow("annulée");
  });

  it("trace une remise après la vente et en tient compte dans le solde", async () => {
    const { awa, wax } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 4, unitPriceFcfa: 1500 }],
      paymentType: "credit",
    });
    await addSaleDiscount(db, {
      amountFcfa: 1000,
      discountDate: MARCH_10,
      reason: "Geste commercial",
      saleId: sale.id,
    });
    const detail = await getSale(db, sale.id);
    expect(detail.summary).toMatchObject({
      discountFcfa: 1000,
      dueFcfa: 5000,
      netFcfa: 5000,
    });
    expect(detail.discounts[0]?.reason).toBe("Geste commercial");

    await expect(
      addSaleDiscount(db, {
        amountFcfa: 6000,
        discountDate: MARCH_10,
        reason: "Trop",
        saleId: sale.id,
      }),
    ).rejects.toThrow("dépasse le montant net");
  });

  it("transforme en avoir une remise accordée sur une vente déjà payée", async () => {
    const { awa, wax } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 2, unitPriceFcfa: 1500 }],
    });
    await addSaleDiscount(db, {
      amountFcfa: 500,
      discountDate: MARCH_10,
      reason: "Rouleau abîmé",
      saleId: sale.id,
    });
    const customer = await getCustomer(db, awa.id);
    expect(customer).toMatchObject({ creditFcfa: 500, dueFcfa: 0 });
  });
});

describe("paiements", () => {
  it("solde d'abord les ventes les plus anciennes, et se retire à l'annulation", async () => {
    const { awa, bazin } = await setup();
    const first = await sell({
      customerId: awa.id,
      lines: [{ productId: bazin.id, qty: 2, unitPriceFcfa: 1000 }],
      paymentType: "credit",
      saleDate: FEB_1,
    });
    const second = await sell({
      customerId: awa.id,
      lines: [{ productId: bazin.id, qty: 3, unitPriceFcfa: 1000 }],
      paymentType: "credit",
    });
    const payment = await createPayment(db, {
      amountFcfa: 2500,
      customerId: awa.id,
      method: "mobile_money",
      notes: null,
      paymentDate: MARCH_10,
      saleId: null,
    });
    expect(await saleDue(first.id)).toBe(0);
    expect(await saleDue(second.id)).toBe(2500);

    if (!payment) {
      throw new Error("Paiement non créé");
    }
    await cancelPayment(db, { id: payment.id, reason: "Doublon" });
    const afterCancel = await getCustomer(db, awa.id);
    expect(afterCancel.dueFcfa).toBe(5000);
  });

  it("refuse un paiement sur la vente d'un autre client", async () => {
    const { awa, moussa, bazin } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [{ productId: bazin.id, qty: 1, unitPriceFcfa: 1000 }],
      paymentType: "credit",
    });
    await expect(
      createPayment(db, {
        amountFcfa: 1000,
        customerId: moussa.id,
        method: "cash",
        notes: null,
        paymentDate: MARCH_10,
        saleId: sale.id,
      }),
    ).rejects.toThrow("autre client");
    const rows = await db.select().from(payments).orderBy(asc(payments.id));
    expect(rows).toHaveLength(0);
  });
});

/** Awa : une vente comptant en février, une à crédit en mars ; Moussa : une vente en mars. */
const seedHistory = async () => {
  const context = await setup();
  const { awa, moussa, bazin, wax } = context;
  await sell({
    customerId: awa.id,
    lines: [
      { productId: wax.id, qty: 2, unitPriceFcfa: 1500 },
      { productId: bazin.id, qty: 4, unitPriceFcfa: 800 },
    ],
    saleDate: FEB_1,
  });
  await sell({
    customerId: awa.id,
    lines: [{ productId: bazin.id, qty: 6, unitPriceFcfa: 750 }],
    paymentType: "credit",
  });
  await sell({
    customerId: moussa.id,
    lines: [{ productId: wax.id, qty: 1, unitPriceFcfa: 1600 }],
    saleDate: MARCH_10,
  });
  return context;
};

describe("historique et fiche client", () => {
  it("filtre par client, produit, période et état de paiement", async () => {
    const { awa, bazin } = await seedHistory();
    const byCustomer = await listSales(db, {
      customerId: awa.id,
      page: 1,
      pageSize: 25,
    });
    expect(byCustomer.total).toBe(2);
    // 3 000 + 3 200 + 4 500
    expect(byCustomer.totals.netFcfa).toBe(10_700);
    expect(byCustomer.totals.dueFcfa).toBe(4500);

    const byProduct = await listSales(db, {
      page: 1,
      pageSize: 25,
      productId: bazin.id,
    });
    expect(byProduct.items.map((sale) => sale.customerName)).toEqual(["Awa", "Awa"]);

    const inMarch = await listSales(db, {
      from: MARCH_1,
      page: 1,
      pageSize: 25,
      to: MARCH_10,
    });
    expect(inMarch.total).toBe(2);

    const due = await listSales(db, {
      page: 1,
      pageSize: 25,
      paymentState: "due",
    });
    expect(due.items.map((sale) => sale.reference)).toEqual(["V-2026-00002"]);
    expect(due.items[0]?.lines.map((line) => line.productName)).toEqual(["Bazin"]);
  });

  it("résume les achats d'un client produit par produit", async () => {
    const { awa } = await seedHistory();
    const summary = await productSalesSummary(db, { customerId: awa.id });
    expect(
      summary.map((row) => [row.productName, row.qty, row.revenueFcfa, row.saleCount]),
    ).toEqual([
      ["Bazin", 10, 7700, 2],
      ["Wax", 2, 3000, 1],
    ]);
    expect(summary[0]?.averagePriceFcfa).toBe(770);
  });

  it("liste les débiteurs, les plus grosses dettes d'abord", async () => {
    const { awa, moussa } = await seedHistory();
    const debtors = await listCustomers(db, { withDebtOnly: true });
    expect(debtors.map((customer) => customer.name)).toEqual(["Awa"]);
    expect(debtors[0]?.dueFcfa).toBe(4500);
    await expect(removeCustomer(db, moussa.id)).rejects.toThrow("historique de ventes");
    const awaAccount = await getCustomer(db, awa.id);
    expect(awaAccount.saleCount).toBe(2);
  });

  it("calcule les chiffres du tableau de bord", async () => {
    await seedHistory();
    const summary = await salesSummary(db, new Date(2026, 2, 10, 18));
    expect(summary.revenue).toEqual({ day: 1600, month: 6100, week: 1600 });
    expect(summary.receivablesFcfa).toBe(4500);
    expect(summary.debtorCount).toBe(1);
    expect(summary.topProducts[0]?.productName).toBe("Bazin");
  });

  it("donne les ventes jour par jour, jours vides compris", async () => {
    await seedHistory();
    const days = await salesActivity(db, 10, {}, new Date(2026, 2, 10, 18));
    expect(days).toHaveLength(10);
    expect(days[0]).toEqual({
      date: "2026-03-01",
      marginFcfa: 1500,
      qty: 0,
      revenueFcfa: 4500,
      saleCount: 1,
    });
    expect(days.at(-1)).toMatchObject({ date: "2026-03-10", revenueFcfa: 1600, saleCount: 1 });
    expect(days.slice(1, -1).every((day) => day.saleCount === 0)).toBe(true);
  });

  it("filtre l'activité par produit et par client", async () => {
    const { bazin, moussa } = await seedHistory();
    const march = new Date(2026, 2, 10, 18);
    const bazinDays = await salesActivity(db, 10, { productId: bazin.id }, march);
    expect(bazinDays[0]).toMatchObject({ qty: 6, revenueFcfa: 4500, saleCount: 1 });
    expect(bazinDays.at(-1)?.saleCount).toBe(0);
    const moussaDays = await salesActivity(db, 10, { customerId: moussa.id }, march);
    expect(moussaDays.filter((day) => day.saleCount > 0).map((day) => day.date)).toEqual([
      "2026-03-10",
    ]);
  });

  it("donne la tendance par produit et par client, semaine par semaine", async () => {
    const { awa, bazin, moussa } = await seedHistory();
    const march10 = new Date(2026, 2, 10, 18);
    // 2 semaines : du 25 février au 10 mars, et les 2 semaines d'avant.
    const byProduct = await salesTrends(db, "product", 2, march10);
    const bazinTrend = byProduct.find((row) => row.id === bazin.id);
    expect(bazinTrend?.current).toEqual([4500, 0]);
    expect(bazinTrend?.currentQty).toBe(6);
    const byCustomer = await salesTrends(db, "customer", 2, march10);
    expect(byCustomer.find((row) => row.id === moussa.id)?.current).toEqual([0, 1600]);
    expect(byCustomer.find((row) => row.id === awa.id)?.currentQty).toBe(1);
  });

  it("répartit les ventes du jour et de la veille heure par heure", async () => {
    await seedHistory();
    // Le 10 mars : la vente de Moussa ; le 1er mars, veille du 2, n'en compte qu'une.
    const march10 = await salesByHour(db, new Date(2026, 2, 10, 18));
    expect(march10.today).toHaveLength(24);
    expect(march10.todayCount).toBe(1);
    expect(march10.today.reduce((sum, value) => sum + value, 0)).toBe(1600);
    const march2 = await salesByHour(db, new Date(2026, 2, 2, 9));
    expect(march2.todayCount).toBe(0);
    expect(march2.yesterday.reduce((sum, value) => sum + value, 0)).toBe(4500);
  });
});
