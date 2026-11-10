import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/libsql/migrator";

import type { Database } from "./index";

/**
 * Chemin absolu des migrations SQL. À résoudre hors bundle (config Nuxt, tests) : une fois le
 * paquet inliné par Nitro, `import.meta.url` vaut `file:///_entry.js` et, sous Windows, ce chemin
 * sans lecteur fait échouer `fileURLToPath`. D'où une fonction, jamais appelée au chargement.
 */
export const resolveMigrationsFolder = (): string =>
  fileURLToPath(new URL("migrations", import.meta.url));

export const runMigrations = async (
  db: Database,
  migrationsFolder: string = resolveMigrationsFolder(),
): Promise<void> => {
  await migrate(db, { migrationsFolder });
};
