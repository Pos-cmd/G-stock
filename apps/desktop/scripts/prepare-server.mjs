// Assemble ce que l'application de bureau embarque à côté de l'exécutable Tauri :
// - src-tauri/resources/server      le serveur Nuxt construit (apps/web/.output)
// - src-tauri/resources/migrations  les migrations SQL, appliquées au démarrage
// - src-tauri/resources/frozen-env  la config varlock figée, sans aucune valeur propre au poste
// - src-tauri/binaries/node-<cible>.exe  le Node.js qui fait tourner ce serveur
//
// --reuse-web-build : réutilise apps/web/.output s'il existe (tauri dev), au lieu de reconstruire.

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MINIMUM_NODE_MAJOR = 22;
const TARGET_TRIPLE = "x86_64-pc-windows-msvc";
/** Valeurs fournies par l'application au lancement : elles ne doivent jamais être figées. */
const BOOT_KEYS = new Set([
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "DATABASE_URL",
  "TRUSTED_ORIGINS",
]);

const desktopDir = fileURLToPath(new URL("..", import.meta.url));
const repoDir = path.resolve(desktopDir, "../..");
const webDir = path.join(repoDir, "apps/web");
const webOutput = path.join(webDir, ".output");
const tauriDir = path.join(desktopDir, "src-tauri");
const resourcesDir = path.join(tauriDir, "resources");
const binariesDir = path.join(tauriDir, "binaries");

const step = (message) => {
  process.stdout.write(`[desktop] ${message}\n`);
};

const buildWeb = () => {
  const reuse = process.argv.includes("--reuse-web-build");
  if (reuse && existsSync(path.join(webOutput, "server/index.mjs"))) {
    step("build web existant réutilisé (apps/web/.output)");
    return;
  }
  step("build de l'application web…");
  execFileSync("pnpm", ["--filter", "web", "build"], {
    cwd: repoDir,
    shell: true,
    stdio: "inherit",
  });
};

/** Environnement du build sans aucune valeur propre au poste, pour qu'elle ne soit pas figée. */
const freezeEnvironment = () => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !BOOT_KEYS.has(key))),
  NODE_ENV: "production",
});

/** Refuse un fichier figé qui contiendrait une valeur sensible ou propre au poste. */
const assertNothingFrozenPerInstall = (frozenFile) => {
  const { config } = JSON.parse(readFileSync(frozenFile, "utf-8"));
  const leaked = Object.entries(config)
    .filter(([key, item]) => (item.isSensitive || BOOT_KEYS.has(key)) && item.value !== undefined)
    .map(([key]) => key);
  if (leaked.length > 0) {
    rmSync(frozenFile, { force: true });
    throw new Error(`La config figée contient des valeurs propres au poste : ${leaked.join(", ")}`);
  }
};

/**
 * Fige la config depuis le seul schéma, copié dans un dossier vide : les fichiers .env du poste de
 * développement (secret, base locale) ne sont jamais lus.
 */
const freezeConfig = () => {
  step("config varlock figée (sans .env)…");
  const varlockCli = path.join(webDir, "node_modules/varlock/bin/cli.js");
  const workDir = mkdtempSync(path.join(tmpdir(), "gstock-freeze-"));
  const frozenFile = path.join(resourcesDir, "frozen-env");
  try {
    copyFileSync(path.join(webDir, ".env.schema"), path.join(workDir, ".env.schema"));
    execFileSync(
      process.execPath,
      [varlockCli, "freeze", "--allow-plaintext", "--out", frozenFile],
      {
        cwd: workDir,
        env: freezeEnvironment(),
        stdio: ["ignore", "ignore", "inherit"],
      },
    );
  } finally {
    rmSync(workDir, { force: true, recursive: true });
  }
  assertNothingFrozenPerInstall(frozenFile);
};

const copyNode = () => {
  const [major] = process.versions.node.split(".").map(Number);
  if (major < MINIMUM_NODE_MAJOR) {
    throw new Error(
      `Node ${MINIMUM_NODE_MAJOR}+ requis pour l'application, trouvé ${process.version}`,
    );
  }
  step(`Node ${process.version} embarqué (${process.execPath})`);
  mkdirSync(binariesDir, { recursive: true });
  copyFileSync(process.execPath, path.join(binariesDir, `node-${TARGET_TRIPLE}.exe`));
};

buildWeb();
rmSync(resourcesDir, { force: true, recursive: true });
mkdirSync(resourcesDir, { recursive: true });
step("serveur et migrations copiés…");
cpSync(webOutput, path.join(resourcesDir, "server"), { recursive: true });
cpSync(path.join(repoDir, "packages/db/src/migrations"), path.join(resourcesDir, "migrations"), {
  recursive: true,
});
freezeConfig();
copyNode();
step("prêt");
