import type { Database } from "@G-stock/db";
import { payments } from "@G-stock/db/schema/sales";
import { stockLots, stockMovements } from "@G-stock/db/schema/stock";
import { and, asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import type {
  SaleInput,
  SaleReturnInput,
  SaleUpdateInput,
} from "../schemas/sales";
import { useTestDatabase } from "../testing/database";
import {
  createCustomer,
  getCustomer,
  listCustomers,
  removeCustomer,
} from "./customers";
import { createProduct, getProduct } from "./products";
import {
  addSaleDiscount,
  cancelPayment,
  cancelSale,
  createPayment,
  createSale,
  createSaleReturn,
  getSale,
  listPayments,
  listSales,
  paymentsLedger,
  productSalesSummary,
  quoteSale,
  salesActivity,
  salesByHour,
  salesSummary,
  salesTrends,
  updatePayment,
  updateSale,
} from "./sales";
import { createLot, listMovements } from "./stock";

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

const entry = (
  productId: number,
  qty: number,
  unitCostFcfa: number,
  receivedAt: Date
) =>
  db.transaction((tx) =>
    createLot(tx, {
      productId,
      qty,
      receivedAt,
      source: "initial",
      unitCostFcfa,
    })
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

const sell = (
  input: Partial<SaleInput> & Pick<SaleInput, "customerId" | "lines">
) =>
  db.transaction((tx) =>
    createSale(tx, {
      notes: null,
      paidFcfa: 0,
      paymentMethod: "cash",
      paymentType: "cash",
      saleDate: MARCH_1,
      ...input,
    })
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
  const [lot] = await db
    .select()
    .from(stockLots)
    .where(eq(stockLots.id, lotId));
  return lot?.qtyRemaining;
};

/** Somme des quantités d'un sens de mouvement : le total des deux doit valoir le stock restant. */
const movementQty = async (lotId: number, type: "in" | "out") => {
  const rows = await db
    .select()
    .from(stockMovements)
    .where(and(eq(stockMovements.lotId, lotId), eq(stockMovements.type, type)));
  return rows.reduce((sum, row) => sum + row.qty, 0);
};

/** Le stock restant d'un lot doit toujours se lire dans son historique de mouvements. */
const expectHistoryMatchesStock = async (lotId: number) => {
  const entree = await movementQty(lotId, "in");
  const sortie = await movementQty(lotId, "out");
  expect(entree + sortie).toBe(await lotQty(lotId));
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
      })
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
      })
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
      cancelSale(tx, { id: sale.id, reason: "Erreur de saisie" })
    );
    expect(result.cancelledPaymentsFcfa).toBe(12_000);
    expect(await lotQty(oldLot.id)).toBe(5);
    expect(await lotQty(newLot.id)).toBe(10);

    const detail = await getSale(db, sale.id);
    expect(detail.status).toBe("cancelled");
    expect(detail.cancelReason).toBe("Erreur de saisie");
    expect(
      detail.payments.every((payment) => payment.cancelledAt !== null)
    ).toBe(true);
    const customer = await getCustomer(db, awa.id);
    expect(customer).toMatchObject({
      creditFcfa: 0,
      dueFcfa: 0,
      purchasedFcfa: 0,
    });

    await expect(
      db.transaction((tx) => cancelSale(tx, { id: sale.id, reason: "Encore" }))
    ).rejects.toThrow("annulée");
  });

  it("annule une vente : l'historique ne rend que la quantité vendue", async () => {
    const { awa, oldLot, newLot, wax } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 8, unitPriceFcfa: 1500 }],
    });
    await db.transaction((tx) =>
      cancelSale(tx, { id: sale.id, reason: "Erreur de saisie" })
    );

    // 5 sortis du lot de janvier puis 3 du lot de février : l'annulation rend exactement cela.
    expect(await movementQty(oldLot.id, "in")).toBe(10);
    expect(await movementQty(newLot.id, "in")).toBe(13);
    await expectHistoryMatchesStock(oldLot.id);
    await expectHistoryMatchesStock(newLot.id);
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
      })
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

  it("dit quelles ventes chaque paiement a reglees", async () => {
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
    await createPayment(db, {
      amountFcfa: 2500,
      customerId: awa.id,
      method: "mobile_money",
      notes: null,
      paymentDate: MARCH_10,
      saleId: null,
    });

    const rows = await listPayments(db, awa.id);
    expect(rows).toHaveLength(1);
    // 2 000 soldent la vente de fevrier, 500 entament celle de mars.
    expect(rows[0]?.coveredSales).toEqual([
      { amountFcfa: 2000, reference: first.reference, saleId: first.id },
      { amountFcfa: 500, reference: second.reference, saleId: second.id },
    ]);
  });

  it("regroupe les paiements par jour avec les ventes soldees", async () => {
    const { awa, bazin } = await setup();
    const first = await sell({
      customerId: awa.id,
      lines: [{ productId: bazin.id, qty: 2, unitPriceFcfa: 1000 }],
      paymentType: "credit",
      saleDate: FEB_1,
    });
    await createPayment(db, {
      amountFcfa: 1500,
      customerId: awa.id,
      method: "cash",
      notes: null,
      paymentDate: MARCH_10,
      saleId: null,
    });
    await createPayment(db, {
      amountFcfa: 500,
      customerId: awa.id,
      method: "mobile_money",
      notes: "Wave",
      paymentDate: MARCH_10,
      saleId: null,
    });

    const ledger = await paymentsLedger(db, {
      customerId: awa.id,
      months: 12,
    });
    expect(ledger.days).toHaveLength(1);
    const [day] = ledger.days;
    // Un seul jour, deux paiements, un seul lien vers la vente soldee.
    expect(day?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(day?.paidFcfa).toBe(2000);
    expect(day?.payments.map((payment) => payment.method).toSorted()).toEqual([
      "cash",
      "mobile_money",
    ]);
    expect(day?.sales).toEqual([
      { amountFcfa: 2000, reference: first.reference, saleId: first.id },
    ]);
    expect(ledger.totals).toMatchObject({ count: 2, paidFcfa: 2000 });
    // Le calendrier part du debut du mois il y a 12 mois et va jusqu'a aujourd'hui.
    expect(ledger.heatmap.at(-1)?.value).toBe(0);
    expect(ledger.heatmap.length).toBeGreaterThan(300);
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
      })
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
    expect(byProduct.items.map((sale) => sale.customerName)).toEqual([
      "Awa",
      "Awa",
    ]);

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
    expect(due.items[0]?.lines.map((line) => line.productName)).toEqual([
      "Bazin",
    ]);
  });

  it("résume les achats d'un client produit par produit", async () => {
    const { awa } = await seedHistory();
    const summary = await productSalesSummary(db, { customerId: awa.id });
    expect(
      summary.map((row) => [
        row.productName,
        row.qty,
        row.revenueFcfa,
        row.saleCount,
      ])
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
    await expect(removeCustomer(db, moussa.id)).rejects.toThrow(
      "historique de ventes"
    );
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
    expect(days.at(-1)).toMatchObject({
      date: "2026-03-10",
      revenueFcfa: 1600,
      saleCount: 1,
    });
    expect(days.slice(1, -1).every((day) => day.saleCount === 0)).toBe(true);
  });

  it("trie l'historique côté serveur sans changer les totaux", async () => {
    await seedHistory();
    const byDate = await listSales(db, { page: 1, pageSize: 25 });
    const byAmount = await listSales(db, {
      page: 1,
      pageSize: 25,
      sort: { desc: false, id: "netFcfa" },
    });
    expect(byAmount.items.map((sale) => sale.netFcfa)).toEqual(
      byDate.items.map((sale) => sale.netFcfa).toSorted((a, b) => a - b)
    );
    expect(byAmount.totals).toEqual(byDate.totals);
    expect(byAmount.total).toBe(3);
  });

  it("met à jour les comptes gardés en mémoire après une annulation", async () => {
    await seedHistory();
    const before = await listSales(db, { page: 1, pageSize: 25 });
    expect(before.totals.dueFcfa).toBe(4500);
    const credit = before.items.find((sale) => sale.dueFcfa > 0);
    if (!credit) {
      throw new Error("Vente à crédit introuvable");
    }
    await db.transaction((tx) =>
      cancelSale(tx, { id: credit.id, reason: "Erreur de saisie" })
    );
    const after = await listSales(db, { page: 1, pageSize: 25 });
    expect(after.totals.dueFcfa).toBe(0);
  });

  it("filtre l'activité par produit et par client", async () => {
    const { bazin, moussa } = await seedHistory();
    const march = new Date(2026, 2, 10, 18);
    const bazinDays = await salesActivity(
      db,
      10,
      { productId: bazin.id },
      march
    );
    expect(bazinDays[0]).toMatchObject({
      qty: 6,
      revenueFcfa: 4500,
      saleCount: 1,
    });
    expect(bazinDays.at(-1)?.saleCount).toBe(0);
    const moussaDays = await salesActivity(
      db,
      10,
      { customerId: moussa.id },
      march
    );
    expect(
      moussaDays.filter((day) => day.saleCount > 0).map((day) => day.date)
    ).toEqual(["2026-03-10"]);
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
    expect(byCustomer.find((row) => row.id === moussa.id)?.current).toEqual([
      0, 1600,
    ]);
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

describe("mouvements de vente", () => {
  it("date la sortie au jour de la vente, pas au jour de la saisie", async () => {
    const { awa, wax } = await setup();
    await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 3, unitPriceFcfa: 1500 }],
      saleDate: JAN_1,
    });

    const { items } = await listMovements(db, {
      from: JAN_1,
      page: 1,
      pageSize: 25,
      to: JAN_1,
      type: "out",
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.occurredAt).toEqual(JAN_1);
  });

  it("nomme le client concerne et le retrouve par la recherche", async () => {
    const { awa, moussa, wax } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 3, unitPriceFcfa: 1500 }],
      saleDate: JAN_1,
    });
    await sell({
      customerId: moussa.id,
      lines: [{ productId: wax.id, qty: 2, unitPriceFcfa: 1500 }],
      saleDate: FEB_1,
    });

    const { items } = await listMovements(db, {
      from: JAN_1,
      page: 1,
      pageSize: 25,
      to: JAN_1,
      type: "out",
    });
    expect(items[0]?.party).toEqual({
      id: sale.id,
      kind: "customer",
      name: "Awa",
    });

    const { items: found } = await listMovements(db, {
      page: 1,
      pageSize: 25,
      search: "moussa",
      type: "out",
    });
    expect(found).toHaveLength(1);
    expect(found[0]?.party?.name).toBe("Moussa");

    const { items: none } = await listMovements(db, {
      page: 1,
      pageSize: 25,
      search: "awa",
      type: "in",
    });
    expect(none).toHaveLength(0);
  });
});

describe("modification d'une vente", () => {
  const update = (
    input: Omit<SaleUpdateInput, "notes" | "reason"> & { reason?: string }
  ) =>
    db.transaction((tx) =>
      updateSale(tx, {
        notes: null,
        reason: "oubli",
        ...input,
      })
    );

  it("ajoute une ligne oubliée et prélève le stock en FIFO", async () => {
    const { awa, bazin, oldLot, wax } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 3, unitPriceFcfa: 1500 }],
    });
    const detail = await getSale(db, sale.id);
    const line = detail.items[0];

    await update({
      id: sale.id,
      items: [
        {
          id: line?.id,
          productId: wax.id,
          qty: 3,
          unitPriceFcfa: 1500,
        },
        { productId: bazin.id, qty: 2, unitPriceFcfa: 800 },
      ],
      saleDate: MARCH_1,
    });

    const after = await getSale(db, sale.id);
    expect(after.items.map((item) => item.qty)).toEqual([3, 2]);
    expect(after.summary.netFcfa).toBe(6100);
    // Le stock du Bazin suit la nouvelle ligne, celui du Wax ne bouge pas.
    expect(await stockOf(bazin.id)).toBe(18);
    expect(await lotQty(oldLot.id)).toBe(2);
    expect(after.revisions).toHaveLength(1);
    expect(after.revisions[0]?.summary).toContain("total");
  });

  it("réduit une quantité et rend la marchandise dans ses lots d'origine", async () => {
    const { awa, newLot, oldLot, wax } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 8, unitPriceFcfa: 1500 }],
    });
    const detail = await getSale(db, sale.id);
    expect(await stockOf(wax.id)).toBe(7);

    await update({
      id: sale.id,
      items: [
        {
          id: detail.items[0]?.id,
          productId: wax.id,
          qty: 3,
          unitPriceFcfa: 1500,
        },
      ],
      saleDate: MARCH_1,
    });

    const after = await getSale(db, sale.id);
    // 5 rendus : les 3 derniers prélevés (lot de février) puis 2 du lot de janvier.
    expect(await lotQty(newLot.id)).toBe(10);
    expect(await lotQty(oldLot.id)).toBe(2);
    expect(await stockOf(wax.id)).toBe(12);
    expect(after.items[0]?.costFcfa).toBe(3000);
    expect(after.summary.netFcfa).toBe(4500);
  });

  it("n'inscrit dans l'historique que la quantité réellement rendue", async () => {
    const { awa, newLot, oldLot, wax } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 8, unitPriceFcfa: 1500 }],
    });
    const detail = await getSale(db, sale.id);

    await update({
      id: sale.id,
      items: [
        {
          id: detail.items[0]?.id,
          productId: wax.id,
          qty: 3,
          unitPriceFcfa: 1500,
        },
      ],
      saleDate: MARCH_1,
    });

    // 3 rendus sur le lot de février, 2 sur celui de janvier : jamais la taille du lot.
    expect(await movementQty(newLot.id, "in")).toBe(13);
    expect(await movementQty(oldLot.id, "in")).toBe(7);
    await expectHistoryMatchesStock(newLot.id);
    await expectHistoryMatchesStock(oldLot.id);
  });

  it("retire une ligne et remet tout son stock", async () => {
    const { awa, bazin, wax } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [
        { productId: wax.id, qty: 2, unitPriceFcfa: 1500 },
        { productId: bazin.id, qty: 4, unitPriceFcfa: 800 },
      ],
    });
    const detail = await getSale(db, sale.id);
    const kept = detail.items.find((item) => item.productId === wax.id);

    await update({
      id: sale.id,
      items: [
        {
          id: kept?.id,
          productId: wax.id,
          qty: 2,
          unitPriceFcfa: 1500,
        },
      ],
      saleDate: MARCH_1,
    });

    const after = await getSale(db, sale.id);
    expect(after.items).toHaveLength(1);
    expect(await stockOf(bazin.id)).toBe(20);
    expect(after.summary.netFcfa).toBe(3000);
    expect(after.revisions[0]?.summary).toContain("ligne retirée");
  });

  it("refuse une hausse au-delà du stock disponible", async () => {
    const { awa, wax } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 2, unitPriceFcfa: 1500 }],
    });
    const detail = await getSale(db, sale.id);

    await expect(
      update({
        id: sale.id,
        items: [
          {
            id: detail.items[0]?.id,
            productId: wax.id,
            qty: 40,
            unitPriceFcfa: 1500,
          },
        ],
        saleDate: MARCH_1,
      })
    ).rejects.toThrow("Stock insuffisant");
    // Rien n'a bougé.
    expect((await getSale(db, sale.id)).items[0]?.qty).toBe(2);
    expect(await stockOf(wax.id)).toBe(13);
  });

  it("suit la nouvelle date de la vente dans les mouvements", async () => {
    const { awa, wax } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 1, unitPriceFcfa: 1500 }],
      saleDate: MARCH_1,
    });
    const detail = await getSale(db, sale.id);

    await update({
      id: sale.id,
      items: [
        {
          id: detail.items[0]?.id,
          productId: wax.id,
          qty: 1,
          unitPriceFcfa: 1500,
        },
      ],
      saleDate: MARCH_10,
    });

    const movements = await db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.referenceType, "sale"));
    expect(
      movements.every((row) => row.occurredAt.getTime() === MARCH_10.getTime())
    ).toBe(true);
  });
});

describe("reprise d'articles", () => {
  const giveBack = (
    input: Partial<SaleReturnInput> & Pick<SaleReturnInput, "items" | "saleId">
  ) =>
    db.transaction((tx) =>
      createSaleReturn(tx, {
        reason: "article rendu",
        refundMethod: "credit",
        returnDate: MARCH_10,
        ...input,
      })
    );

  it("reprend une partie d'une vente : stock rendu, total corrigé, trace gardée", async () => {
    const { awa, oldLot, wax } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 10, unitPriceFcfa: 1500 }],
    });
    const detail = await getSale(db, sale.id);
    const line = detail.items[0];

    const result = await giveBack({
      items: [{ qty: 4, saleItemId: line?.id as number }],
      saleId: sale.id,
    });

    expect(result.amountFcfa).toBe(6000);
    const after = await getSale(db, sale.id);
    expect(after.items[0]?.qty).toBe(6);
    expect(after.summary.netFcfa).toBe(9000);
    // Les 4 rendus repartent du lot le plus récemment prélevé : celui de février.
    expect(await lotQty(oldLot.id)).toBe(0);
    expect(await stockOf(wax.id)).toBe(9);
    expect(after.returns).toHaveLength(1);
    expect(after.returns[0]?.items[0]).toMatchObject({
      productName: "Wax",
      qty: 4,
      restocked: true,
    });
    // L'avoir reste au client : la vente vaut moins que ce qu'il a payé.
    const customer = await getCustomer(db, awa.id);
    expect(customer).toMatchObject({ creditFcfa: 6000, dueFcfa: 0 });
  });

  it("date le retour dans les mouvements et le sort de la vente d'origine", async () => {
    const { awa, wax } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 6, unitPriceFcfa: 1500 }],
    });
    const detail = await getSale(db, sale.id);
    await giveBack({
      items: [{ qty: 2, saleItemId: detail.items[0]?.id as number }],
      saleId: sale.id,
    });

    const { items } = await listMovements(db, {
      from: MARCH_10,
      page: 1,
      pageSize: 25,
      to: MARCH_10,
      type: "in",
    });
    expect(items).toHaveLength(2);
    expect(items.reduce((sum, item) => sum + item.qty, 0)).toBe(2);
    expect(items.every((item) => item.reason.includes("Reprise"))).toBe(true);
    expect(items[0]?.party?.name).toBe("Awa");
  });

  it("déduit des encaissements l'argent rendu au client", async () => {
    const { awa, wax } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 4, unitPriceFcfa: 1500 }],
    });
    const detail = await getSale(db, sale.id);

    await giveBack({
      items: [{ qty: 2, saleItemId: detail.items[0]?.id as number }],
      refundMethod: "cash",
      saleId: sale.id,
    });

    // 6 000 payés, 3 000 rendus : le client ne doit rien et n'a plus d'avoir.
    const customer = await getCustomer(db, awa.id);
    expect(customer).toMatchObject({ creditFcfa: 0, dueFcfa: 0 });
  });

  it("ne remet pas en stock la marchandise abîmée", async () => {
    const { awa, wax } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 4, unitPriceFcfa: 1500 }],
    });
    const detail = await getSale(db, sale.id);
    const before = await stockOf(wax.id);

    await giveBack({
      items: [
        {
          qty: 1,
          restocked: false,
          saleItemId: detail.items[0]?.id as number,
        },
      ],
      saleId: sale.id,
    });

    expect(await stockOf(wax.id)).toBe(before);
    expect((await getSale(db, sale.id)).items[0]?.qty).toBe(3);
  });

  it("refuse de reprendre plus que la quantité vendue", async () => {
    const { awa, wax } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 2, unitPriceFcfa: 1500 }],
    });
    const detail = await getSale(db, sale.id);

    await expect(
      giveBack({
        items: [{ qty: 5, saleItemId: detail.items[0]?.id as number }],
        saleId: sale.id,
      })
    ).rejects.toThrow("Quantité reprise supérieure");
  });

  it("impute le remboursement au paiement de la vente reprise, pas au plus récent du client", async () => {
    const { awa, wax } = await setup();
    const first = await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 4, unitPriceFcfa: 1500 }],
      saleDate: JAN_1,
    });
    await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 2, unitPriceFcfa: 1500 }],
      saleDate: FEB_1,
    });
    const detail = await getSale(db, first.id);

    await giveBack({
      items: [{ qty: 2, saleItemId: detail.items[0]?.id as number }],
      refundMethod: "cash",
      saleId: first.id,
    });

    // Chaque vente reste soldée : les 3 000 rendus viennent de la vente de janvier.
    const after = await getSale(db, first.id);
    expect(after.summary).toMatchObject({
      dueFcfa: 0,
      netFcfa: 3000,
      paidFcfa: 3000,
    });
    const customer = await getCustomer(db, awa.id);
    expect(customer).toMatchObject({ creditFcfa: 0, dueFcfa: 0 });
  });

  it("garde la reprise dans l'historique même quand l'article est vendu entièrement repris", async () => {
    const { awa, wax } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 3, unitPriceFcfa: 1500 }],
    });
    const detail = await getSale(db, sale.id);

    await giveBack({
      items: [{ qty: 3, saleItemId: detail.items[0]?.id as number }],
      saleId: sale.id,
    });

    const after = await getSale(db, sale.id);
    expect(after.items).toHaveLength(0);
    expect(after.summary.netFcfa).toBe(0);
    expect(after.returns[0]?.amountFcfa).toBe(4500);
    expect(await stockOf(wax.id)).toBe(15);
  });
});

describe("correction d'un paiement", () => {
  it("remplace le montant sans annuler puis recréer", async () => {
    const { awa, wax } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 4, unitPriceFcfa: 1500 }],
      paidFcfa: 2000,
      paymentType: "credit",
    });
    const detail = await getSale(db, sale.id);
    const payment = detail.payments[0];
    expect(payment).toBeDefined();

    await updatePayment(db, {
      amountFcfa: 4000,
      id: payment?.id as number,
      method: "mobile_money",
      notes: "erreur de frappe",
      paymentDate: MARCH_1,
      saleId: sale.id,
    });

    const after = await getSale(db, sale.id);
    expect(after.payments[0]).toMatchObject({
      amountFcfa: 4000,
      method: "mobile_money",
      notes: "erreur de frappe",
    });
    expect(after.summary).toMatchObject({ dueFcfa: 2000, paidFcfa: 4000 });
    expect(await saleDue(sale.id)).toBe(2000);
  });

  it("refuse de modifier un paiement annulé", async () => {
    const { awa, wax } = await setup();
    const sale = await sell({
      customerId: awa.id,
      lines: [{ productId: wax.id, qty: 2, unitPriceFcfa: 1500 }],
    });
    const detail = await getSale(db, sale.id);
    const payment = detail.payments[0];
    await cancelPayment(db, { id: payment?.id as number, reason: "doublon" });

    await expect(
      updatePayment(db, {
        amountFcfa: 1000,
        id: payment?.id as number,
        method: "cash",
        notes: null,
        paymentDate: MARCH_1,
        saleId: sale.id,
      })
    ).rejects.toThrow("annulé");
  });
});
