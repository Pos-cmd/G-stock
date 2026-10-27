// Remplace la base de G-stock par une sauvegarde.
// Usage (G-stock arrêté) : pnpm db:restore "G:\Mon Drive\G-stock\Sauvegardes\gstock-2026-10-27-090000.db"
// La base actuelle est conservée à côté (local.db.avant-restauration-<date>), rien n'est perdu.
import { existsSync, readFileSync } from "node:fs";
import { copyFile, open, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WEB_APP = path.join(ROOT, "apps", "web");
const SQLITE_HEADER = "SQLite format 3\0";
const DATABASE_URL_LINE = /^DATABASE_URL=(?<url>.+)$/mu;
const QUOTES = /^["']|["']$/gu;
const TIMESTAMP_SEPARATORS = /[:.]/gu;

const fail = (message) => {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
};

/** Fichier de la base, lu dans apps/web/.env comme le fait l'application (chemin relatif à apps/web). */
const databaseFile = () => {
  const envFile = path.join(WEB_APP, ".env");
  const match = existsSync(envFile) ? DATABASE_URL_LINE.exec(readFileSync(envFile, "utf-8")) : null;
  const url = match?.groups?.url.trim().replaceAll(QUOTES, "");
  if (!url?.startsWith("file:")) {
    fail("DATABASE_URL introuvable dans apps/web/.env (attendu : file:…).");
  }
  const location = url.slice("file:".length);
  return path.resolve(WEB_APP, location.startsWith("//") ? fileURLToPath(url) : location);
};

const isSqlite = async (file) => {
  const handle = await open(file, "r");
  try {
    const buffer = Buffer.alloc(SQLITE_HEADER.length);
    await handle.read(buffer, 0, buffer.length, 0);
    return buffer.toString("latin1") === SQLITE_HEADER;
  } finally {
    await handle.close();
  }
};

const [backupArgument] = process.argv.slice(2);
if (!backupArgument) {
  fail('Indiquez le fichier de sauvegarde : pnpm db:restore "<chemin>\\gstock-….db"');
}
const backup = path.resolve(process.cwd(), backupArgument);
if (!existsSync(backup)) {
  fail(`Sauvegarde introuvable : ${backup}`);
}
if (!(await isSqlite(backup))) {
  fail(`Ce fichier n'est pas une base G-stock : ${backup}`);
}

const target = databaseFile();
const stamp = new Date().toISOString().replaceAll(TIMESTAMP_SEPARATORS, "-");
const kept = `${target}.avant-restauration-${stamp}`;

if (existsSync(target)) {
  try {
    // Sous Windows, le renommage échoue tant que le serveur garde la base ouverte : c'est voulu.
    await rename(target, kept);
  } catch {
    fail("La base est utilisée. Arrêtez G-stock (fermez la fenêtre du serveur), puis relancez.");
  }
  await Promise.all(
    ["-wal", "-shm", "-journal"]
      .filter((suffix) => existsSync(`${target}${suffix}`))
      .map((suffix) => rename(`${target}${suffix}`, `${kept}${suffix}`)),
  );
}
await copyFile(backup, target);

console.log(`\n✔ Base restaurée depuis ${backup}`);
if (existsSync(kept)) {
  console.log(`  Ancienne base conservée : ${kept}`);
}
console.log("  Vous pouvez relancer G-stock.\n");
