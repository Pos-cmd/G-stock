<script setup lang="ts">
import { MAX_COMPARED_ITEMS } from "@G-stock/api/schemas/comparison";
import type { ComparisonItem } from "@G-stock/api/schemas/comparison";
import { compareValues } from "@G-stock/core/comparison";
import type { Preference } from "@G-stock/core/comparison";
import { formatDate, formatFcfa, formatQty, formatRmb } from "@G-stock/core/format";
import { keepPreviousData, useQuery } from "@tanstack/vue-query";

import CompareCell from "~/components/comparison/CompareCell.vue";
import PagePanel from "~/components/layout/PagePanel.vue";
import type { ComparisonData } from "~/types/api";

const icons = useIcons();

useHead({ title: "Comparer" });

type Column = ComparisonData["columns"][number];
type ProductCell = ComparisonData["productRows"][number]["cells"][number];

const route = useRoute();
const router = useRouter();
const { $orpc } = useNuxtApp();

// La sélection vit dans l'URL : la comparaison se partage et se retrouve.
const items = computed<ComparisonItem[]>(() =>
  decodeComparisonItems(route.query.elements).slice(0, MAX_COMPARED_ITEMS),
);
const setItems = async (next: ComparisonItem[]) => {
  await router.replace(comparisonLink(next));
};
const keyOf = (item: ComparisonItem) => `${item.type}-${item.id}`;

const comparison = useQuery(
  computed(() => ({
    ...$orpc.comparison.get.queryOptions({ input: { items: items.value } }),
    enabled: items.value.length > 0,
    placeholderData: keepPreviousData,
  })),
);
const columns = computed(() =>
  items.value.length > 0 ? (comparison.data.value?.columns ?? []) : [],
);

// Choix des éléments à comparer
const simulations = useQuery($orpc.simulations.list.queryOptions());
const orders = useQuery($orpc.purchases.list.queryOptions({ input: {} }));
const selectedKeys = computed(() => new Set(items.value.map(keyOf)));
const pickerItems = computed(() => [
  [
    { label: "Simulations", type: "label" as const, value: "" },
    ...(simulations.data.value ?? [])
      .filter((simulation) => !selectedKeys.value.has(`simulation-${simulation.id}`))
      .map((simulation) => ({
        label: simulation.name,
        suffix: formatDate(simulation.updatedAt),
        value: `s${simulation.id}`,
      })),
  ],
  [
    { label: "Commandes passées", type: "label" as const, value: "" },
    ...(orders.data.value ?? [])
      .filter(
        (order) =>
          order.status !== "cancelled" && !selectedKeys.value.has(`purchase_order-${order.id}`),
      )
      .map((order) => ({
        label: order.supplierName ? `${order.reference} · ${order.supplierName}` : order.reference,
        suffix: formatDate(order.orderDate),
        value: `c${order.id}`,
      })),
  ],
]);
const addItem = async (value: string | undefined) => {
  const [item] = decodeComparisonItems(value);
  if (item) {
    await setItems([...items.value, item]);
  }
};
const remove = (index: number) => setItems(items.value.filter((_, position) => position !== index));
const makeReference = (index: number) => {
  const item = items.value[index];
  return item ? setItems([item, ...items.value.filter((_, position) => position !== index)]) : null;
};

// Vue d'ensemble
const percent = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  style: "percent",
});
const formatPercent = (value: number) => percent.format(value);
const formatRate = (value: number) => value.toLocaleString("fr-FR", { maximumFractionDigits: 4 });

interface Metric {
  label: string;
  value: (column: Column) => number | null;
  format: (value: number) => string;
  preference: Preference | null;
  emphasis?: boolean;
}

const metrics: Metric[] = [
  {
    format: formatRmb,
    label: "Marchandise (RMB)",
    preference: "lower",
    value: (c) => c.goodsRmb,
  },
  {
    format: formatFcfa,
    label: "Marchandise (FCFA)",
    preference: "lower",
    value: (c) => c.goodsFcfa,
  },
  {
    format: formatFcfa,
    label: "Frais d'approche",
    preference: "lower",
    value: (c) => c.feesFcfa,
  },
  {
    format: formatPercent,
    label: "Frais / marchandise",
    preference: "lower",
    value: (c) => (c.goodsFcfa > 0 ? c.feesFcfa / c.goodsFcfa : null),
  },
  {
    emphasis: true,
    format: formatFcfa,
    label: "Prix de revient total",
    preference: "lower",
    value: (c) => c.totalCostFcfa,
  },
  {
    format: (value) => formatQty(value, "T"),
    label: "Poids total",
    preference: null,
    value: (c) => c.totalWeightTons || null,
  },
  {
    format: formatFcfa,
    label: "Revient par tonne",
    preference: "lower",
    value: (c) => (c.totalWeightTons > 0 ? Math.round(c.totalCostFcfa / c.totalWeightTons) : null),
  },
  {
    format: (value) => formatQty(value, "CBM"),
    label: "Volume",
    preference: null,
    value: (c) => c.freightCbm || null,
  },
  {
    format: formatFcfa,
    label: "Fret par CBM",
    preference: "lower",
    value: (c) => c.freightRatePerCbmFcfa || null,
  },
  {
    format: formatRate,
    label: "RMB pour 1 $",
    preference: "higher",
    value: (c) => c.rmbPerUsd,
  },
  {
    format: formatRate,
    label: "FCFA pour 1 $",
    preference: "lower",
    value: (c) => c.fcfaPerUsd,
  },
  {
    format: formatFcfa,
    label: "CA prévu",
    preference: "higher",
    value: (c) => c.revenueFcfa,
  },
  {
    emphasis: true,
    format: formatFcfa,
    label: "Marge prévue",
    preference: "higher",
    value: (c) => c.marginFcfa,
  },
  {
    format: formatPercent,
    label: "Marge / CA",
    preference: "higher",
    value: (c) => (c.revenueFcfa && c.marginFcfa !== null ? c.marginFcfa / c.revenueFcfa : null),
  },
];

const overviewRows = computed(() =>
  metrics
    .map((metric) => ({
      ...metric,
      compared: compareValues(columns.value.map(metric.value), metric.preference ?? "lower"),
    }))
    .filter((row) => row.compared.some((cell) => cell.value !== null)),
);

// Par produit
const PRODUCT_METRICS = {
  cost: { label: "Revient unitaire", preference: "lower" },
  sale: { label: "Prix de vente", preference: "higher" },
  supplier: { label: "Prix fournisseur", preference: "lower" },
} as const satisfies Record<string, { label: string; preference: Preference }>;
type ProductMetric = keyof typeof PRODUCT_METRICS;
const productMetric = ref<ProductMetric>("cost");
const productMetricItems = Object.entries(PRODUCT_METRICS).map(([value, { label }]) => ({
  label,
  value,
}));

const productValue = (cell: ProductCell): number | null => {
  if (!cell) {
    return null;
  }
  if (productMetric.value === "supplier") {
    return cell.unitPriceRmb;
  }
  if (productMetric.value === "sale") {
    return cell.salePriceFcfa;
  }
  return cell.unitCostFcfa;
};

const productRows = computed(() =>
  (comparison.data.value?.productRows ?? []).map((row) => {
    const present = row.cells.filter((cell) => cell !== null);
    // Un prix à la tonne ne se compare pas à un prix à l'unité.
    const sameBasis = present.every((cell) => cell?.pricingBasis === present[0]?.pricingBasis);
    const comparable = productMetric.value !== "supplier" || sameBasis;
    return {
      ...row,
      compared: compareValues(
        row.cells.map(productValue),
        PRODUCT_METRICS[productMetric.value].preference,
      ),
      preference: comparable ? PRODUCT_METRICS[productMetric.value].preference : null,
    };
  }),
);

const formatProductValue = (cell: ProductCell) => (value: number) => {
  if (productMetric.value === "supplier") {
    return `${formatRmb(value)}${cell?.pricingBasis === "weight" ? " / T" : ""}`;
  }
  return formatFcfa(value);
};

// Frais
const feeRows = computed(() =>
  (comparison.data.value?.feeRows ?? []).map((row) => ({
    ...row,
    compared: compareValues(row.cells, "lower"),
  })),
);

const columnLink = (column: Column) =>
  column.type === "simulation" ? `/simulateur/${column.id}` : `/achats/${column.id}`;
const canAdd = computed(() => items.value.length < MAX_COMPARED_ITEMS);
</script>

<template>
  <PagePanel id="comparison" title="Comparer" :icon="icons.compare">
    <template #actions>
      <UButton
        to="/simulateur"
        color="neutral"
        variant="ghost"
        :icon="icons.arrowLeft"
        label="Simulations"
      />
    </template>

    <template #toolbar>
      <div class="flex w-full flex-wrap items-center gap-2 py-1">
        <UBadge
          v-for="(column, index) in columns"
          :key="column.key"
          :color="index === 0 ? 'primary' : 'neutral'"
          variant="subtle"
          size="lg"
          class="gap-2"
        >
          <UIcon
            :name="column.type === 'simulation' ? icons.simulations : icons.purchases"
            class="size-4"
          />
          <span class="max-w-56 truncate">{{ column.title }}</span>
          <span v-if="index === 0" class="text-xs font-normal">référence</span>
          <UTooltip v-else text="Prendre comme référence">
            <UButton
              size="xs"
              color="neutral"
              variant="link"
              :icon="icons.pin"
              :aria-label="`Prendre ${column.title} comme référence`"
              @click="makeReference(index)"
            />
          </UTooltip>
          <UButton
            size="xs"
            color="neutral"
            variant="link"
            :icon="icons.close"
            :aria-label="`Retirer ${column.title}`"
            @click="remove(index)"
          />
        </UBadge>
        <USelectMenu
          v-if="canAdd"
          :key="items.length"
          :model-value="undefined"
          :items="pickerItems"
          value-key="value"
          placeholder="Ajouter une simulation ou une commande"
          :search-input="{ placeholder: 'Rechercher…' }"
          :icon="icons.plus"
          class="w-80"
          @update:model-value="addItem"
        />
        <span v-else class="text-muted text-xs">{{ MAX_COMPARED_ITEMS }} éléments au maximum</span>
      </div>
    </template>

    <div v-if="items.length === 0" class="flex flex-col items-center gap-3 py-16 text-center">
      <UIcon :name="icons.compare" class="text-dimmed size-12" />
      <p class="text-highlighted font-medium">Compare jusqu'à {{ MAX_COMPARED_ITEMS }} imports</p>
      <p class="text-muted max-w-lg text-sm">
        Ajoute des simulations et des commandes passées : prix de revient, frais, taux, puis produit
        par produit. Le premier élément sert de référence pour les écarts.
      </p>
    </div>

    <UAlert
      v-else-if="comparison.isError.value"
      color="error"
      variant="subtle"
      :icon="icons.error"
      title="Comparaison impossible"
      :description="comparison.error.value?.message"
    />

    <div v-else-if="columns.length > 0" class="space-y-8">
      <section class="space-y-3">
        <h2 class="text-highlighted font-semibold">Vue d'ensemble</h2>
        <div class="border-default overflow-x-auto rounded-lg border">
          <table class="w-full min-w-176 text-sm">
            <thead class="bg-elevated/50">
              <tr>
                <th class="text-muted w-52 px-4 py-3 text-left text-xs font-medium" />
                <th
                  v-for="(column, index) in columns"
                  :key="column.key"
                  class="px-4 py-3 text-right align-top"
                >
                  <NuxtLink
                    :to="columnLink(column)"
                    class="text-highlighted font-semibold hover:underline"
                  >
                    {{ column.title }}
                  </NuxtLink>
                  <p class="text-muted text-xs font-normal">
                    {{ column.subtitle }} · {{ formatDate(column.date) }}
                  </p>
                  <UBadge
                    v-if="index === 0"
                    color="primary"
                    variant="subtle"
                    size="sm"
                    class="mt-1"
                  >
                    Référence
                  </UBadge>
                </th>
              </tr>
            </thead>
            <tbody class="divide-default divide-y">
              <tr
                v-for="row in overviewRows"
                :key="row.label"
                :class="row.emphasis ? 'bg-primary/5' : ''"
              >
                <th
                  class="px-4 py-2.5 text-left font-normal"
                  :class="row.emphasis ? 'text-highlighted font-medium' : 'text-muted'"
                >
                  {{ row.label }}
                </th>
                <td v-for="(cell, index) in row.compared" :key="index" class="px-4 py-2.5">
                  <CompareCell :compared="cell" :format="row.format" :preference="row.preference" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-dimmed text-xs">
          En vert le meilleur, en rouge le moins bon ; les pourcentages sont les écarts avec la
          référence. Une commande reçue montre ses coûts réels, une commande en cours son
          estimation.
        </p>
      </section>

      <section class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-highlighted font-semibold">Par produit</h2>
          <URadioGroup
            v-model="productMetric"
            :items="productMetricItems"
            orientation="horizontal"
          />
        </div>
        <div class="border-default overflow-x-auto rounded-lg border">
          <table class="w-full min-w-176 text-sm">
            <thead class="bg-elevated/50 text-muted text-xs">
              <tr>
                <th class="w-52 px-4 py-2 text-left font-medium">Produit</th>
                <th
                  v-for="column in columns"
                  :key="column.key"
                  class="max-w-48 truncate px-4 py-2 text-right font-medium"
                >
                  {{ column.title }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-default divide-y">
              <tr v-for="row in productRows" :key="row.key">
                <th class="text-highlighted px-4 py-2.5 text-left font-medium">
                  {{ row.label }}
                </th>
                <td v-for="(cell, index) in row.cells" :key="index" class="px-4 py-2.5">
                  <CompareCell
                    :compared="row.compared[index]"
                    :format="formatProductValue(cell)"
                    :preference="row.preference"
                    :hint="cell ? formatQty(cell.qty, cell.unit) : ''"
                  />
                </td>
              </tr>
              <tr v-if="productRows.length === 0">
                <td :colspan="columns.length + 1" class="text-muted px-4 py-6 text-center">
                  Aucun produit.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-dimmed text-xs">
          Produits rapprochés par produit du catalogue, sinon par nom. Un prix fournisseur à la
          tonne n'est pas coloré face à un prix à l'unité.
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="text-highlighted font-semibold">Frais d'approche</h2>
        <div class="border-default overflow-x-auto rounded-lg border">
          <table class="w-full min-w-176 text-sm">
            <thead class="bg-elevated/50 text-muted text-xs">
              <tr>
                <th class="w-52 px-4 py-2 text-left font-medium">Frais</th>
                <th
                  v-for="column in columns"
                  :key="column.key"
                  class="max-w-48 truncate px-4 py-2 text-right font-medium"
                >
                  {{ column.title }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-default divide-y">
              <tr v-for="row in feeRows" :key="row.label">
                <th class="text-highlighted px-4 py-2.5 text-left font-medium">
                  {{ row.label }}
                </th>
                <td v-for="(cell, index) in row.compared" :key="index" class="px-4 py-2.5">
                  <CompareCell :compared="cell" :format="formatFcfa" preference="lower" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </PagePanel>
</template>
