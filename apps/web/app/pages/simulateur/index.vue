<script setup lang="ts">
import ComingSoon from "~/components/common/ComingSoon.vue";
import PagePanel from "~/components/layout/PagePanel.vue";

useHead({ title: "Simulateur" });

const features = [
  "Saisie des données d'import et calcul du prix de revient",
  "Simulation de prix de vente et des marges",
  "Export PDF structuré du calcul",
];
</script>

<template>
  <PagePanel id="simulator" title="Simulateur" icon="i-lucide-calculator">
    <ComingSoon
      icon="i-lucide-calculator"
      description="Calculatrice commerciale pour préparer un import."
      :features="features"
    />
  </PagePanel>
</template>
