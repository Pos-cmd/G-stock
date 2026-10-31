<script setup lang="ts">
import type { MovementType } from "@G-stock/core/enums";
import {
  formatDate,
  formatDateTime,
  formatFcfa,
  formatQty,
} from "@G-stock/core/format";
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

/** `stacked` : les filtres sont dans le menu « Filtres », l'un sous l'autre. */
defineSlots<{ filters?: (props: { stacked: boolean }) => unknown }>();

const { $orpc } = useNuxtApp();
const page = ref(1);
const pageSize = ref(25);
const SEARCH_DEBOUNCE_MS = 300;
const search = ref("");
const debouncedSearch = refDebounced(search, SEARCH_DEBOUNCE_MS);
const sorting = ref<{ desc: boolean; id: string }[]>([]);
const MOVEMENT_SORT_KEYS = [
  "occurredAt",
  "createdAt",
  "productName",
  "qty",
  "unitCostFcfa",
] as const;
const sort = computed(() => {
  const [first] = sorting.value;
  const id = MOVEMENT_SORT_KEYS.find((key) => key === first?.id);
  return first && id ? { desc: first.desc, id } : null;
});
watch([debouncedSearch, sort], () => {
  page.value = 1;
});

watch(
  () => filters,
  () => {
    page.value = 1;
  },
  { deep: true }
);

const activeFilters = computed(
  () =>
    [filters.productId, filters.type, filters.from || filters.to].filter(
      Boolean
    ).length
);

const movements = useQuery(
  computed(() => ({
    ...$orpc.stock.movements.list.queryOptions({
      input: {
        ...filters,
        page: page.value,
        pageSize: pageSize.value,
        search: debouncedSearch.value || null,
        sort: sort.value,
      },
    }),
    placeholderData: keepPreviousData,
  }))
);

const typeColors = {
  adjustment: "warning",
  in: "success",
  out: "info",
} as const;

/** La vente du client, ou la commande du fournisseur, d'où vient le mouvement. */
const partyLink = (party: NonNullable<StockMovementRow["party"]>) =>
  party.kind === "customer" ? `/ventes/${party.id}` : `/achats/${party.id}`;

const rightAligned = { class: { td: "text-right", th: "text-right" } };
const columns = computed<TableColumn<StockMovementRow>[]>(() => [
  { accessorKey: "occurredAt", enableHiding: false, header: "Date" },
  showProduct
    ? { accessorKey: "productName", header: "Produit" }
    : { accessorKey: "lotCode", header: "Lot" },
  { accessorKey: "type", header: "Type" },
  { accessorKey: "qty", header: "Quantité", meta: rightAligned },
  { accessorKey: "stockAfter", header: "Stock après", meta: rightAligned },
  { accessorKey: "unitCostFcfa", header: "Valeur", meta: rightAligned },
  { accessorKey: "reason", header: "Motif" },
  { accessorKey: "createdAt", header: "Enregistré le" },
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
    v-model:search="search"
    v-model:sorting="sorting"
    :server-sortable="[...MOVEMENT_SORT_KEYS]"
    filters-menu
    :active-filters="activeFilters"
    search-placeholder="Produit, lot, motif, client…"
    :item-label="['mouvement', 'mouvements']"
    storage-key="movements-v2"
  >
    <template v-if="$slots.filters" #filters="{ stacked }">
      <slot name="filters" :stacked="stacked" />
    </template>

    <template #occurredAt-cell="{ row }">
      <span class="text-highlighted font-medium whitespace-nowrap">{{
        formatDate(row.original.occurredAt)
      }}</span>
    </template>

    <template #createdAt-cell="{ row }">
      <span class="text-muted whitespace-nowrap">{{
        formatDateTime(row.original.createdAt)
      }}</span>
      <p class="text-dimmed text-xs">
        par {{ row.original.authorName ?? "—" }}
      </p>
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

    <template #stockAfter-cell="{ row }">
      <span
        class="font-medium tabular-nums"
        :class="row.original.stockAfter < 0 ? 'text-error' : ''"
      >
        {{ formatQty(row.original.stockAfter, row.original.productUnit) }}
      </span>
    </template>

    <template #unitCostFcfa-cell="{ row }">
      <span class="tabular-nums">{{
        formatFcfa(Math.abs(row.original.qty) * row.original.unitCostFcfa)
      }}</span>
      <p class="text-dimmed text-xs">
        {{ formatFcfa(row.original.unitCostFcfa) }} / u.
      </p>
    </template>

    <template #reason-cell="{ row }">
      <span
        class="text-muted line-clamp-2 max-w-64"
        :title="row.original.reason ?? undefined"
      >
        {{ row.original.reason ?? "—" }}
      </span>
      <p v-if="row.original.party" class="mt-0.5 max-w-64 text-xs">
        <NuxtLink
          :to="partyLink(row.original.party)"
          class="text-dimmed hover:text-default truncate hover:underline"
          :title="row.original.party.name"
        >
          {{ row.original.party.name }}
        </NuxtLink>
      </p>
    </template>

    <template #empty>
      <div class="text-muted py-8 text-center">
        Aucun mouvement pour ces critères.
      </div>
    </template>
  </DataTable>
</template>
