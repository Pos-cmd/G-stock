<script setup lang="ts">
import type { StockStatus } from "@G-stock/core/enums";
import { STOCK_STATUS_LABELS } from "@G-stock/core/labels";

defineProps<{ status: StockStatus }>();

const colors = { low: "warning", ok: "success", out: "error" } as const;
const icons = {
  low: "i-lucide-triangle-alert",
  ok: "i-lucide-circle-check",
  out: "i-lucide-circle-x",
} as const;
</script>

<template>
  <UBadge :color="colors[status]" :icon="icons[status]" variant="subtle" size="sm">
    {{ STOCK_STATUS_LABELS[status] }}
  </UBadge>
</template>
