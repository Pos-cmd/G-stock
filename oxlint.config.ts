import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import vue from "ultracite/oxlint/vue";

export default defineConfig({
  extends: [core, vue],
  ignorePatterns: core.ignorePatterns,
  overrides: [
    {
      // L'ordre des clés d'une table Drizzle fixe l'ordre des colonnes SQL ;
      // drizzle-kit exige un point d'entrée unique qui ré-exporte tout le schéma.
      files: ["packages/db/src/schema/**", "packages/db/src/relations.ts"],
      rules: {
        "oxc/no-barrel-file": "off",
        "sort-keys": "off",
      },
    },
    {
      // Conventions Nuxt : composants en PascalCase, composables en camelCase, routes en [param].vue.
      files: ["apps/web/app/**"],
      rules: {
        "unicorn/filename-case": "off",
      },
    },
  ],
});
