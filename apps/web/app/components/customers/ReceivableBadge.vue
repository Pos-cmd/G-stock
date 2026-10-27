<script setup lang="ts">
import type { ReceivableLevel } from "@G-stock/core/enums";
import { RECEIVABLE_LEVEL_LABELS } from "@G-stock/core/labels";

defineProps<{ level: ReceivableLevel; days: number }>();

const colors = {
  alert: "warning",
  critical: "error",
  current: "neutral",
  warning: "info",
} as const;
</script>

<template>
  <UBadge :color="colors[level]" variant="subtle" size="sm" icon="i-lucide-clock">
    {{ RECEIVABLE_LEVEL_LABELS[level] }} · {{ days }} j
  </UBadge>
</template>
