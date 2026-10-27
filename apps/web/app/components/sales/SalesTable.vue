<script setup lang="ts">
import { formatDate, formatFcfa, formatQty } from "@G-stock/core/format";
import type { TableColumn } from "@nuxt/ui";
import { keepPreviousData, useQuery } from "@tanstack/vue-query";

import KpiCard from "~/components/common/KpiCard.vue";
import SaleStatusBadge from "~/components/sales/SaleStatusBadge.vue";
import type { SaleRow } from "~/types/api";

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

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

const { $orpc } = useNuxtApp();
const page = ref(1);
const debouncedSearch = refDebounced(
  toRef(() => filters.search),
  SEARCH_DEBOUNCE_MS,
);

const input = computed(() => ({
  ...toSaleListInput({ ...filters, search: debouncedSearch.value }, customerId ?? undefined),
  page: page.value,
  pageSize: PAGE_SIZE,
}));
watch(
  () => JSON.stringify({ ...input.value, page: 0 }),
  () => {
    page.value = 1;
  },
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
  { accessorKey: "reference", header: "Vente" },
  { accessorKey: "saleDate", header: "Date" },
  ...(showCustomer ? [{ accessorKey: "customerName", header: "Client" }] : []),
  { accessorKey: "lines", header: "Articles" },
  { accessorKey: "netFcfa", header: "Montant", meta: rightAligned },
  { accessorKey: "marginFcfa", header: "Marge", meta: rightAligned },
  { accessorKey: "dueFcfa", header: "Reste dû", meta: rightAligned },
  { accessorKey: "status", header: "Statut" },
]);
</script>

<template>
  <div class="space-y-4">
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Chiffre d'affaires"
        icon="i-lucide-trending-up"
        :loading="sales.isPending.value"
        :value="formatFcfa(totals?.netFcfa ?? 0)"
        :hint="`${totals?.count ?? 0} vente(s), remises déduites`"
      />
      <KpiCard
        label="Marge brute"
        icon="i-lucide-piggy-bank"
        color="success"
        :loading="sales.isPending.value"
        :value="formatFcfa(totals?.marginFcfa ?? 0)"
        :hint="formatMarginRate(totals?.marginFcfa ?? 0, totals?.netFcfa ?? 0) ?? ''"
      />
      <KpiCard
        label="Coût de revient"
        icon="i-lucide-package"
        color="neutral"
        :loading="sales.isPending.value"
        :value="formatFcfa(totals?.costFcfa ?? 0)"
        hint="Lots sortis du stock (FIFO)"
      />
      <KpiCard
        label="Reste à encaisser"
        icon="i-lucide-hourglass"
        color="warning"
        :loading="sales.isPending.value"
        :value="formatFcfa(totals?.dueFcfa ?? 0)"
      />
    </div>

    <UTable
      :data="sales.data.value?.items ?? []"
      :columns="columns"
      :loading="sales.isFetching.value"
      class="border-default rounded-lg border"
    >
      <template #reference-cell="{ row }">
        <NuxtLink
          :to="`/ventes/${row.original.id}`"
          class="text-highlighted font-mono text-sm font-medium hover:underline"
        >
          {{ row.original.reference }}
        </NuxtLink>
      </template>
      <template #saleDate-cell="{ row }">
        {{ formatDate(row.original.saleDate) }}
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
      </template>
      <template #marginFcfa-cell="{ row }">
        <span
          v-if="row.original.status === 'active'"
          class="tabular-nums"
          :class="row.original.marginFcfa < 0 ? 'text-error' : 'text-muted'"
        >
          {{ formatFcfa(row.original.marginFcfa) }}
        </span>
        <span v-else class="text-dimmed">—</span>
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
          <UIcon name="i-lucide-receipt" class="text-dimmed size-10" />
          <p class="text-muted">Aucune vente ne correspond à ces critères.</p>
        </div>
      </template>
    </UTable>

    <div v-if="(sales.data.value?.total ?? 0) > PAGE_SIZE" class="flex justify-end">
      <UPagination
        v-model:page="page"
        :total="sales.data.value?.total ?? 0"
        :items-per-page="PAGE_SIZE"
      />
    </div>
  </div>
</template>
