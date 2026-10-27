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
const sales = useQuery($orpc.sales.summary.queryOptions());
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

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Chiffre d'affaires du jour"
          icon="i-lucide-trending-up"
          :loading="sales.isPending.value"
          :value="formatFcfa(sales.data.value?.revenue.day ?? 0)"
          :hint="`Semaine : ${formatFcfa(sales.data.value?.revenue.week ?? 0)}`"
          to="/ventes"
        />
        <KpiCard
          label="Chiffre d'affaires du mois"
          icon="i-lucide-calendar-range"
          :loading="sales.isPending.value"
          :value="formatFcfa(sales.data.value?.revenue.month ?? 0)"
          :hint="`${sales.data.value?.monthSaleCount ?? 0} vente(s), remises déduites`"
          to="/ventes"
        />
        <KpiCard
          label="Marge brute du mois"
          icon="i-lucide-piggy-bank"
          color="success"
          :loading="sales.isPending.value"
          :value="formatFcfa(sales.data.value?.monthMarginFcfa ?? 0)"
          :hint="
            formatMarginRate(
              sales.data.value?.monthMarginFcfa ?? 0,
              sales.data.value?.revenue.month ?? 0,
            ) ?? 'Prix de vente − coût des lots vendus'
          "
        />
        <KpiCard
          label="Créances en cours"
          icon="i-lucide-hand-coins"
          :color="(sales.data.value?.criticalDebtorCount ?? 0) > 0 ? 'error' : 'warning'"
          :loading="sales.isPending.value"
          :value="formatFcfa(sales.data.value?.receivablesFcfa ?? 0)"
          :hint="`${sales.data.value?.debtorCount ?? 0} débiteur(s), dont ${sales.data.value?.criticalDebtorCount ?? 0} critique(s)`"
          to="/clients?debiteurs"
        />
      </div>

      <UPageCard
        title="Meilleures ventes du mois"
        description="Produits classés par chiffre d'affaires (avant remises)."
        variant="subtle"
      >
        <p v-if="(sales.data.value?.topProducts ?? []).length === 0" class="text-muted text-sm">
          Aucune vente ce mois-ci.
        </p>
        <ul v-else class="divide-default divide-y text-sm">
          <li
            v-for="product in sales.data.value?.topProducts"
            :key="product.productId"
            class="flex items-center justify-between gap-4 py-2"
          >
            <NuxtLink
              :to="`/produits/${product.productId}`"
              class="text-highlighted min-w-0 truncate font-medium hover:underline"
            >
              {{ product.productName }}
            </NuxtLink>
            <span class="text-muted whitespace-nowrap tabular-nums">
              {{ formatQty(product.qty, product.productUnit) }} ·
              <span class="text-highlighted font-medium">{{
                formatFcfa(product.revenueFcfa)
              }}</span>
            </span>
          </li>
        </ul>
      </UPageCard>

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
