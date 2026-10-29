import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    ignorePatterns: [
      "node_modules/**",
      "**/node_modules/**",
      "apps/web/.nuxt/**",
      "apps/web/.output/**",
      "apps/web/.data/**",
      "apps/web/.nitro/**",
      "packages/db/dist/**",
      "packages/api/dist/**",
      "packages/auth/dist/**",
      "packages/db/local.db*",
      // Documentation : sortie de Nuxt et fichiers générés.
      "apps/docs/.nuxt/**",
      "apps/docs/.output/**",
      "apps/docs/.data/**",
      "apps/docs/app/figures/**",
      "apps/docs/public/comark.js",
    ],
    options: {
      typeAware: false,
      typeCheck: false,
    },
  },
  fmt: {
    ignorePatterns: [
      "node_modules/**",
      "**/node_modules/**",
      "apps/web/.nuxt/**",
      "apps/web/.output/**",
      "apps/web/.data/**",
      "apps/web/.nitro/**",
      "packages/db/dist/**",
      "packages/api/dist/**",
      "packages/auth/dist/**",
      "packages/db/local.db*",
      // Documentation : sortie de Nuxt et fichiers générés.
      "apps/docs/.nuxt/**",
      "apps/docs/.output/**",
      "apps/docs/.data/**",
      "apps/docs/app/figures/**",
      "apps/docs/public/comark.js",
      // Pages MDC et figures comark-ui : le formateur Markdown casse les blocs `::`.
      "apps/docs/content/**",
      "apps/docs/figures/**",
    ],
    singleQuote: false,
    semi: true,
    sortPackageJson: true,
  },
  staged: {
    "*.{js,ts,jsx,tsx,vue,svelte,json,jsonc,css,md}": "vp check --fix",
  },
});
