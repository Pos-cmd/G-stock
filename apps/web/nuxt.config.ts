import { createRequire } from "node:module";

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
    if (error instanceof Error && "code" in error && error.code === "MODULE_NOT_FOUND") return [];
    throw error;
  }
});
import { fileURLToPath } from "node:url";

const apiReference = { path: fileURLToPath(new URL("../../packages/api", import.meta.url)) };

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  typescript: {
    tsConfig: { references: [apiReference] },
    nodeTsConfig: { references: [apiReference] },
    sharedTsConfig: { references: [apiReference] },
  },
  compatibilityDate: "latest",
  devtools: { enabled: true },
  experimental: {
    payloadExtraction: "client",
  },
  modules: ["@varlock/nuxt-integration", "@nuxt/ui"],
  varlock: {
    ssrInjectMode: "auto-load",
  },
  css: ["~/assets/css/main.css"],
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
  hooks: {
    "vite:extendConfig"(config, { isClient }) {
      if (!isClient || !config.optimizeDeps) return;
      // Vue Query uses devtools-api 6, whose CommonJS entry needs optimization.
      config.optimizeDeps.exclude = config.optimizeDeps.exclude?.filter(
        (dependency) => dependency !== "@vue/devtools-api",
      );
    },
  },
  devServer: {
    port: 3001,
  },
  nitro: {
    externals: { traceInclude: libsqlBindings },
    typescript: {
      tsConfig: { references: [apiReference] },
    },
  },
});
