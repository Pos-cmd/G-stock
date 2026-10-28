<script setup lang="ts">
import type { PurchaseOrderStatus } from "@G-stock/core/enums";
import { PURCHASE_ORDER_STATUS_LABELS } from "@G-stock/core/labels";

const icons = useIcons();

defineProps<{ status: PurchaseOrderStatus }>();

const colors = {
  cancelled: "neutral",
  draft: "neutral",
  in_transit: "info",
  ordered: "warning",
  received: "success",
} as const;
const statusIcons = {
  cancelled: icons.cancel,
  draft: icons.purchaseDraft,
  in_transit: icons.purchaseInTransit,
  ordered: icons.purchaseOrdered,
  received: icons.purchaseReceived,
};
</script>

<template>
  <UBadge
    :color="colors[status]"
    :icon="statusIcons[status]"
    :variant="status === 'cancelled' ? 'outline' : 'subtle'"
    size="sm"
  >
    {{ PURCHASE_ORDER_STATUS_LABELS[status] }}
  </UBadge>
</template>
