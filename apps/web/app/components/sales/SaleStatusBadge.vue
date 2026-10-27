<script setup lang="ts">
import type { SaleStatus } from "@G-stock/core/enums";

/** Annulée, soldée, ou reste dû. */
const { dueFcfa, status } = defineProps<{
  status: SaleStatus;
  dueFcfa: number;
}>();

const badge = computed(() => {
  if (status === "cancelled") {
    return {
      color: "neutral",
      icon: "i-lucide-ban",
      label: "Annulée",
      variant: "outline",
    } as const;
  }
  if (dueFcfa > 0) {
    return {
      color: "warning",
      icon: "i-lucide-hourglass",
      label: "Reste dû",
      variant: "subtle",
    } as const;
  }
  return {
    color: "success",
    icon: "i-lucide-circle-check",
    label: "Soldée",
    variant: "subtle",
  } as const;
});
</script>

<template>
  <UBadge :color="badge.color" :icon="badge.icon" :variant="badge.variant" size="sm">
    {{ badge.label }}
  </UBadge>
</template>
