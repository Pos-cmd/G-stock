import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createDb } from "@G-stock/db";
import type { Database } from "@G-stock/db";
import { products } from "@G-stock/db/schema/catalog";
import { afterAll, beforeEach, describe, expect, it } from "vite-plus/test";

import { useTestDatabase } from "../testing/database";
import {
  backupFileName,
  backupNow,
  createBackup,
  getBackupFile,
  getBackupStatus,
  listBackups,
  parseBackupFileName,
  runAutomaticBackup,
} from "./backups";
import { createProduct } from "./products";
import { getSettings, updateSettings } from "./settings";

let db: Database;
let folder: string;
const getDb = useTestDatabase();
const root = mkdtempSync(path.join(tmpdir(), "gstock-backups-"));
let folderIndex = 0;

beforeEach(async () => {
  db = getDb();
  folderIndex += 1;
  folder = path.join(root, `dossier-${folderIndex}`);
  await updateSettings(db, {
    ...(await getSettings(db)),
    backupFolder: folder,
    backupKeep: 3,
  });
});

afterAll(() => {
  try {
    rmSync(root, { force: true, recursive: true });
  } catch {
    // Sous Windows, libsql peut garder une copie ouverte : le dossier temporaire sera purgé par le système.
  }
});

const addProduct = (name: string) =>
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

describe("noms de fichier", () => {
  it("horodate le nom et le relit", () => {
    const date = new Date(2026, 9, 27, 8, 5, 9);
    expect(backupFileName(date)).toBe("gstock-2026-10-27-080509.db");
    expect(parseBackupFileName("gstock-2026-10-27-080509.db")).toEqual(date);
  });

  it("ignore les autres fichiers", () => {
    expect(parseBackupFileName("photo.jpg")).toBeNull();
    expect(parseBackupFileName("gstock-2026-10-27.db")).toBeNull();
    expect(parseBackupFileName("../gstock-2026-10-27-080509.db")).toBeNull();
  });
});

describe("createBackup", () => {
  it("copie la base dans le dossier, lisible et complète", async () => {
    await addProduct("Fil galva");
    const result = await createBackup(db, new Date(2026, 9, 27, 10, 0, 0));
    expect(result).toEqual({ fileName: "gstock-2026-10-27-100000.db", folder });

    const copy = createDb({
      DATABASE_URL: pathToFileURL(path.join(folder, result.fileName)).href,
    });
    const rows = await copy.select({ name: products.name }).from(products);
    copy.$client.close();
    expect(rows).toEqual([{ name: "Fil galva" }]);
  });

  it("ne garde que les plus récentes, sans toucher aux autres fichiers", async () => {
    await createBackup(db, new Date(2026, 9, 1, 10, 0, 0));
    writeFileSync(path.join(folder, "notes.txt"), "à garder");
    // Séquentiel : chaque sauvegarde fait le ménage des plus anciennes.
    await createBackup(db, new Date(2026, 9, 2, 10, 0, 0));
    await createBackup(db, new Date(2026, 9, 3, 10, 0, 0));
    await createBackup(db, new Date(2026, 9, 4, 10, 0, 0));
    expect(readdirSync(folder).toSorted()).toEqual([
      "gstock-2026-10-02-100000.db",
      "gstock-2026-10-03-100000.db",
      "gstock-2026-10-04-100000.db",
      "notes.txt",
    ]);
  });

  it("signale un dossier inutilisable", async () => {
    const file = path.join(root, `fichier-${folderIndex}`);
    writeFileSync(file, "");
    await updateSettings(db, {
      ...(await getSettings(db)),
      backupFolder: file,
    });
    await expect(backupNow(db)).rejects.toThrow("Sauvegarde impossible");
    const status = await getBackupStatus(db);
    expect(status.lastError?.message).toContain("Sauvegarde impossible");
  });
});

describe("runAutomaticBackup", () => {
  it("sauvegarde seulement si la dernière a plus de 24 h", async () => {
    const first = new Date(2026, 9, 27, 9, 0, 0);
    expect(await runAutomaticBackup(db, first)).not.toBeNull();
    expect(await runAutomaticBackup(db, new Date(2026, 9, 28, 8, 59, 0))).toBeNull();
    expect(await runAutomaticBackup(db, new Date(2026, 9, 28, 9, 0, 0))).not.toBeNull();
    const backups = await listBackups(folder);
    expect(backups.map((backup) => backup.fileName)).toEqual([
      "gstock-2026-10-28-090000.db",
      "gstock-2026-10-27-090000.db",
    ]);
  });
});

describe("statut et téléchargement", () => {
  it("liste les sauvegardes et refuse les noms hors du dossier", async () => {
    await backupNow(db);
    const status = await getBackupStatus(db);
    expect(status.folder).toBe(folder);
    expect(status.keep).toBe(3);
    expect(status.lastError).toBeNull();
    expect(status.backups).toHaveLength(1);
    expect(status.backups[0]?.sizeBytes).toBeGreaterThan(0);

    const [backup] = status.backups;
    expect(await getBackupFile(db, backup?.fileName ?? "")).toBe(
      path.join(folder, backup?.fileName ?? ""),
    );
    await expect(getBackupFile(db, "..\\local.db")).rejects.toThrow("Sauvegarde invalide");
    await expect(getBackupFile(db, "gstock-2020-01-01-000000.db")).rejects.toThrow(
      "Sauvegarde introuvable",
    );
  });
});
