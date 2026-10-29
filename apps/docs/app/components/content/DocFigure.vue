<script setup lang="ts">
/**
 * Capture annotée (comark-ui) dans une page de la documentation : `:doc-figure{name="ventes"}`.
 * Les figures sont rendues à l'avance par `pnpm --filter docs figures` (figures/*.md →
 * app/figures/*.html) ; leurs styles sont partagés, leur script (zoom, copie) chargé une fois.
 */
import "~/figures/comark.css";

const { name } = defineProps<{ name: string }>();

const FIGURES = import.meta.glob<string>("../../figures/*.html", {
  eager: true,
  import: "default",
  query: "?raw",
});

const html = computed(
  () => Object.entries(FIGURES).find(([file]) => file.endsWith(`/${name}.html`))?.[1] ?? "",
);

useHead({ script: [{ defer: true, key: "comark", src: "/comark.js" }] });
</script>

<template>
  <!-- HTML produit par notre propre rendu, à partir des fichiers figures/*.md du dépôt. -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div v-if="html" class="doc-figure not-prose my-6" v-html="html" />
  <p v-else class="text-error">Figure introuvable : {{ name }}</p>
</template>
