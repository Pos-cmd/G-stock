<script setup lang="ts">
import type { TabsItem } from "@nuxt/ui";

// Choix de la période des tendances (4, 13 ou 26 semaines), en pilule.
const weeks = defineModel<TrendPeriod>({ required: true });

const items: TabsItem[] = TREND_PERIODS.map((value) => ({ label: `${value} sem.`, value }));
</script>

<template>
  <UTabs v-model="weeks" :items="items" :content="false" size="sm" />
</template>
