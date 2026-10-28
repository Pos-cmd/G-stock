<script setup lang="ts">
import { formatDate, formatFcfa, formatQty } from "@G-stock/core/format";
import type { TableColumn } from "@nuxt/ui";
import { keepPreviousData, useQuery } from "@tanstack/vue-query";

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

const rightAligned = { class: { td: "text-right", th: "text-right" } };
const columns: TableColumn<ProductSalesRow>[] = [
  { accessorKey: "productName", header: "Produit" },
  { accessorKey: "qty", header: "Quantité", meta: rightAligned },
  { accessorKey: "averagePriceFcfa", header: "Prix moyen", meta: rightAligned },
  { accessorKey: "revenueFcfa", header: "Montant", meta: rightAligned },
  { accessorKey: "marginFcfa", header: "Marge", meta: rightAligned },
  { accessorKey: "saleCount", header: "Ventes", meta: rightAligned },
  { accessorKey: "lastSaleDate", header: "Dernière vente" },
];
</script>

<template>
  <div class="space-y-2">
    <UTable :data="summary.data.value ?? []" :columns="columns" :loading="summary.isFetching.value">
      <template #productName-cell="{ row }">
        <NuxtLink
          :to="`/produits/${row.original.productId}`"
          class="text-highlighted font-medium hover:underline"
        >
          {{ row.original.productName }}
        </NuxtLink>
      </template>
      <template #qty-cell="{ row }">
        <span class="tabular-nums">{{
          formatQty(row.original.qty, row.original.productUnit)
        }}</span>
      </template>
      <template #averagePriceFcfa-cell="{ row }">
        <span class="text-muted tabular-nums">{{ formatFcfa(row.original.averagePriceFcfa) }}</span>
      </template>
      <template #revenueFcfa-cell="{ row }">
        <span class="text-highlighted font-medium tabular-nums">
          {{ formatFcfa(row.original.revenueFcfa) }}
        </span>
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
        {{ formatDate(row.original.lastSaleDate) }}
      </template>
      <template #empty>
        <p class="text-muted py-8 text-center">Aucune vente sur cette période.</p>
      </template>
    </UTable>
    <p class="text-dimmed text-xs">
      Montants avant remises : une remise s'applique à une vente entière, pas à un produit.
    </p>
  </div>
</template>
