<script setup lang="ts">
import { fr } from "@nuxt/ui/locale";
import { VueQueryDevtools } from "@tanstack/vue-query-devtools";

useHead({
  titleTemplate: (title) => (title ? `${title} · G-stock` : "G-stock"),
});
</script>

<template>
  <NuxtAnnouncer />
  <NuxtRouteAnnouncer />
  <NuxtLoadingIndicator />
  <UApp :locale="fr">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
  <VueQueryDevtools />
</template>
