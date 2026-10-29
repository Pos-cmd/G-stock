<script setup lang="ts">
import { formatDate, formatFcfa, formatQty } from "@G-stock/core/format";
import type { TableColumn } from "@nuxt/ui";
import { keepPreviousData, useQuery } from "@tanstack/vue-query";

import DataTable from "~/components/common/DataTable.vue";
import type { ProductSalesRow } from "~/types/api";

/** Ce qui a été vendu, produit par produit, sur une période (et pour un client si donné). */
const {
  customerId = null,
  from,
  to,
} = defineProps<{
  from: string;
  to: string;
  customerId?: string | null;
}>();

const { $orpc } = useNuxtApp();
const summary = useQuery(
  computed(() => ({
    ...$orpc.sales.productSummary.queryOptions({
      input: { ...periodBounds(from, to), customerId: customerId ?? null },
    }),
    placeholderData: keepPreviousData,
  })),
);

defineSlots<{ filters?: () => unknown }>();

// Part de chaque produit dans le chiffre d'affaires de la période.
const maxRevenue = computed(() =>
  Math.max(1, ...(summary.data.value ?? []).map((row) => row.revenueFcfa)),
);
const totalRevenue = computed(() =>
  (summary.data.value ?? []).reduce((sum, row) => sum + row.revenueFcfa, 0),
);
const share = (row: ProductSalesRow) =>
  totalRevenue.value > 0 ? Math.round((row.revenueFcfa / totalRevenue.value) * 100) : 0;

const rightAligned = { class: { td: "text-right", th: "text-right" } };
const columns: TableColumn<ProductSalesRow>[] = [
  { accessorKey: "productName", enableHiding: false, header: "Produit" },
  { accessorKey: "qty", header: "Quantité", meta: rightAligned },
  { accessorKey: "revenueFcfa", header: "Montant" },
  { accessorKey: "marginFcfa", header: "Marge", meta: rightAligned },
  { accessorKey: "saleCount", header: "Ventes", meta: rightAligned },
  { accessorKey: "lastSaleDate", header: "Dernière vente" },
];
</script>

<template>
  <DataTable
    :data="summary.data.value ?? []"
    :columns="columns"
    :loading="summary.isFetching.value"
    search-placeholder="Produit…"
    :initial-sorting="[{ desc: true, id: 'revenueFcfa' }]"
    :item-label="['produit', 'produits']"
    storage-key="product-sales"
  >
    <template v-if="$slots.filters" #filters>
      <slot name="filters" />
    </template>
    <template #productName-cell="{ row }">
      <NuxtLink
        :to="`/produits/${row.original.productId}`"
        class="text-highlighted font-medium hover:underline"
      >
        {{ row.original.productName }}
      </NuxtLink>
    </template>
    <template #qty-cell="{ row }">
      <span class="tabular-nums">{{ formatQty(row.original.qty, row.original.productUnit) }}</span>
      <p class="text-dimmed text-xs tabular-nums">
        {{ formatFcfa(row.original.averagePriceFcfa) }} en moyenne
      </p>
    </template>
    <template #revenueFcfa-cell="{ row }">
      <div class="w-48 space-y-1">
        <div class="flex items-baseline justify-between gap-2">
          <span class="text-highlighted font-medium tabular-nums">
            {{ formatFcfa(row.original.revenueFcfa) }}
          </span>
          <span class="text-dimmed text-xs tabular-nums">{{ share(row.original) }} %</span>
        </div>
        <div class="bg-accented/60 h-1.5 overflow-hidden rounded-full">
          <div
            class="h-full rounded-full bg-(--ui-chart-1)"
            :style="{ width: `${(row.original.revenueFcfa / maxRevenue) * 100}%` }"
          />
        </div>
      </div>
    </template>
    <template #marginFcfa-cell="{ row }">
      <span class="tabular-nums" :class="row.original.marginFcfa < 0 ? 'text-error' : ''">
        {{ formatFcfa(row.original.marginFcfa) }}
      </span>
      <p class="text-dimmed text-xs">
        {{ formatMarginRate(row.original.marginFcfa, row.original.revenueFcfa) }}
      </p>
    </template>
    <template #lastSaleDate-cell="{ row }">
      {{ formatDaysAgo(row.original.lastSaleDate) }}
      <p class="text-dimmed text-xs">{{ formatDate(row.original.lastSaleDate) }}</p>
    </template>
    <template #empty>
      <p class="text-muted py-8 text-center">Aucune vente sur cette période.</p>
    </template>
    <template #footer>
      Montants avant remises : une remise s'applique à une vente entière, pas à un produit.
    </template>
  </DataTable>
</template>
