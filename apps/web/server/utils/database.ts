import { runMigrations } from "@G-stock/db/migrate";

import { db } from "../../src/services";

let ready: Promise<void> | undefined;

/** Applique les migrations une seule fois par processus ; à attendre avant tout accès à la base. */
export const ensureDatabaseReady = (): Promise<void> => {
  ready ??= runMigrations(db, useRuntimeConfig().migrationsFolder);
  return ready;
};
