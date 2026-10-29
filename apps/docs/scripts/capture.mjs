// Le navigateur se pilote étape par étape : les attentes dans les boucles sont voulues.
/* oxlint-disable no-await-in-loop, promise/avoid-new, no-promise-executor-return */
// Captures d'écran de la documentation, prises sur la base de démonstration, et leurs figures
// comark-ui : chaque note est mesurée dans la page au moment de la capture.
//
// 1. Lancer l'application de démo : pnpm dev:demo (http://localhost:3003)
// 2. pnpm --filter docs captures   (Edge ou Chrome sans fenêtre, piloté par le protocole DevTools)
// 3. pnpm --filter docs figures    (rend les figures en HTML pour le site)
//
// Variables : DOCS_APP_URL (défaut http://localhost:3003), BROWSER_PATH (navigateur à utiliser).
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { SHOTS } from "./shots.mjs";

const ROOT = path.dirname(import.meta.dirname);
const BASE = process.env.DOCS_APP_URL ?? "http://localhost:3003";
const WIDTH = 1280;
const HEIGHT = 800;
const PORT = 9341;
const PADDING_PX = 4;
const WAIT_TIMEOUT_S = 120;
const ACCOUNT = { email: "demo@g-stock.local", password: "demo-gstock" };

const BROWSERS = [
  process.env.BROWSER_PATH,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const browserPath = BROWSERS.find((candidate) => existsSync(candidate));
if (!browserPath) {
  throw new Error("Aucun navigateur trouvé : indiquez-le avec BROWSER_PATH.");
}

// Aides injectées dans la page pour trouver les éléments à annoter (voir shots.mjs).
const HELPERS = `(() => {
  const shown = (el) => el.getBoundingClientRect().width > 0;
  const smallest = (matches) => matches.filter(shown).find((el) => ![...el.children].some((child) => matches.includes(child)));
  window.text = (t) => smallest([...document.querySelectorAll("body *")].filter((el) => el.textContent.trim() === t));
  window.starts = (t) => smallest([...document.querySelectorAll("body *")].filter((el) => el.textContent.trim().startsWith(t)));
  window.label = (l) => [...document.querySelectorAll("[aria-label]")].find((el) => el.getAttribute("aria-label") === l && shown(el));
  window.tour = (id) => document.querySelector('[data-tour="' + id + '"]');
  const style = document.createElement("style");
  style.textContent = '#nuxt-devtools-container, .tsqd-parent-container, [aria-label="Open Tanstack query devtools"] { display: none !important; }';
  document.head.append(style);
})()`;

const profile = path.join(os.tmpdir(), "gstock-docs-captures");
const browser = spawn(
  browserPath,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    "--hide-scrollbars",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const connect = async () => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page");
      if (page) {
        return page.webSocketDebuggerUrl;
      }
    } catch {
      // Le navigateur démarre encore.
    }
    await sleep(500);
  }
  throw new Error("Le navigateur ne répond pas.");
};

const socket = new WebSocket(await connect());
await new Promise((resolve) => socket.addEventListener("open", resolve));
let nextId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  // Quitter une page modifiée (simulation) : on accepte la confirmation du navigateur.
  if (message.method === "Page.javascriptDialogOpening") {
    socket.send(
      JSON.stringify({ id: 0, method: "Page.handleJavaScriptDialog", params: { accept: true } }),
    );
  }
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message.result);
    pending.delete(message.id);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    nextId += 1;
    pending.set(nextId, resolve);
    socket.send(JSON.stringify({ id: nextId, method, params }));
  });
const evaluate = async (expression) => {
  const reply = await send("Runtime.evaluate", {
    awaitPromise: true,
    expression,
    returnByValue: true,
  });
  return reply.result?.value;
};
const waitForText = async (needle) => {
  for (let second = 0; second < WAIT_TIMEOUT_S; second += 1) {
    if (
      await evaluate(
        `document.body.innerText.toLowerCase().includes(${JSON.stringify(needle.toLowerCase())})`,
      )
    ) {
      return;
    }
    await sleep(1000);
  }
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(path.join(os.tmpdir(), "gstock-docs-echec.png"), Buffer.from(data, "base64"));
  const url = await evaluate("location.href");
  throw new Error(
    `Texte introuvable : ${needle} (page : ${url}, capture : ${os.tmpdir()}/gstock-docs-echec.png)`,
  );
};
const open = async (route, needle) => {
  await send("Page.navigate", { url: `${BASE}${route}` });
  await waitForText(needle);
  await evaluate(HELPERS);
};

// Rectangle d'un élément, en pourcentage de l'écran, un peu élargi et borné à l'image.
const measure = (find) =>
  evaluate(`(() => {
    const el = (${find});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const pad = ${PADDING_PX};
    const x1 = Math.max(0, r.left - pad), y1 = Math.max(0, r.top - pad);
    const x2 = Math.min(innerWidth, r.right + pad), y2 = Math.min(innerHeight, r.bottom + pad);
    if (x2 <= x1 || y2 <= y1) return null;
    const pct = (v, total) => +((v / total) * 100).toFixed(1);
    return { h: pct(y2 - y1, innerHeight), w: pct(x2 - x1, innerWidth), x: pct(x1, innerWidth), y: pct(y1, innerHeight) };
  })()`);

const figure = (shot, notes) => {
  const marks = notes.map(
    ({ box, note }) =>
      `:::annotation{x=${box.x} y=${box.y} w=${box.w} h=${box.h}${note.side ? ` side="${note.side}"` : ""}}\n${note.text}\n:::`,
  );
  return [
    `::screenshot{src="/captures/${shot.name}.webp" alt="${shot.alt}" viewport="${WIDTH}x${HEIGHT}"}`,
    ...marks,
    "::",
    "",
  ].join("\n");
};

await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  deviceScaleFactor: 1,
  height: HEIGHT,
  mobile: false,
  width: WIDTH,
});
await send("Page.navigate", { url: `${BASE}/login` });
await waitForText("Connexion");
const status = await evaluate(
  `fetch("/api/auth/sign-in/email", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: ${JSON.stringify(JSON.stringify(ACCOUNT))} }).then((r) => r.status)`,
);
if (status !== 200) {
  throw new Error(`Connexion refusée (${status}) : la base de démo est-elle chargée ?`);
}
// Thème d'origine, mode clair, visite déjà vue.
await evaluate(
  `localStorage.setItem("nuxt-color-mode", "light"); localStorage.removeItem("gstock-theme"); localStorage.setItem("gstock-tour-done", "1"); Object.keys(localStorage).filter((k) => k.startsWith("gstock-table-")).forEach((k) => localStorage.removeItem(k));`,
);

await mkdir(path.join(ROOT, "public", "captures"), { recursive: true });
await mkdir(path.join(ROOT, "figures"), { recursive: true });

for (const shot of SHOTS) {
  if (shot.from) {
    await open(shot.from.path, shot.from.wait);
    await sleep(1500);
    const href = await evaluate(
      `document.querySelector(${JSON.stringify(shot.from.link)})?.getAttribute("href")`,
    );
    if (!href) {
      throw new Error(`${shot.name} : lien introuvable (${shot.from.link})`);
    }
    await open(href, shot.wait);
  } else {
    await open(shot.path, shot.wait);
  }
  await sleep(2000);
  if (shot.before) {
    await evaluate(shot.before);
    if (shot.reload) {
      await open(shot.path, shot.wait);
    }
    await sleep(shot.settle ?? 800);
    await evaluate(HELPERS);
  }
  if (shot.after) {
    await evaluate(shot.after);
    await sleep(900);
  }
  // Pointeur hors de la page : pas d'infobulle ni de survol sur la capture.
  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: WIDTH - 2,
    y: HEIGHT - 2,
  });
  await sleep(400);

  const notes = [];
  for (const note of shot.notes) {
    const box = await measure(note.find);
    if (box) {
      notes.push({ box, note });
    } else {
      console.warn(`  ! ${shot.name} : élément absent ou hors écran (${note.find})`);
    }
  }
  // WebP : environ le même poids qu'un PNG à cette qualité, sans perte visible sur l'interface.
  const { data } = await send("Page.captureScreenshot", { format: "webp", quality: 90 });
  await writeFile(
    path.join(ROOT, "public", "captures", `${shot.name}.webp`),
    Buffer.from(data, "base64"),
  );
  await writeFile(path.join(ROOT, "figures", `${shot.name}.md`), figure(shot, notes));
  console.log(`capture : ${shot.name} (${notes.length} note(s))`);
  await evaluate(
    `document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))`,
  );
}

socket.close();
browser.kill();
process.exit(0);
