import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { MIGRATIONS_FOLDER } from "@G-stock/db/migrate";
import { z } from "zod";

// libsql loads its platform binding by a computed name, which file tracing can't follow
const libsqlRequire = createRequire(import.meta.resolve("libsql"));
const libsqlPackage = z
  .object({
    optionalDependencies: z.record(z.string(), z.string()),
  })
  .parse(libsqlRequire("./package.json"));
const libsqlBindings = Object.keys(libsqlPackage.optionalDependencies).flatMap((name) => {
  try {
    return [libsqlRequire.resolve(name)];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "MODULE_NOT_FOUND") {
      return [];
    }
    throw error;
  }
});
const apiReference = {
  path: fileURLToPath(new URL("../../packages/api", import.meta.url)),
};

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    head: {
      htmlAttrs: { lang: "fr" },
      title: "G-stock",
    },
  },
  compatibilityDate: "latest",
  css: ["~/assets/css/main.css"],
  devServer: {
    port: 3001,
  },
  devtools: { enabled: true },
  experimental: {
    payloadExtraction: "client",
  },
  hooks: {
    "vite:extendConfig"(config, { isClient }) {
      if (!isClient || !config.optimizeDeps) {
        return;
      }
      // Vue Query uses devtools-api 6, whose CommonJS entry needs optimization.
      config.optimizeDeps.exclude = config.optimizeDeps.exclude?.filter(
        (dependency) => dependency !== "@vue/devtools-api",
      );
    },
  },
  modules: ["@varlock/nuxt-integration", "@nuxt/ui", "@pinia/nuxt", "@vueuse/nuxt"],
  nitro: {
    externals: { traceInclude: libsqlBindings },
    typescript: {
      tsConfig: { references: [apiReference] },
    },
  },
  runtimeConfig: {
    migrationsFolder: MIGRATIONS_FOLDER,
  },
  typescript: {
    nodeTsConfig: { references: [apiReference] },
    sharedTsConfig: { references: [apiReference] },
    tsConfig: { references: [apiReference] },
  },
  varlock: {
    ssrInjectMode: "auto-load",
  },
  vite: {
    optimizeDeps: {
      include: [
        "nuxt > @nuxt/devtools > @vue/devtools-core",
        "nuxt > @nuxt/devtools > @vue/devtools-kit",
        "better-auth/vue",
        "zod",
        "@orpc/client",
        "@orpc/client/fetch",
        "@orpc/tanstack-query",
        "@tanstack/vue-query",
        "@tanstack/vue-query > @vue/devtools-api",
        "@tanstack/vue-query-devtools",
      ],
    },
  },
});
