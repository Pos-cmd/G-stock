<script setup lang="ts">
import ComingSoon from "~/components/common/ComingSoon.vue";
import PagePanel from "~/components/layout/PagePanel.vue";

useHead({ title: "Clients débiteurs" });

const features = [
  "Fiche client : nom, contact, solde dû",
  "Paiements partiels et remboursements",
  "Liste des créances triée par ancienneté",
  "Alertes visuelles selon les seuils définis dans les paramètres",
];
</script>

<template>
  <PagePanel id="customers" title="Clients débiteurs" icon="i-lucide-users">
    <ComingSoon
      icon="i-lucide-users"
      description="Suivez qui vous doit combien, et depuis quand."
      :features="features"
    />
  </PagePanel>
</template>
