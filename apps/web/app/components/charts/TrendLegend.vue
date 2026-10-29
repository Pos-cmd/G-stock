<script setup lang="ts">
// Légende des courbes de tendance d'un tableau : période et période précédente.
defineProps<{ weeks: number }>();
</script>

<template>
  <span>{{ trendPeriodLabel(weeks) }}</span>
  <span class="flex items-center gap-1.5">
    <span class="h-0.5 w-3 rounded-full bg-(--ui-chart-1)" />
    Période
  </span>
  <span class="flex items-center gap-1.5">
    <span class="h-0.5 w-3 rounded-full bg-(--ui-chart-2)" />
    Période précédente
  </span>
</template>
