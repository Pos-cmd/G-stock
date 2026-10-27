<script setup lang="ts">
import type { PurchaseOrderStatus } from "@G-stock/core/enums";
import { PURCHASE_ORDER_STATUS_LABELS } from "@G-stock/core/labels";

defineProps<{ status: PurchaseOrderStatus }>();

const colors = {
  cancelled: "neutral",
  draft: "neutral",
  in_transit: "info",
  ordered: "warning",
  received: "success",
} as const;
const icons = {
  cancelled: "i-lucide-ban",
  draft: "i-lucide-pencil-line",
  in_transit: "i-lucide-ship",
  ordered: "i-lucide-send",
  received: "i-lucide-package-check",
} as const;
</script>

<template>
  <UBadge
    :color="colors[status]"
    :icon="icons[status]"
    :variant="status === 'cancelled' ? 'outline' : 'subtle'"
    size="sm"
  >
    {{ PURCHASE_ORDER_STATUS_LABELS[status] }}
  </UBadge>
</template>
