<script setup lang="ts">
import ComingSoon from "~/components/common/ComingSoon.vue";
import PagePanel from "~/components/layout/PagePanel.vue";

useHead({ title: "Ventes" });

const features = [
  "Sélection des produits, quantités et prix de vente",
  "Paiement comptant ou à crédit",
  "Sortie de stock FIFO sur les lots, avec calcul de marge",
  "Reçu / bon de vente en PDF",
  "Historique filtrable par date, produit et client",
];
</script>

<template>
  <PagePanel id="sales" title="Ventes" icon="i-lucide-shopping-cart">
    <ComingSoon
      icon="i-lucide-shopping-cart"
      description="Enregistrez vos ventes au comptant ou à crédit, avec sortie de stock automatique."
      :features="features"
    />
  </PagePanel>
</template>
