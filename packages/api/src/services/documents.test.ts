import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { Database } from "@G-stock/db";
import { afterAll, beforeEach, describe, expect, it } from "vite-plus/test";

import { useTestDatabase } from "../testing/database";
import { createCustomer } from "./customers";
import { generateDocument, getDocumentFile, listDocuments, safeFileName } from "./documents";
import { createProduct } from "./products";
import { createPurchaseOrder, getPurchaseOrder } from "./purchases";
import { addSaleDiscount, createSale } from "./sales";
import { getSettings, updateSettings } from "./settings";
import { createSimulation } from "./simulations";
import { createLot } from "./stock";

let db: Database;
const getDb = useTestDatabase();
const folder = mkdtempSync(path.join(tmpdir(), "gstock-documents-"));

beforeEach(async () => {
  db = getDb();
  const settings = await getSettings(db);
  await updateSettings(db, {
    ...settings,
    companyAddress: "Grand marché, Lomé",
    companyName: "Établissements Yass",
    companyPhone: "+228 90 00 00 00",
    documentsFolder: folder,
  });
});

afterAll(() => {
  rmSync(folder, { force: true, recursive: true });
});

const isPdf = (filePath: string) => readFileSync(filePath).subarray(0, 5).toString() === "%PDF-";

const seed = async () => {
  const product = await createProduct(db, {
    alertThreshold: 0,
    category: null,
    name: "Fil barbelé",
    notes: null,
    reference: null,
    referencePriceRmb: null,
    suggestedSalePriceFcfa: 9000,
    unit: "rouleau",
  });
  await db.transaction((tx) =>
    createLot(tx, {
      productId: product.id,
      qty: 10,
      receivedAt: new Date(2026, 0, 1),
      source: "initial",
      unitCostFcfa: 7000,
    }),
  );
  const customer = await createCustomer(db, {
    address: "Bè, Lomé",
    name: "Quincaillerie Awa",
    notes: null,
    phone: "90 11 22 33",
  });
  return { customer, product };
};

describe("generateDocument", () => {
  it("produit le reçu d'une vente dans Ventes/ et le remplace s'il est regénéré", async () => {
    const { customer, product } = await seed();
    const sale = await db.transaction((tx) =>
      createSale(tx, {
        customerId: customer.id,
        lines: [{ productId: product.id, qty: 3, unitPriceFcfa: 9000 }],
        notes: null,
        paidFcfa: 10_000,
        paymentMethod: "mobile_money",
        paymentType: "credit",
        saleDate: new Date(2026, 2, 1),
      }),
    );
    await addSaleDiscount(db, {
      amountFcfa: 1000,
      discountDate: new Date(2026, 2, 2),
      reason: "Geste commercial",
      saleId: sale.id,
    });

    const first = await generateDocument(db, {
      referenceId: sale.id,
      type: "receipt",
    });
    expect(first.filePath).toBe(path.join(folder, "Ventes", "V-2026-00001.pdf"));
    expect(isPdf(first.filePath)).toBe(true);
    expect(first.title).toBe("Reçu V-2026-00001 — Quincaillerie Awa");

    const second = await generateDocument(db, {
      referenceId: sale.id,
      type: "receipt",
    });
    expect(second.id).toBe(first.id);
    const listed = await listDocuments(db, {});
    expect(listed).toHaveLength(1);
    expect(listed[0]?.exists).toBe(true);
  });

  it("produit aussi un reçu au format téléphone, rangé à part", async () => {
    const { customer, product } = await seed();
    const sale = await db.transaction((tx) =>
      createSale(tx, {
        customerId: customer.id,
        lines: [{ productId: product.id, qty: 3, unitPriceFcfa: 9000 }],
        notes: null,
        paidFcfa: 10_000,
        paymentMethod: "mobile_money",
        paymentType: "credit",
        saleDate: new Date(2026, 2, 1),
      }),
    );
    const mobile = await generateDocument(db, { referenceId: sale.id, type: "receipt_mobile" });
    expect(mobile.filePath).toBe(path.join(folder, "Ventes", "Recu-V-2026-00001.pdf"));
    expect(isPdf(mobile.filePath)).toBe(true);
    expect(mobile.type).toBe("receipt_mobile");

    const a4 = await generateDocument(db, { referenceId: sale.id, type: "receipt" });
    expect(a4.id).not.toBe(mobile.id);
    expect(await listDocuments(db, { type: "receipt_mobile" })).toHaveLength(1);
  });

  it("range la fiche d'une commande dans son propre dossier", async () => {
    const { product } = await seed();
    const order = await db.transaction((tx) =>
      createPurchaseOrder(tx, {
        allocationMethod: "equal",
        fcfaPerUsd: 598,
        freightCbm: 1,
        freightRatePerCbmFcfa: 100_000,
        items: [
          {
            pricingBasis: "unit",
            productId: product.id,
            qty: 10,
            trips: 1,
            unitPriceRmb: 60,
            weightTons: null,
          },
        ],
        localTransportFcfa: 0,
        notes: null,
        orderDate: new Date(2026, 2, 1),
        otherFeesFcfa: 0,
        rmbPerUsd: 7.2,
        supplierId: null,
      }),
    );
    const document = await generateDocument(db, {
      referenceId: order.id,
      type: "cost_sheet",
    });
    const orderFolder = path.join(folder, "Commandes", "CF-2026-0001");
    expect(document.filePath).toBe(path.join(orderFolder, "CF-2026-0001-prix-de-revient.pdf"));
    expect(isPdf(document.filePath)).toBe(true);
    const detail = await getPurchaseOrder(db, order.id);
    expect(detail.documentsFolder).toBe(orderFolder);
  });

  it("exporte une simulation avec un nom de fichier sans accents", async () => {
    const simulation = await createSimulation(db, {
      data: {
        fees: [],
        freightAllocation: "equal",
        freightCbm: 0,
        freightRatePerCbmFcfa: 0,
        lines: [
          {
            label: "Grillage",
            pricing: { mode: "markup", value: 30 },
            pricingBasis: "unit",
            productId: null,
            qty: 10,
            trips: 1,
            unit: "rouleau",
            unitPriceRmb: 50,
            weightTons: null,
          },
        ],
        rates: { fcfaPerUsd: 598, rmbPerUsd: 7.2 },
      },
      name: "Été : grillage / test",
      notes: null,
    });
    const document = await generateDocument(db, {
      referenceId: simulation.id,
      type: "simulation",
    });
    expect(path.basename(document.filePath)).toBe(
      `Ete-grillage-test-${simulation.id.slice(-6)}.pdf`,
    );
    expect(isPdf(document.filePath)).toBe(true);

    const file = await getDocumentFile(db, document.id);
    expect(file.fileName).toBe(`Ete-grillage-test-${simulation.id.slice(-6)}.pdf`);
  });

  it("signale un document dont le fichier a disparu", async () => {
    const { customer, product } = await seed();
    const sale = await db.transaction((tx) =>
      createSale(tx, {
        customerId: customer.id,
        lines: [{ productId: product.id, qty: 1, unitPriceFcfa: 9000 }],
        notes: null,
        paidFcfa: 0,
        paymentMethod: "cash",
        paymentType: "cash",
        saleDate: new Date(2026, 2, 1),
      }),
    );
    const document = await generateDocument(db, {
      referenceId: sale.id,
      type: "receipt",
    });
    rmSync(document.filePath);
    await expect(getDocumentFile(db, document.id)).rejects.toThrow("déplacé ou supprimé");
  });
});

describe("safeFileName", () => {
  it("retire accents et caractères interdits", () => {
    expect(safeFileName("Conteneur d'été : Yiwu/Lomé")).toBe("Conteneur-d-ete-Yiwu-Lome");
  });
});
