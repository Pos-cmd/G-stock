import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  // Pages MDC et figures comark-ui de la documentation : le formateur Markdown casse les blocs `::`.
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    "apps/docs/content/**",
    "apps/docs/figures/**",
    "apps/docs/app/figures/**",
    "apps/docs/public/comark.js",
  ],
});
