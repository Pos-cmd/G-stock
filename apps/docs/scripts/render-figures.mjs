// Rend les figures comark-ui (captures annotées) de figures/*.md en fragments HTML, lus par le
// composant de contenu <DocFigure>. Styles et scripts (zoom, copie), identiques pour toutes les
// figures, sont écrits une seule fois : app/figures/comark.css et public/comark.js.
// Usage : pnpm --filter docs figures
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createHtmlRenderer } from "@comark/html";
import comarkUi from "comark-ui/html";

const ROOT = path.dirname(import.meta.dirname);
const SOURCE = path.join(ROOT, "figures");
const OUTPUT = path.join(ROOT, "app", "figures");
const STYLE_BLOCK = /<style>(?<code>[\s\S]*?)<\/style>/gu;
const SCRIPT_BLOCK = /<script>(?<code>[\s\S]*?)<\/script>/gu;
const MARKDOWN_EXTENSION = /\.md$/u;

// Rendu hors ligne : pas de favicon, d'icône ni de diagramme téléchargés ; le site met en forme
// le texte autour (Docus).
const render = createHtmlRenderer(
  comarkUi({
    chips: { download: false },
    diagrams: { draw: false },
    icon: { fetch: false },
    typeset: false,
  }),
);

const blocks = (html, pattern) => [...html.matchAll(pattern)].map((match) => match.groups.code);

const renderFigure = async (file) => {
  const markdown = await readFile(path.join(SOURCE, file), "utf-8");
  const html = await render(markdown);
  await writeFile(
    path.join(OUTPUT, file.replace(MARKDOWN_EXTENSION, ".html")),
    html.replaceAll(STYLE_BLOCK, "").replaceAll(SCRIPT_BLOCK, "").trim(),
  );
  return {
    scripts: blocks(html, SCRIPT_BLOCK),
    styles: blocks(html, STYLE_BLOCK),
  };
};

await mkdir(OUTPUT, { recursive: true });
const entries = await readdir(SOURCE);
const files = entries.filter((file) => MARKDOWN_EXTENSION.test(file));
const rendered = await Promise.all(files.map(renderFigure));
const unique = (key, separator) =>
  [...new Set(rendered.flatMap((figure) => figure[key]))].join(separator);
await writeFile(path.join(OUTPUT, "comark.css"), unique("styles", "\n"));
// Chaque script est une fonction appelée sur-le-champ : le « ; » empêche la suivante d'être lue
// comme un appel sur le résultat de la précédente.
await writeFile(path.join(ROOT, "public", "comark.js"), unique("scripts", ";\n"));
console.log(`${files.length} figure(s) rendue(s)`);
process.exit(0);
