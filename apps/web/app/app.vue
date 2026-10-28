<script setup lang="ts">
import { fr } from "@nuxt/ui/locale";
import { VueQueryDevtools } from "@tanstack/vue-query-devtools";

useHead({
  titleTemplate: (title) => (title ? `${title} · G-stock` : "G-stock"),
});

// Champs numériques : flèches empilées à droite (champs plus étroits), et la valeur saisie est
// gardée telle quelle (sans `stepSnapping`, 350 000 devenait 400 000 avec un pas de 100 000).
const componentDefaults = {
  inputNumber: { orientation: "vertical" as const, stepSnapping: false },
};

const toaster = { expand: false }
</script>

<template>
  <NuxtAnnouncer />
  <NuxtRouteAnnouncer />
  <NuxtLoadingIndicator />
  <UTheme :props="componentDefaults">
    <UApp :locale="fr" :toaster="toaster">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UApp>
  </UTheme>
  <VueQueryDevtools />
</template>
