import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Executor } from "@G-stock/db";
import { documents } from "@G-stock/db/schema/documents";
import { purchaseOrders } from "@G-stock/db/schema/purchasing";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

import { purchaseOrderDocument, saleReceiptDocument, simulationDocument } from "../pdf/documents";
import { renderPdf } from "../pdf/render";
import type { DocumentFilters, GeneratedDocumentType } from "../schemas/documents";
import { getPurchaseOrder } from "./purchases";
import { getSale } from "./sales";
import { getSettings } from "./settings";
import { getSimulation } from "./simulations";

const DIACRITICS = /\p{Mn}/gu;
const FORBIDDEN_CHARACTERS = /[^\w.-]+/gu;
const REPEATED_DASHES = /-+/gu;
const EDGE_DASHES = /^-|-$/gu;
const MAX_FILE_NAME_LENGTH = 80;

/** Nom de fichier sans accents ni caractères interdits sous Windows. */
export const safeFileName = (value: string): string =>
  value
    .normalize("NFD")
    .replaceAll(DIACRITICS, "")
    .replaceAll(FORBIDDEN_CHARACTERS, "-")
    .replaceAll(REPEATED_DASHES, "-")
    .replaceAll(EDGE_DASHES, "")
    .slice(0, MAX_FILE_NAME_LENGTH) || "document";

const SHORT_ID_LENGTH = 6;

/** Fin aléatoire d'un UUID : courte, lisible, et suffisante pour distinguer deux homonymes. */
const shortId = (id: string): string => id.slice(-SHORT_ID_LENGTH);

interface PreparedDocument {
  definition: TDocumentDefinitions;
  title: string;
  /** Sous-dossier du dossier des documents. */
  folder: string;
  fileName: string;
  referenceType: string;
}

const prepare = async (
  executor: Executor,
  type: GeneratedDocumentType,
  referenceId: string,
  company: Parameters<typeof simulationDocument>[1],
): Promise<PreparedDocument> => {
  if (type === "simulation") {
    const simulation = await getSimulation(executor, referenceId);
    return {
      definition: simulationDocument(simulation, company),
      fileName: `${safeFileName(simulation.name)}-${shortId(simulation.id)}.pdf`,
      folder: "Simulations",
      referenceType: "simulation",
      title: `Simulation — ${simulation.name}`,
    };
  }
  if (type === "receipt") {
    const sale = await getSale(executor, referenceId);
    return {
      definition: saleReceiptDocument(sale, company),
      fileName: `${sale.reference}.pdf`,
      folder: "Ventes",
      referenceType: "sale",
      title: `Reçu ${sale.reference} — ${sale.customer.name}`,
    };
  }
  const order = await getPurchaseOrder(executor, referenceId);
  return {
    definition: purchaseOrderDocument(order, company),
    fileName: `${order.reference}-prix-de-revient.pdf`,
    // Un dossier par commande, pour y ranger aussi les factures et BL.
    folder: path.join("Commandes", order.reference),
    referenceType: "purchase_order",
    title: `Commande ${order.reference}${order.supplier ? ` — ${order.supplier.name}` : ""}`,
  };
};

/**
 * Génère le PDF, l'écrit dans le dossier des documents (Paramètres) et l'enregistre.
 * Regénérer un document remplace le fichier précédent du même document.
 */
export const generateDocument = async (
  executor: Executor,
  input: { type: GeneratedDocumentType; referenceId: string },
) => {
  const settings = await getSettings(executor);
  const prepared = await prepare(executor, input.type, input.referenceId, settings);
  const buffer = await renderPdf(prepared.definition);

  const directory = path.join(settings.documentsFolder, prepared.folder);
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, prepared.fileName), buffer);
  } catch (error) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      cause: error,
      message: `Impossible d'écrire dans le dossier « ${directory} » : vérifiez le dossier des documents dans les Paramètres`,
    });
  }
  const filePath = path.join(directory, prepared.fileName);

  if (input.type === "cost_sheet") {
    await executor
      .update(purchaseOrders)
      .set({ documentsFolder: directory })
      .where(eq(purchaseOrders.id, input.referenceId));
  }

  const [existing] = await executor
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.type, input.type), eq(documents.referenceId, input.referenceId)));
  const values = {
    createdAt: new Date(),
    filePath,
    referenceId: input.referenceId,
    referenceType: prepared.referenceType,
    title: prepared.title,
    type: input.type,
  };
  const [document] = existing
    ? await executor.update(documents).set(values).where(eq(documents.id, existing.id)).returning()
    : await executor.insert(documents).values(values).returning();
  if (!document) {
    throw new Error("L'enregistrement du document n'a renvoyé aucune ligne");
  }
  return document;
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const listDocuments = async (executor: Executor, filters: DocumentFilters) => {
  const conditions: SQL[] = [];
  if (filters.type) {
    conditions.push(eq(documents.type, filters.type));
  }
  if (filters.search) {
    conditions.push(sql`instr(lower(${documents.title}), lower(${filters.search})) > 0`);
  }
  const rows = await executor
    .select()
    .from(documents)
    .where(and(...conditions))
    .orderBy(desc(documents.createdAt), desc(documents.id));
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      exists: await fileExists(row.filePath),
    })),
  );
};

/** Fichier d'un document, pour l'ouvrir ou le télécharger. */
export const getDocumentFile = async (executor: Executor, id: string) => {
  const [document] = await executor.select().from(documents).where(eq(documents.id, id));
  if (!document) {
    throw new ORPCError("NOT_FOUND", { message: "Document introuvable" });
  }
  if (!(await fileExists(document.filePath))) {
    throw new ORPCError("NOT_FOUND", {
      message: `Le fichier a été déplacé ou supprimé : ${document.filePath}`,
    });
  }
  return {
    fileName: path.basename(document.filePath),
    filePath: document.filePath,
  };
};
