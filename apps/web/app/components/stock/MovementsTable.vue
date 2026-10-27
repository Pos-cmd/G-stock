<script setup lang="ts">
import type { MovementType } from "@G-stock/core/enums";
import { formatDateTime, formatFcfa, formatQty } from "@G-stock/core/format";
import { MOVEMENT_TYPE_LABELS } from "@G-stock/core/labels";
import type { TableColumn } from "@nuxt/ui";
import { keepPreviousData, useQuery } from "@tanstack/vue-query";

import type { StockMovementRow } from "~/types/api";

const PAGE_SIZE = 25;

const { filters = {}, showProduct = true } = defineProps<{
  filters?: {
    productId?: number | null;
    type?: MovementType | null;
    from?: Date | null;
    to?: Date | null;
  };
  showProduct?: boolean;
}>();

const { $orpc } = useNuxtApp();
const page = ref(1);

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
      input: { ...filters, page: page.value, pageSize: PAGE_SIZE },
    }),
    placeholderData: keepPreviousData,
  })),
);

const typeColors = {
  adjustment: "warning",
  in: "success",
  out: "info",
} as const;

const columns = computed<TableColumn<StockMovementRow>[]>(() => [
  { accessorKey: "createdAt", header: "Date" },
  ...(showProduct ? [{ accessorKey: "productName", header: "Produit" }] : []),
  { accessorKey: "lotCode", header: "Lot" },
  { accessorKey: "type", header: "Type" },
  {
    accessorKey: "qty",
    header: "Quantité",
    meta: { class: { td: "text-right", th: "text-right" } },
  },
  {
    accessorKey: "unitCostFcfa",
    header: "Valeur",
    meta: { class: { td: "text-right", th: "text-right" } },
  },
  { accessorKey: "reason", header: "Motif" },
  { accessorKey: "authorName", header: "Par" },
]);
</script>

<template>
  <div class="space-y-3">
    <UTable
      :data="movements.data.value?.items ?? []"
      :columns="columns"
      :loading="movements.isFetching.value"
      class="border-default rounded-lg border"
    >
      <template #createdAt-cell="{ row }">
        <span class="text-muted whitespace-nowrap">{{
          formatDateTime(row.original.createdAt)
        }}</span>
      </template>

      <template #productName-cell="{ row }">
        <NuxtLink
          :to="`/produits/${row.original.productId}`"
          class="text-highlighted font-medium hover:underline"
        >
          {{ row.original.productName }}
        </NuxtLink>
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

      <template #authorName-cell="{ row }">
        <span class="text-muted">{{ row.original.authorName ?? "—" }}</span>
      </template>

      <template #empty>
        <div class="text-muted py-8 text-center">Aucun mouvement pour ces critères.</div>
      </template>
    </UTable>

    <div
      v-if="(movements.data.value?.total ?? 0) > PAGE_SIZE"
      class="flex items-center justify-between gap-3"
    >
      <span class="text-muted text-sm">{{ movements.data.value?.total }} mouvements</span>
      <UPagination
        v-model:page="page"
        :total="movements.data.value?.total ?? 0"
        :items-per-page="PAGE_SIZE"
      />
    </div>
  </div>
</template>
