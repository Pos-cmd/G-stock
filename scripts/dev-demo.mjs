// Lance G-stock sur la base de démonstration (demo.db), à côté du serveur habituel.
// Usage : pnpm dev:demo  →  http://localhost:3003 (créer la base d'abord : pnpm demo:seed)
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DEMO_FILE = path.join(ROOT, "demo.db");
const PORT = "3003";

if (!existsSync(DEMO_FILE)) {
  console.error("\n✖ demo.db introuvable : lancez d'abord « pnpm demo:seed ».\n");
  process.exit(1);
}

const origins = [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`];
const child = spawn("pnpm", ["--filter", "web", "exec", "nuxt", "dev", "--port", PORT], {
  cwd: ROOT,
  env: {
    ...process.env,
    DATABASE_URL: pathToFileURL(DEMO_FILE).href,
    // Le serveur habituel (port 3001) peut tourner en même temps sur le même dossier.
    NUXT_IGNORE_LOCK: "1",
    TRUSTED_ORIGINS: [process.env.TRUSTED_ORIGINS, ...origins].filter(Boolean).join(","),
  },
  shell: true,
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 0));
