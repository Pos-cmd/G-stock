// Release de l'application de bureau, en deux temps :
//
//   pnpm desktop:release <version> [--notes "Ce qui change"]
//     Fixe la version (tauri.conf.json, Cargo.toml), construit l'installateur signé et écrit
//     latest.json à côté. Rien n'est publié.
//
//   pnpm desktop:publish
//     Publie l'installateur et latest.json dans une release GitHub `desktop-v<version>`. Le commit
//     de la version doit être poussé : la release pointe dessus. Les applications installées la
//     trouvent au lancement (Paramètres → Application de bureau pour l'installer).
//
// Clé de signature : %USERPROFILE%\.tauri\gstock-updater.key (ou TAURI_SIGNING_PRIVATE_KEY_PATH),
// générée une fois avec `pnpm --filter desktop tauri signer generate`. Sans elle, les applications
// installées refusent les mises à jour : gardez-en une copie à l'abri.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY = "Pos-cmd/G-stock";
const TAG_PREFIX = "desktop-v";
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/u;
const CARGO_VERSION_LINE = /^version = "[^"]+"$/mu;
const CONFIG_VERSION_LINE = /"version": "[^"]+"/u;
const DEFAULT_NOTES = "Mise à jour de G-stock.";

const desktopDir = fileURLToPath(new URL("..", import.meta.url));
const tauriDir = path.join(desktopDir, "src-tauri");
const configFile = path.join(tauriDir, "tauri.conf.json");
const cargoFile = path.join(tauriDir, "Cargo.toml");
const bundleDir = path.join(tauriDir, "target/release/bundle/nsis");
const manifestFile = path.join(bundleDir, "latest.json");

const fail = (message) => {
  process.stderr.write(`\n✖ ${message}\n\n`);
  process.exit(1);
};
const step = (message) => {
  process.stdout.write(`[release] ${message}\n`);
};

const readConfig = () => JSON.parse(readFileSync(configFile, "utf8"));
const installerName = (version) => `G-stock_${version}_x64-setup.exe`;

const compareVersions = (left, right) => {
  const [a, b] = [left, right].map((version) => version.split(".").map(Number));
  return a.reduce((order, part, index) => order || part - b[index], 0);
};

const option = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const setVersion = (version) => {
  const config = readConfig();
  if (compareVersions(version, config.version) < 0) {
    fail(`La version ${version} est plus ancienne que la version actuelle (${config.version}).`);
  }
  // Seule la ligne de version change : le reste des fichiers garde sa mise en forme.
  const configText = readFileSync(configFile, "utf8");
  writeFileSync(configFile, configText.replace(CONFIG_VERSION_LINE, `"version": "${version}"`));
  const cargo = readFileSync(cargoFile, "utf8");
  writeFileSync(cargoFile, cargo.replace(CARGO_VERSION_LINE, `version = "${version}"`));
};

const signingKey = () => {
  const keyFile =
    process.env.TAURI_SIGNING_PRIVATE_KEY_PATH ??
    path.join(homedir(), ".tauri", "gstock-updater.key");
  if (!existsSync(keyFile)) {
    fail(`Clé de signature introuvable : ${keyFile}`);
  }
  return readFileSync(keyFile, "utf8");
};

const build = (version) => {
  if (!VERSION_PATTERN.test(version ?? "")) {
    fail('Indiquez la version : pnpm desktop:release 0.2.0 [--notes "Ce qui change"]');
  }
  const notes = option("--notes") ?? DEFAULT_NOTES;
  setVersion(version);
  step(`version ${version}, build signé…`);
  execFileSync("pnpm", ["tauri", "build", "--config", "src-tauri/tauri.release.conf.json"], {
    cwd: desktopDir,
    env: {
      ...process.env,
      TAURI_SIGNING_PRIVATE_KEY: signingKey(),
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? "",
    },
    shell: true,
    stdio: "inherit",
  });

  const installer = installerName(version);
  const signatureFile = path.join(bundleDir, `${installer}.sig`);
  if (!existsSync(signatureFile)) {
    fail(`Signature absente : ${signatureFile}`);
  }
  const manifest = {
    notes,
    platforms: {
      "windows-x86_64": {
        signature: readFileSync(signatureFile, "utf8").trim(),
        url: `https://github.com/${REPOSITORY}/releases/download/${TAG_PREFIX}${version}/${installer}`,
      },
    },
    pub_date: new Date().toISOString(),
    version,
  };
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  step(`prêt : ${path.join(bundleDir, installer)}`);
  step("ensuite : commitez et poussez la version, puis pnpm desktop:publish");
};

const git = (...args) => execFileSync("git", args, { cwd: desktopDir, encoding: "utf8" }).trim();

const publish = () => {
  const { version } = readConfig();
  const installer = path.join(bundleDir, installerName(version));
  if (!existsSync(installer) || !existsSync(manifestFile)) {
    fail(`Rien à publier pour ${version} : lancez d'abord pnpm desktop:release ${version}`);
  }
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  if (manifest.version !== version) {
    fail(
      `latest.json est pour ${manifest.version}, la config pour ${version} : refaites le build.`,
    );
  }
  if (git("status", "--porcelain", "--", configFile, cargoFile)) {
    fail("La nouvelle version n'est pas commitée (tauri.conf.json, Cargo.toml).");
  }
  const commit = git("rev-parse", "HEAD");
  if (!git("branch", "-r", "--contains", commit)) {
    fail("Le commit de la version n'est pas sur GitHub : poussez la branche d'abord.");
  }
  const tag = `${TAG_PREFIX}${version}`;
  step(`publication de ${tag}…`);
  execFileSync(
    "gh",
    [
      "release",
      "create",
      tag,
      installer,
      manifestFile,
      "--repo",
      REPOSITORY,
      "--target",
      commit,
      "--title",
      `G-stock ${version}`,
      "--notes",
      manifest.notes,
    ],
    { stdio: "inherit" },
  );
  step("publiée : les applications installées la proposeront à leur prochain lancement.");
};

const [command, version] = process.argv.slice(2);
if (command === "build") {
  build(version);
} else if (command === "publish") {
  publish();
} else {
  fail('Usage : release.mjs build <version> [--notes "…"] | release.mjs publish');
}
