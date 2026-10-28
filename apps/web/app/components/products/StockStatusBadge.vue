<script setup lang="ts">
import type { StockStatus } from "@G-stock/core/enums";
import { STOCK_STATUS_LABELS } from "@G-stock/core/labels";

const icons = useIcons();

defineProps<{ status: StockStatus }>();

const colors = { low: "warning", ok: "success", out: "error" } as const;
const statusIcons = {
  low: icons.stockLow,
  ok: icons.stockOk,
  out: icons.stockOut,
};
</script>

<template>
  <UBadge :color="colors[status]" :icon="statusIcons[status]" variant="subtle" size="sm">
    {{ STOCK_STATUS_LABELS[status] }}
  </UBadge>
</template>
