<script setup lang="ts">
import { formatFcfa, formatQty } from "@G-stock/core/format";
import type { TableColumn, TabsItem } from "@nuxt/ui";
import { useQuery } from "@tanstack/vue-query";

import ActivityHeatmap from "~/components/charts/ActivityHeatmap.vue";
import KpiCard from "~/components/common/KpiCard.vue";
import LiveSalesCard from "~/components/dashboard/LiveSalesCard.vue";
import PagePanel from "~/components/layout/PagePanel.vue";
import StockStatusBadge from "~/components/products/StockStatusBadge.vue";
import type { ProductRow } from "~/types/api";

const icons = useIcons();

useHead({ title: "Tableau de bord" });

// Un an (52 semaines) pour le calendrier d'activité ; les cartes comparent les 30 derniers jours
// aux 30 précédents.
const ACTIVITY_DAYS = 364;
const PERIOD_DAYS = 30;

const { $orpc } = useNuxtApp();

const summary = useQuery($orpc.stock.summary.queryOptions());
const sales = useQuery($orpc.sales.summary.queryOptions());
const activity = useQuery($orpc.sales.activity.queryOptions({ input: { days: ACTIVITY_DAYS } }));
const products = useQuery($orpc.products.list.queryOptions({ input: {} }));
const backupWarning = useBackupWarning();
const create = useCreateDialogs();

// Période en cours et période précédente
const days = computed(() => activity.data.value ?? []);
const current = computed(() => days.value.slice(-PERIOD_DAYS));
const previous = computed(() => days.value.slice(-2 * PERIOD_DAYS, -PERIOD_DAYS));

type Day = (typeof days.value)[number];
type Metric = "marginFcfa" | "revenueFcfa" | "saleCount";

const periodCard = (metric: Metric) => {
  const total = sumOf(current.value, (day) => day[metric]);
  return {
    series: current.value.map((day) => ({
      label: formatDayLabel(day.date),
      value: day[metric],
    })),
    total,
    trend: trendRatio(
      total,
      sumOf(previous.value, (day) => day[metric]),
    ),
  };
};
const revenue = computed(() => periodCard("revenueFcfa"));
const margin = computed(() => periodCard("marginFcfa"));
const count = computed(() => periodCard("saleCount"));
const averageBasket = computed(() =>
  count.value.total > 0 ? Math.round(revenue.value.total / count.value.total) : 0,
);
const TREND_LABEL = "Par rapport aux 30 jours précédents";

// Calendrier d'activité : la mesure se choisit par onglets.
const heatmapMetric = ref<Metric>("saleCount");
const heatmapTabs: TabsItem[] = [
  { label: "Ventes", value: "saleCount" },
  { label: "Chiffre d'affaires", value: "revenueFcfa" },
  { label: "Marge", value: "marginFcfa" },
];
const heatmapDays = computed(() =>
  days.value.map((day) => ({
    date: day.date,
    value: Math.max(0, day[heatmapMetric.value]),
  })),
);
const daysByDate = computed(() => new Map(days.value.map((day) => [day.date, day])));
const plural = (value: number, word: string) => `${value} ${word}${value > 1 ? "s" : ""}`;
const describeDay = (date: string) => {
  const day: Day | undefined = daysByDate.value.get(date);
  if (!day || day.saleCount === 0) {
    return "aucune vente";
  }
  return `${plural(day.saleCount, "vente")} · ${formatFcfa(day.revenueFcfa)} · marge ${formatFcfa(day.marginFcfa)}`;
};
const heatmapSummary = computed(() => {
  const total = sumOf(days.value, (day) => day.saleCount);
  const activeDays = days.value.filter((day) => day.saleCount > 0).length;
  return `${plural(total, "vente")} en 12 mois · ${plural(activeDays, "jour")} d'activité · cliquez sur un jour pour voir ses ventes`;
});
const openDay = (date: string) => navigateTo({ path: "/ventes", query: { au: date, du: date } });

// Meilleures ventes du mois, avec une barre proportionnelle au chiffre d'affaires.
const topProducts = computed(() => sales.data.value?.topProducts ?? []);
const topRevenue = computed(() => Math.max(1, ...topProducts.value.map((p) => p.revenueFcfa)));

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
  <PagePanel
    id="dashboard"
    title="Tableau de bord"
    description="Ventes des 30 derniers jours, activité de la journée, stock et créances."
  >
    <template #actions>
      <UButton
        color="neutral"
        variant="outline"
        :icon="icons.purchases"
        label="Nouvelle commande"
        @click="create.openPurchase()"
      />
      <UButton :icon="icons.plus" label="Nouvelle vente" @click="create.openSale()" />
    </template>

    <div class="space-y-6">
      <UAlert
        v-if="backupWarning"
        color="warning"
        variant="subtle"
        :icon="icons.backup"
        title="Sauvegarde à vérifier"
        :description="backupWarning"
        :actions="[{ label: 'Voir la sauvegarde', color: 'warning', to: '/parametres' }]"
      />

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Chiffre d'affaires · 30 j"
          :loading="activity.isPending.value"
          :value="formatFcfa(revenue.total)"
          :trend="revenue.trend"
          :trend-label="TREND_LABEL"
          :series="revenue.series"
          :format="formatFcfa"
          :hint="`Ce mois-ci : ${formatFcfa(sales.data.value?.revenue.month ?? 0)}`"
          to="/ventes"
        />
        <KpiCard
          label="Marge brute · 30 j"
          :loading="activity.isPending.value"
          :value="formatFcfa(margin.total)"
          :trend="margin.trend"
          :trend-label="TREND_LABEL"
          :series="margin.series"
          :format="formatFcfa"
          :hint="`Taux de marge : ${formatMarginRate(margin.total, revenue.total) ?? '—'}`"
        />
        <KpiCard
          label="Ventes · 30 j"
          :loading="activity.isPending.value"
          :value="String(count.total)"
          :trend="count.trend"
          :trend-label="TREND_LABEL"
          :series="count.series"
          :format="(value) => plural(value, 'vente')"
          :hint="`Panier moyen : ${formatFcfa(averageBasket)}`"
          to="/ventes"
        />
        <KpiCard
          label="Créances en cours"
          :icon="icons.receivables"
          :color="(sales.data.value?.criticalDebtorCount ?? 0) > 0 ? 'error' : 'warning'"
          :loading="sales.isPending.value"
          :value="formatFcfa(sales.data.value?.receivablesFcfa ?? 0)"
          :hint="`${plural(sales.data.value?.debtorCount ?? 0, 'débiteur')}, dont ${sales.data.value?.criticalDebtorCount ?? 0} en retard critique`"
          to="/clients?debiteurs"
        />
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        <LiveSalesCard class="min-w-0 lg:col-span-2" />

        <UPageCard
          title="Meilleures ventes du mois"
          variant="subtle"
          class="min-w-0"
          :ui="{ container: 'content-start gap-y-4' }"
        >
          <p v-if="topProducts.length === 0" class="text-muted text-sm">Aucune vente ce mois-ci.</p>
          <ol v-else class="space-y-4">
            <li v-for="(product, rank) in topProducts" :key="product.productId" class="space-y-1.5">
              <div class="flex items-baseline justify-between gap-3 text-sm">
                <NuxtLink
                  :to="`/produits/${product.productId}`"
                  class="text-highlighted min-w-0 truncate font-medium hover:underline"
                >
                  <span class="text-dimmed me-1.5 font-mono text-xs">{{ rank + 1 }}</span>
                  {{ product.productName }}
                </NuxtLink>
                <span class="text-highlighted font-medium whitespace-nowrap tabular-nums">
                  {{ formatFcfa(product.revenueFcfa) }}
                </span>
              </div>
              <div class="bg-accented/60 h-1.5 overflow-hidden rounded-full">
                <div
                  class="h-full rounded-full bg-(--ui-chart-1) transition-[width] duration-500"
                  :style="{
                    width: `${(product.revenueFcfa / topRevenue) * 100}%`,
                  }"
                />
              </div>
              <p class="text-muted text-xs tabular-nums">
                {{ formatQty(product.qty, product.productUnit) }} vendus
              </p>
            </li>
          </ol>
        </UPageCard>
      </div>

      <UPageCard title="Activité des 12 derniers mois" variant="subtle">
        <template #title>
          <span class="flex w-full flex-wrap items-center justify-between gap-3">
            Activité des 12 derniers mois
            <UTabs
              v-model="heatmapMetric"
              :items="heatmapTabs"
              :content="false"
              size="sm"
              class="font-sans tracking-normal normal-case"
            />
          </span>
        </template>
        <USkeleton v-if="activity.isPending.value" class="h-32 w-full" />
        <ActivityHeatmap
          v-else
          :days="heatmapDays"
          :describe="describeDay"
          :summary="heatmapSummary"
          @select="openDay"
        />
      </UPageCard>

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Stock valorisé"
          :icon="icons.stockValue"
          :loading="summary.isPending.value"
          :value="formatFcfa(summary.data.value?.stockValueFcfa ?? 0)"
          hint="Au coût de revient des lots en stock"
          to="/produits"
        />
        <KpiCard
          label="Produits actifs"
          :icon="icons.products"
          color="neutral"
          :loading="summary.isPending.value"
          :value="String(summary.data.value?.productCount ?? 0)"
          to="/produits"
        />
        <KpiCard
          label="Stock bas"
          :icon="icons.stockLow"
          color="warning"
          :loading="summary.isPending.value"
          :value="String(summary.data.value?.lowCount ?? 0)"
          hint="Au niveau ou sous le seuil d'alerte"
          to="/produits?statut=low"
        />
        <KpiCard
          label="Ruptures"
          :icon="icons.stockOut"
          color="error"
          :loading="summary.isPending.value"
          :value="String(summary.data.value?.outCount ?? 0)"
          hint="Produits sans aucun stock"
          to="/produits?statut=out"
        />
      </div>

      <UPageCard
        title="À réapprovisionner"
        description="Produits en rupture ou sous leur seuil d'alerte."
        variant="subtle"
      >
        <UTable :data="toRestock" :columns="columns" :loading="products.isFetching.value">
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
              <UIcon :name="icons.success" class="text-success size-5" />
              Tous les produits sont au-dessus de leur seuil.
            </div>
          </template>
        </UTable>
      </UPageCard>
    </div>
  </PagePanel>
</template>
