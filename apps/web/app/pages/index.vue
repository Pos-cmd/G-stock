<script setup lang="ts">
import { formatFcfa, formatQty } from "@G-stock/core/format";
import type { TableColumn } from "@nuxt/ui";
import { useQuery } from "@tanstack/vue-query";

import KpiCard from "~/components/common/KpiCard.vue";
import PagePanel from "~/components/layout/PagePanel.vue";
import StockStatusBadge from "~/components/products/StockStatusBadge.vue";
import type { ProductRow } from "~/types/api";

useHead({ title: "Tableau de bord" });

const { $orpc } = useNuxtApp();

const summary = useQuery($orpc.stock.summary.queryOptions());
const products = useQuery($orpc.products.list.queryOptions({ input: {} }));

// Ruptures d'abord, puis le stock le plus faible.
const STATUS_PRIORITY = { low: 1, ok: 2, out: 0 } as const;

const toRestock = computed(() =>
  (products.data.value ?? [])
    .filter((product) => product.status !== "ok")
    .toSorted(
      (a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] || a.stockQty - b.stockQty,
    ),
);

const rightAligned = { class: { td: "text-right", th: "text-right" } };
const columns: TableColumn<ProductRow>[] = [
  { accessorKey: "name", header: "Produit" },
  { accessorKey: "stockQty", header: "Stock", meta: rightAligned },
  { accessorKey: "alertThreshold", header: "Seuil", meta: rightAligned },
  { accessorKey: "status", header: "Statut" },
];
</script>

<template>
  <PagePanel id="dashboard" title="Tableau de bord" icon="i-lucide-layout-dashboard">
    <div class="space-y-6">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Stock valorisé"
          icon="i-lucide-wallet"
          :loading="summary.isPending.value"
          :value="formatFcfa(summary.data.value?.stockValueFcfa ?? 0)"
          hint="Au coût de revient des lots en stock"
          to="/produits"
        />
        <KpiCard
          label="Produits actifs"
          icon="i-lucide-boxes"
          color="neutral"
          :loading="summary.isPending.value"
          :value="String(summary.data.value?.productCount ?? 0)"
          to="/produits"
        />
        <KpiCard
          label="Stock bas"
          icon="i-lucide-triangle-alert"
          color="warning"
          :loading="summary.isPending.value"
          :value="String(summary.data.value?.lowCount ?? 0)"
          hint="Au niveau ou sous le seuil d'alerte"
        />
        <KpiCard
          label="Ruptures"
          icon="i-lucide-circle-x"
          color="error"
          :loading="summary.isPending.value"
          :value="String(summary.data.value?.outCount ?? 0)"
          hint="Produits sans aucun stock"
        />
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Chiffre d'affaires du jour"
          icon="i-lucide-trending-up"
          value="—"
          upcoming
        />
        <KpiCard label="Marge brute du mois" icon="i-lucide-percent" value="—" upcoming />
        <KpiCard label="Créances en cours" icon="i-lucide-hand-coins" value="—" upcoming />
      </div>

      <UPageCard
        title="À réapprovisionner"
        description="Produits en rupture ou sous leur seuil d'alerte."
        variant="subtle"
      >
        <UTable
          :data="toRestock"
          :columns="columns"
          :loading="products.isFetching.value"
          class="border-default rounded-lg border"
        >
          <template #name-cell="{ row }">
            <NuxtLink
              :to="`/produits/${row.original.id}`"
              class="text-highlighted font-medium hover:underline"
            >
              {{ row.original.name }}
            </NuxtLink>
          </template>
          <template #stockQty-cell="{ row }">
            <span class="tabular-nums">{{
              formatQty(row.original.stockQty, row.original.unit)
            }}</span>
          </template>
          <template #alertThreshold-cell="{ row }">
            <span class="text-muted tabular-nums">{{
              formatQty(row.original.alertThreshold)
            }}</span>
          </template>
          <template #status-cell="{ row }">
            <StockStatusBadge :status="row.original.status" />
          </template>
          <template #empty>
            <div class="text-muted flex items-center justify-center gap-2 py-6">
              <UIcon name="i-lucide-circle-check" class="text-success size-5" />
              Tous les produits sont au-dessus de leur seuil.
            </div>
          </template>
        </UTable>
      </UPageCard>
    </div>
  </PagePanel>
</template>
