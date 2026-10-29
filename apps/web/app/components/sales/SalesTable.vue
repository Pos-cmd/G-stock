<script setup lang="ts">
import { formatDate, formatFcfa, formatQty } from "@G-stock/core/format";
import type { TableColumn } from "@nuxt/ui";
import { keepPreviousData, useQuery } from "@tanstack/vue-query";

import DataTable from "~/components/common/DataTable.vue";
import KpiCard from "~/components/common/KpiCard.vue";
import SaleStatusBadge from "~/components/sales/SaleStatusBadge.vue";
import type { SaleRow } from "~/types/api";

const icons = useIcons();

/** Historique paginé des ventes, avec les totaux de la sélection. */
const {
  customerId = null,
  filters,
  showCustomer = true,
} = defineProps<{
  filters: SalesFilterState;
  customerId?: string | null;
  showCustomer?: boolean;
}>();

/** `stacked` : les filtres sont dans le menu « Filtres », l'un sous l'autre. */
defineSlots<{ filters?: (props: { stacked: boolean }) => unknown }>();

const SEARCH_DEBOUNCE_MS = 300;

const { $orpc } = useNuxtApp();
const page = ref(1);
const pageSize = ref(25);
// Tri demandé au serveur ; la colonne « Vente » trie par date.
const sorting = ref<{ desc: boolean; id: string }[]>([]);
const SORT_KEYS = {
  customerName: "customerName",
  netFcfa: "netFcfa",
  reference: "saleDate",
} as const;
const sort = computed(() => {
  const [first] = sorting.value;
  const id = first ? SORT_KEYS[first.id as keyof typeof SORT_KEYS] : undefined;
  return first && id ? { desc: first.desc, id } : null;
});
// La recherche se tape dans le tableau ; le serveur cherche (référence, client).
const search = ref(filters.search);
const debouncedSearch = refDebounced(search, SEARCH_DEBOUNCE_MS);

const input = computed(() => ({
  ...toSaleListInput({ ...filters, search: debouncedSearch.value }, customerId ?? undefined),
  page: page.value,
  pageSize: pageSize.value,
  sort: sort.value,
}));
watch(
  () => JSON.stringify({ ...input.value, page: 0, pageSize: 0 }),
  () => {
    page.value = 1;
  },
);

// Filtres actifs (la période compte pour un), pour le bouton « Filtres ».
const activeFilters = computed(
  () =>
    [
      filters.from || filters.to,
      filters.productId,
      filters.status !== ALL,
      filters.paymentState !== ALL,
    ].filter(Boolean).length,
);

const sales = useQuery(
  computed(() => ({
    ...$orpc.sales.list.queryOptions({ input: input.value }),
    placeholderData: keepPreviousData,
  })),
);
const totals = computed(() => sales.data.value?.totals);

const linesLabel = (sale: SaleRow) => {
  const [first, ...others] = sale.lines;
  if (!first) {
    return "—";
  }
  const label = `${first.productName} × ${formatQty(first.qty)}`;
  return others.length > 0
    ? `${label} + ${others.length} autre${others.length > 1 ? "s" : ""}`
    : label;
};

const rightAligned = { class: { td: "text-right", th: "text-right" } };
const columns = computed<TableColumn<SaleRow>[]>(() => [
  { accessorKey: "reference", enableHiding: false, header: "Vente" },
  ...(showCustomer ? [{ accessorKey: "customerName", header: "Client" }] : []),
  { accessorKey: "lines", header: "Articles" },
  { accessorKey: "netFcfa", header: "Montant", meta: rightAligned },
  { accessorKey: "dueFcfa", header: "Reste dû", meta: rightAligned },
  { accessorKey: "status", header: "Statut" },
]);
</script>

<template>
  <div class="space-y-4">
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Chiffre d'affaires"
        :icon="icons.revenue"
        :loading="sales.isPending.value"
        :value="formatFcfa(totals?.netFcfa ?? 0)"
        :hint="`${totals?.count ?? 0} vente(s), remises déduites`"
      />
      <KpiCard
        label="Marge brute"
        :icon="icons.profit"
        color="success"
        :loading="sales.isPending.value"
        :value="formatFcfa(totals?.marginFcfa ?? 0)"
        :hint="formatMarginRate(totals?.marginFcfa ?? 0, totals?.netFcfa ?? 0) ?? ''"
      />
      <KpiCard
        label="Coût de revient"
        :icon="icons.product"
        color="neutral"
        :loading="sales.isPending.value"
        :value="formatFcfa(totals?.costFcfa ?? 0)"
        hint="Lots sortis du stock (FIFO)"
      />
      <KpiCard
        label="Reste à encaisser"
        :icon="icons.pending"
        color="warning"
        :loading="sales.isPending.value"
        :value="formatFcfa(totals?.dueFcfa ?? 0)"
      />
    </div>

    <DataTable
      v-model:page="page"
      v-model:page-size="pageSize"
      v-model:search="search"
      v-model:sorting="sorting"
      :server-sortable="['reference', 'customerName', 'netFcfa']"
      filters-menu
      :active-filters="activeFilters"
      :total="sales.data.value?.total ?? 0"
      search-placeholder="N° de vente, client…"
      :item-label="['vente', 'ventes']"
      storage-key="sales"
      :data="sales.data.value?.items ?? []"
      :columns="columns"
      :loading="sales.isFetching.value"
    >
      <template v-if="$slots.filters" #filters="{ stacked }">
        <slot name="filters" :stacked="stacked" />
      </template>
      <template #reference-cell="{ row }">
        <NuxtLink :to="`/ventes/${row.original.id}`" class="group block">
          <span class="text-highlighted font-mono text-[13px] font-medium group-hover:underline">
            {{ row.original.reference }}
          </span>
          <p class="text-dimmed text-xs">
            {{ formatDate(row.original.saleDate) }} · {{ formatDaysAgo(row.original.saleDate) }}
          </p>
        </NuxtLink>
      </template>
      <template #customerName-cell="{ row }">
        <NuxtLink :to="`/clients/${row.original.customerId}`" class="hover:underline">
          {{ row.original.customerName }}
        </NuxtLink>
      </template>
      <template #lines-cell="{ row }">
        <span class="text-muted line-clamp-1 max-w-64">{{ linesLabel(row.original) }}</span>
      </template>
      <template #netFcfa-cell="{ row }">
        <span
          class="font-medium tabular-nums"
          :class="
            row.original.status === 'cancelled' ? 'text-dimmed line-through' : 'text-highlighted'
          "
        >
          {{ formatFcfa(row.original.netFcfa) }}
        </span>
        <p
          v-if="row.original.status === 'active'"
          class="text-xs tabular-nums"
          :class="row.original.marginFcfa < 0 ? 'text-error' : 'text-dimmed'"
        >
          marge {{ formatFcfa(row.original.marginFcfa) }}
        </p>
      </template>
      <template #dueFcfa-cell="{ row }">
        <span v-if="row.original.dueFcfa > 0" class="text-warning font-medium tabular-nums">
          {{ formatFcfa(row.original.dueFcfa) }}
        </span>
        <span v-else class="text-dimmed">—</span>
      </template>
      <template #status-cell="{ row }">
        <SaleStatusBadge :status="row.original.status" :due-fcfa="row.original.dueFcfa" />
      </template>
      <template #empty>
        <div class="flex flex-col items-center gap-2 py-10 text-center">
          <UIcon :name="icons.sale" class="text-dimmed size-10" />
          <p class="text-muted">Aucune vente ne correspond à ces critères.</p>
        </div>
      </template>
    </DataTable>
  </div>
</template>
