<script setup lang="ts">
import type { MovementType } from "@G-stock/core/enums";
import { formatDateTime, formatFcfa, formatQty } from "@G-stock/core/format";
import { MOVEMENT_TYPE_LABELS } from "@G-stock/core/labels";
import type { TableColumn } from "@nuxt/ui";
import { keepPreviousData, useQuery } from "@tanstack/vue-query";

import DataTable from "~/components/common/DataTable.vue";
import type { StockMovementRow } from "~/types/api";

const { filters = {}, showProduct = true } = defineProps<{
  filters?: {
    productId?: string | null;
    type?: MovementType | null;
    from?: Date | null;
    to?: Date | null;
  };
  showProduct?: boolean;
}>();

defineSlots<{ filters?: () => unknown }>();

const { $orpc } = useNuxtApp();
const page = ref(1);
const pageSize = ref(25);

watch(
  () => filters,
  () => {
    page.value = 1;
  },
  { deep: true },
);

const movements = useQuery(
  computed(() => ({
    ...$orpc.stock.movements.list.queryOptions({
      input: { ...filters, page: page.value, pageSize: pageSize.value },
    }),
    placeholderData: keepPreviousData,
  })),
);

const typeColors = {
  adjustment: "warning",
  in: "success",
  out: "info",
} as const;

const rightAligned = { class: { td: "text-right", th: "text-right" } };
const columns = computed<TableColumn<StockMovementRow>[]>(() => [
  { accessorKey: "createdAt", enableHiding: false, header: "Date" },
  showProduct
    ? { accessorKey: "productName", header: "Produit" }
    : { accessorKey: "lotCode", header: "Lot" },
  { accessorKey: "type", header: "Type" },
  { accessorKey: "qty", header: "Quantité", meta: rightAligned },
  { accessorKey: "unitCostFcfa", header: "Valeur", meta: rightAligned },
  { accessorKey: "reason", header: "Motif" },
]);
</script>

<template>
  <DataTable
    v-model:page="page"
    v-model:page-size="pageSize"
    :data="movements.data.value?.items ?? []"
    :columns="columns"
    :loading="movements.isFetching.value"
    :total="movements.data.value?.total ?? 0"
    :searchable="false"
    :item-label="['mouvement', 'mouvements']"
    storage-key="movements"
  >
    <template v-if="$slots.filters" #filters>
      <slot name="filters" />
    </template>

    <template #createdAt-cell="{ row }">
      <span class="whitespace-nowrap">{{ formatDateTime(row.original.createdAt) }}</span>
      <p class="text-dimmed text-xs">par {{ row.original.authorName ?? "—" }}</p>
    </template>

    <template #productName-cell="{ row }">
      <NuxtLink
        :to="`/produits/${row.original.productId}`"
        class="text-highlighted font-medium hover:underline"
      >
        {{ row.original.productName }}
      </NuxtLink>
      <p class="text-dimmed font-mono text-xs">{{ row.original.lotCode }}</p>
    </template>

    <template #lotCode-cell="{ row }">
      <span class="font-mono text-xs">{{ row.original.lotCode }}</span>
    </template>

    <template #type-cell="{ row }">
      <UBadge :color="typeColors[row.original.type]" variant="subtle" size="sm">
        {{ MOVEMENT_TYPE_LABELS[row.original.type] }}
      </UBadge>
    </template>

    <template #qty-cell="{ row }">
      <span
        class="font-medium tabular-nums"
        :class="row.original.qty >= 0 ? 'text-success' : 'text-error'"
      >
        {{ row.original.qty > 0 ? "+" : ""
        }}{{ formatQty(row.original.qty, row.original.productUnit) }}
      </span>
    </template>

    <template #unitCostFcfa-cell="{ row }">
      <span class="tabular-nums">{{
        formatFcfa(Math.abs(row.original.qty) * row.original.unitCostFcfa)
      }}</span>
      <p class="text-dimmed text-xs">{{ formatFcfa(row.original.unitCostFcfa) }} / u.</p>
    </template>

    <template #reason-cell="{ row }">
      <span class="text-muted line-clamp-2 max-w-64">{{ row.original.reason ?? "—" }}</span>
    </template>

    <template #empty>
      <div class="text-muted py-8 text-center">Aucun mouvement pour ces critères.</div>
    </template>
  </DataTable>
</template>
