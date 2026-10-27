<script setup lang="ts">
import ComingSoon from "~/components/common/ComingSoon.vue";
import PagePanel from "~/components/layout/PagePanel.vue";

useHead({ title: "Documents" });

const features = [
  "Reçus de vente, fiches de prix de revient, simulations",
  "Dossier local lié à chaque commande fournisseur",
  "Recherche et réouverture des documents",
];
</script>

<template>
  <PagePanel id="documents" title="Documents" icon="i-lucide-file-text">
    <ComingSoon
      icon="i-lucide-file-text"
      description="Tous les PDF générés, rangés par commande et par vente."
      :features="features"
    />
  </PagePanel>
</template>
