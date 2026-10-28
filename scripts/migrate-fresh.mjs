// Repart d'une base vide, avec toutes les migrations appliquées.
// Usage (G-stock arrêté) : pnpm db:migrate:fresh
// La base actuelle est conservée à côté (local.db.avant-migrate-fresh-<date>), rien n'est perdu.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const WEB_APP = path.join(ROOT, "apps", "web");
const DB_PACKAGE = path.join(ROOT, "packages", "db");
const DATABASE_URL_LINE = /^DATABASE_URL=(?<url>.+)$/mu;
const QUOTES = /^["']|["']$/gu;
const TIMESTAMP_SEPARATORS = /[:.]/gu;
const SIDE_FILE_SUFFIXES = ["-wal", "-shm", "-journal"];

const fail = (message) => {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
};

/** Fichier de la base, lu dans apps/web/.env comme le fait l'application (chemin relatif à apps/web). */
const databaseFile = () => {
  const envFile = path.join(WEB_APP, ".env");
  const match = existsSync(envFile)
    ? DATABASE_URL_LINE.exec(readFileSync(envFile, "utf-8"))
    : null;
  const url = match?.groups?.url.trim().replaceAll(QUOTES, "");
  if (!url?.startsWith("file:")) {
    fail("DATABASE_URL introuvable dans apps/web/.env (attendu : file:…).");
  }
  const location = url.slice("file:".length);
  return path.resolve(
    WEB_APP,
    location.startsWith("//") ? fileURLToPath(url) : location
  );
};

const target = databaseFile();
const stamp = new Date().toISOString().replaceAll(TIMESTAMP_SEPARATORS, "-");
const kept = `${target}.avant-migrate-fresh-${stamp}`;

if (existsSync(target)) {
  try {
    // Sous Windows, le renommage échoue tant que le serveur garde la base ouverte : c'est voulu.
    await rename(target, kept);
  } catch {
    fail(
      "La base est utilisée. Arrêtez G-stock (fermez la fenêtre du serveur), puis relancez."
    );
  }
  await Promise.all(
    SIDE_FILE_SUFFIXES.filter((suffix) => existsSync(`${target}${suffix}`)).map(
      (suffix) => rename(`${target}${suffix}`, `${kept}${suffix}`)
    )
  );
}

console.log(`\nApplication des migrations sur une base vide : ${target}`);
const result = spawnSync("pnpm", ["run", "db:migrate"], {
  cwd: DB_PACKAGE,
  env: { ...process.env, DATABASE_URL: `file:${target.replaceAll("\\", "/")}` },
  shell: true,
  stdio: "inherit",
});

if (result.status !== 0) {
  fail(
    existsSync(kept)
      ? `Échec des migrations. Ancienne base conservée : ${kept}`
      : "Échec des migrations."
  );
}

console.log(`\n✔ Base recréée et migrée : ${target}`);
if (existsSync(kept)) {
  console.log(`  Ancienne base conservée : ${kept}`);
}
console.log("  Vous pouvez relancer G-stock.\n");
