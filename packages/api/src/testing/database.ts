import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createDb } from "@G-stock/db";
import type { Database } from "@G-stock/db";
import { runMigrations } from "@G-stock/db/migrate";
import { afterAll, afterEach, beforeAll, beforeEach } from "vite-plus/test";

/**
 * Donne à chaque test une base SQLite neuve et migrée.
 * Une base fichier par test : une base `:memory:` libsql ouvre une connexion vierge par transaction.
 */
export const useTestDatabase = (): (() => Database) => {
  let db: Database | undefined;
  let directory = "";
  let databaseIndex = 0;

  beforeAll(() => {
    directory = mkdtempSync(path.join(tmpdir(), "gstock-test-"));
  });

  beforeEach(async () => {
    databaseIndex += 1;
    db = createDb({
      DATABASE_URL: pathToFileURL(path.join(directory, `test-${databaseIndex}.db`)).href,
    });
    await runMigrations(db);
  });

  afterEach(() => {
    db?.$client.close();
  });

  afterAll(() => {
    try {
      rmSync(directory, { force: true, recursive: true });
    } catch {
      // Sous Windows, libsql peut garder le fichier verrouillé : le dossier temporaire sera purgé par le système.
    }
  });

  return () => {
    if (!db) {
      throw new Error("La base de test n'est disponible qu'à l'intérieur d'un test");
    }
    return db;
  };
};
