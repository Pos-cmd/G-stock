<script setup lang="ts">
import { formatDate, formatFcfa, formatQty } from "@G-stock/core/format";
import type { TabsItem } from "@nuxt/ui";
import { useQuery } from "@tanstack/vue-query";

import ActivityHeatmap from "~/components/charts/ActivityHeatmap.vue";

/**
 * Ventes d'un produit ou d'un client sur deux ans : mois par mois comparés à l'année précédente,
 * résumé des 12 derniers mois et calendrier d'activité (clic sur un jour : `select`).
 */
const {
  customerId = null,
  productId = null,
  stockQty = null,
  unit = "",
} = defineProps<{
  productId?: string | null;
  customerId?: string | null;
  /** Unité du produit, pour les quantités. */
  unit?: string;
  /** Stock du produit : donne sa couverture en jours de ventes. */
  stockQty?: number | null;
}>();
const emit = defineEmits<{ select: [date: string] }>();

const DAYS = 730;
const YEAR = 365;
const COVERAGE_WINDOW = 90;

const { $orpc } = useNuxtApp();
const activity = useQuery(
  computed(() =>
    $orpc.sales.activity.queryOptions({
      input: { customerId, days: DAYS, productId },
    })
  )
);
const days = computed(() => activity.data.value ?? []);
const lastYear = computed(() => days.value.slice(-YEAR));
const yearBefore = computed(() => days.value.slice(-2 * YEAR, -YEAR));

type Metric = "marginFcfa" | "qty" | "revenueFcfa" | "saleCount";
const metric = ref<Metric>("revenueFcfa");
const metricTabs = computed<TabsItem[]>(() => [
  { label: "Chiffre d'affaires", value: "revenueFcfa" },
  { label: "Marge", value: "marginFcfa" },
  productId
    ? { label: "Quantité", value: "qty" }
    : { label: "Achats", value: "saleCount" },
]);
const plural = (value: number, word: string) =>
  `${value} ${word}${value > 1 ? "s" : ""}`;
const formatMetric = (value: number) => {
  if (metric.value === "qty") {
    return formatQty(value, unit);
  }
  if (metric.value === "saleCount") {
    return plural(value, "achat");
  }
  return formatFcfa(value);
};

// Douze derniers mois, chacun comparé au même mois un an plus tôt.
const monthKey = (date: string) => date.slice(0, 7);
const monthly = computed(() => {
  const totals = new Map<string, number>();
  for (const day of days.value) {
    totals.set(
      monthKey(day.date),
      (totals.get(monthKey(day.date)) ?? 0) + day[metric.value]
    );
  }
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    const key = toDateInputValue(month).slice(0, 7);
    const previous = toDateInputValue(
      new Date(month.getFullYear() - 1, month.getMonth(), 1)
    );
    return {
      label: formatMonthLabel(key),
      precedente: totals.get(previous.slice(0, 7)) ?? 0,
      recente: totals.get(key) ?? 0,
    };
  });
});

// Résumé des 12 derniers mois
const summary = computed(() => {
  const revenue = sumOf(lastYear.value, (day) => day.revenueFcfa);
  const margin = sumOf(lastYear.value, (day) => day.marginFcfa);
  const months = new Map<string, number>();
  for (const day of lastYear.value) {
    months.set(
      monthKey(day.date),
      (months.get(monthKey(day.date)) ?? 0) + day.revenueFcfa
    );
  }
  const [bestMonth] = [...months.entries()].toSorted((a, b) => b[1] - a[1]);
  const lastSale = days.value.findLast((day) => day.saleCount > 0);
  return {
    bestMonth: bestMonth && bestMonth[1] > 0 ? bestMonth : null,
    count: sumOf(lastYear.value, (day) => day.saleCount),
    lastSale: lastSale?.date ?? null,
    margin,
    qty: sumOf(lastYear.value, (day) => day.qty),
    rate: formatMarginRate(margin, revenue),
    revenue,
    trend: trendRatio(
      revenue,
      sumOf(yearBefore.value, (day) => day.revenueFcfa)
    ),
  };
});

// Couverture : combien de jours le stock tiendra au rythme des 90 derniers jours.
const coverageDays = computed(() => {
  if (stockQty === null) {
    return null;
  }
  const perDay =
    sumOf(days.value.slice(-COVERAGE_WINDOW), (day) => day.qty) /
    COVERAGE_WINDOW;
  return perDay > 0 ? Math.round(stockQty / perDay) : null;
});

// Calendrier d'activité : 52 semaines.
const heatmapDays = computed(() =>
  days.value
    .slice(-364)
    .map((day) => ({
      date: day.date,
      value: productId ? day.qty : day.revenueFcfa,
    }))
);
const daysByDate = computed(
  () => new Map(days.value.map((day) => [day.date, day]))
);
const describeDay = (date: string) => {
  const day = daysByDate.value.get(date);
  if (!day || day.saleCount === 0) {
    return productId ? "aucune vente" : "aucun achat";
  }
  const detail = productId
    ? formatQty(day.qty, unit)
    : plural(day.saleCount, "achat");
  return `${detail} · ${formatFcfa(day.revenueFcfa)}`;
};
const heatmapSummary = computed(() => {
  const active = lastYear.value.filter((day) => day.saleCount > 0).length;
  return `${plural(active, "jour")} ${productId ? "de vente" : "d'achat"} sur 12 mois · cliquez sur un jour pour le détail`;
});
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-6 lg:grid-cols-3">
      <UPageCard title="Mois par mois" variant="subtle" class="lg:col-span-2">
        <template #title>
          <span
            class="flex w-full flex-wrap items-center justify-between gap-3"
          >
            Mois par mois
            <UTabs
              v-model="metric"
              :items="metricTabs"
              :content="false"
              size="sm"
              class="font-sans tracking-normal normal-case"
            />
          </span>
        </template>
        <USkeleton v-if="activity.isPending.value" class="h-60 w-full" />
        <UChart
          v-else
          type="bar"
          :data="monthly"
          index="label"
          :categories="[
            {
              key: 'precedente',
              label: 'Année précédente',
              color: 'var(--ui-chart-2)',
            },
            {
              key: 'recente',
              label: '12 derniers mois',
              color: 'var(--ui-chart-1)',
            },
          ]"
          :height="240"
          :format="
            metric === 'qty' || metric === 'saleCount'
              ? undefined
              : formatCompact
          "
          aria-label="Ventes mois par mois, comparées à l'année précédente"
        />
      </UPageCard>

      <UPageCard
        title="Sur 12 mois"
        variant="subtle"
        :ui="{ container: 'content-start' }"
      >
        <USkeleton v-if="activity.isPending.value" class="h-48 w-full" />
        <dl v-else class="space-y-3 text-sm">
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-muted">Chiffre d'affaires</dt>
            <dd class="text-highlighted text-right font-semibold tabular-nums">
              {{ formatFcfa(summary.revenue) }}
              <UBadge
                v-if="summary.trend !== null"
                :color="summary.trend >= 0 ? 'success' : 'error'"
                variant="subtle"
                size="sm"
                class="ms-1 tabular-nums"
              >
                {{ formatTrend(summary.trend) }}
              </UBadge>
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-muted">Marge brute</dt>
            <dd class="tabular-nums">
              {{ formatFcfa(summary.margin) }}
              <span v-if="summary.rate" class="text-dimmed text-xs">{{
                summary.rate
              }}</span>
            </dd>
          </div>
          <div
            v-if="productId"
            class="flex items-baseline justify-between gap-3"
          >
            <dt class="text-muted">Quantité vendue</dt>
            <dd class="tabular-nums">{{ formatQty(summary.qty, unit) }}</dd>
          </div>
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-muted">{{ productId ? "Ventes" : "Achats" }}</dt>
            <dd class="tabular-nums">{{ summary.count }}</dd>
          </div>
          <div
            v-if="!productId && summary.count > 0"
            class="flex items-baseline justify-between gap-3"
          >
            <dt class="text-muted">Panier moyen</dt>
            <dd class="tabular-nums">
              {{ formatFcfa(Math.round(summary.revenue / summary.count)) }}
            </dd>
          </div>
          <USeparator />
          <div
            v-if="summary.bestMonth"
            class="flex items-baseline justify-between gap-3"
          >
            <dt class="text-muted">Meilleur mois</dt>
            <dd class="text-right">
              {{ formatMonthLabel(summary.bestMonth[0]) }}
              <span class="text-dimmed text-xs tabular-nums">{{
                formatCompact(summary.bestMonth[1])
              }}</span>
            </dd>
          </div>
          <div class="flex items-baseline justify-between gap-3">
            <dt class="text-muted">
              {{ productId ? "Dernière vente" : "Dernier achat" }}
            </dt>
            <dd>
              {{
                summary.lastSale
                  ? formatDate(fromDateInputValue(summary.lastSale))
                  : "—"
              }}
            </dd>
          </div>
          <div
            v-if="stockQty !== null"
            class="flex items-baseline justify-between gap-3"
          >
            <dt class="text-muted">Couverture du stock</dt>
            <dd class="tabular-nums">
              {{
                coverageDays === null
                  ? "—"
                  : `≈ ${plural(coverageDays, "jour")}`
              }}
            </dd>
          </div>
        </dl>
      </UPageCard>
    </div>

    <UPageCard
      :title="productId ? 'Jours de vente' : 'Jours d\'achat'"
      variant="subtle"
    >
      <USkeleton v-if="activity.isPending.value" class="h-32 w-full" />
      <ActivityHeatmap
        v-else
        :days="heatmapDays"
        :describe="describeDay"
        :summary="heatmapSummary"
        @select="emit('select', $event)"
      />
    </UPageCard>
  </div>
</template>
