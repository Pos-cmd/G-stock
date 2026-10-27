import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/libsql/migrator";

import type { Database } from "./index";

/**
 * Chemin absolu des migrations SQL. À résoudre hors bundle (config Nuxt, tests),
 * car une fois le paquet inliné par Nitro `import.meta.url` ne pointe plus ici.
 */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL("migrations", import.meta.url));

export const runMigrations = async (
  db: Database,
  migrationsFolder: string = MIGRATIONS_FOLDER,
): Promise<void> => {
  await migrate(db, { migrationsFolder });
};
