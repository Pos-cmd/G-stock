<script setup lang="ts">
import ComingSoon from "~/components/common/ComingSoon.vue";
import PagePanel from "~/components/layout/PagePanel.vue";

useHead({ title: "Achats fournisseurs" });

const features = [
  "Commande fournisseur : produits, quantités, prix en RMB",
  "Frais maritimes (CBM × coût/CBM) et transport local",
  "Prix de revient par lot : répartition proportionnelle ou égale des frais",
  "Conversion RMB → USD → FCFA avec taux figés à la commande",
  "Réception de la marchandise → création automatique des lots",
];
</script>

<template>
  <PagePanel id="purchases" title="Achats fournisseurs" icon="i-lucide-ship">
    <ComingSoon
      icon="i-lucide-ship"
      description="Commandes en Chine, frais d'approche et réception en stock."
      :features="features"
    />
  </PagePanel>
</template>
