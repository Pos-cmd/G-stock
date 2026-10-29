<script setup lang="ts">
import { STOCK_STATUSES } from "@G-stock/core/enums";
import type { StockStatus } from "@G-stock/core/enums";
import { formatFcfa, formatQty } from "@G-stock/core/format";
import type { DropdownMenuItem, TableColumn, TabsItem } from "@nuxt/ui";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/vue-query";

import PeriodTabs from "~/components/charts/PeriodTabs.vue";
import Sparkline from "~/components/charts/Sparkline.vue";
import TrendLegend from "~/components/charts/TrendLegend.vue";
import TrendValue from "~/components/charts/TrendValue.vue";
import ConfirmDialog from "~/components/common/ConfirmDialog.vue";
import DataTable from "~/components/common/DataTable.vue";
import PagePanel from "~/components/layout/PagePanel.vue";
import ProductFormModal from "~/components/products/ProductFormModal.vue";
import StockStatusBadge from "~/components/products/StockStatusBadge.vue";
import LotEntryModal from "~/components/stock/LotEntryModal.vue";
import type { ProductRow } from "~/types/api";

const icons = useIcons();

useHead({ title: "Produits" });

const ALL = "all";

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidateStock = useInvalidateStock();

const category = ref<string>(ALL);

// Statut choisi par les onglets ; `?statut=low` (alertes) les ouvre sur le stock bas.
const route = useRoute();
const statusFromQuery = (value: unknown): StockStatus | typeof ALL =>
  STOCK_STATUSES.find((item) => item === value) ?? ALL;
const status = ref(statusFromQuery(route.query.statut));
watch(
  () => route.query.statut,
  (value) => {
    status.value = statusFromQuery(value);
  },
);
const includeArchived = ref(false);

const products = useQuery(
  computed(() => ({
    ...$orpc.products.list.queryOptions({
      input: {
        category: category.value === ALL ? null : category.value,
        includeArchived: includeArchived.value,
        status: status.value === ALL ? null : status.value,
      },
    }),
    placeholderData: keepPreviousData,
  })),
);
const categories = useQuery($orpc.products.categories.queryOptions());

const categoryItems = computed(() => [
  { label: "Toutes les catégories", value: ALL },
  ...(categories.data.value ?? []).map((name) => ({
    label: name,
    value: name,
  })),
]);
const summary = useQuery($orpc.stock.summary.queryOptions());
const countBadge = (count: number | undefined) =>
  count
    ? { color: "neutral" as const, label: String(count), variant: "outline" as const }
    : undefined;
const statusTabs = computed<TabsItem[]>(() => [
  { label: "Tous", value: ALL },
  { label: "En stock", value: "ok" },
  { badge: countBadge(summary.data.value?.lowCount), label: "Stock bas", value: "low" },
  { badge: countBadge(summary.data.value?.outCount), label: "Ruptures", value: "out" },
]);

const totals = computed(() => {
  const rows = products.data.value ?? [];
  return {
    count: rows.length,
    value: rows.reduce((sum, row) => sum + row.stockValueFcfa, 0),
  };
});

// Modales
const formOpen = ref(false);
const editedProduct = ref<ProductRow | null>(null);
const entryOpen = ref(false);
const entryProduct = ref<ProductRow | null>(null);
const deleteOpen = ref(false);
const deletedProduct = ref<ProductRow | null>(null);

const openCreate = () => {
  editedProduct.value = null;
  formOpen.value = true;
};
const openEdit = (product: ProductRow) => {
  editedProduct.value = product;
  formOpen.value = true;
};
const openEntry = (product: ProductRow) => {
  entryProduct.value = product;
  entryOpen.value = true;
};

const archiveMutation = useMutation($orpc.products.archive.mutationOptions());
const restoreMutation = useMutation($orpc.products.restore.mutationOptions());
const removeMutation = useMutation($orpc.products.remove.mutationOptions());

const toggleArchive = async (product: ProductRow) => {
  try {
    if (product.archivedAt) {
      await restoreMutation.mutateAsync({ id: product.id });
      notify.success("Produit restauré", product.name);
    } else {
      await archiveMutation.mutateAsync({ id: product.id });
      notify.success("Produit archivé", product.name);
    }
    await invalidateStock();
  } catch (error) {
    notify.error("Opération impossible", error);
  }
};

const confirmDelete = async () => {
  if (!deletedProduct.value) {
    return;
  }
  try {
    await removeMutation.mutateAsync({ id: deletedProduct.value.id });
    notify.success("Produit supprimé", deletedProduct.value.name);
    deleteOpen.value = false;
    await invalidateStock();
  } catch (error) {
    notify.error("Suppression impossible", error);
  }
};

const rowActions = (product: ProductRow): DropdownMenuItem[][] => [
  [
    {
      icon: icons.eye,
      label: "Voir la fiche",
      to: `/produits/${product.id}`,
    },
    {
      icon: icons.edit,
      label: "Modifier",
      onSelect: () => openEdit(product),
    },
    {
      disabled: Boolean(product.archivedAt),
      icon: icons.stockEntry,
      label: "Entrée de stock",
      onSelect: () => openEntry(product),
    },
  ],
  [
    {
      icon: product.archivedAt ? icons.unarchive : icons.archive,
      label: product.archivedAt ? "Restaurer" : "Archiver",
      onSelect: () => toggleArchive(product),
    },
    ...(product.lotCount === 0
      ? [
          {
            color: "error" as const,
            icon: icons.trash,
            label: "Supprimer",
            onSelect: () => {
              deletedProduct.value = product;
              deleteOpen.value = true;
            },
          },
        ]
      : []),
  ],
];

// Ventes de chaque produit sur la période choisie, comparées à la précédente.
const weeks = ref<TrendPeriod>(13);
const trends = useQuery(
  computed(() => ({
    ...$orpc.sales.trends.queryOptions({ input: { by: "product", weeks: weeks.value } }),
    placeholderData: keepPreviousData,
  })),
);
const trendsById = computed(() => new Map((trends.data.value ?? []).map((row) => [row.id, row])));

/** Couverture : jours de vente que le stock tient au rythme de la période. */
const COVERAGE_FULL_DAYS = 90;
const coverageClass = (days: number | null) => {
  if (days === null) {
    return "bg-accented";
  }
  if (days < 15) {
    return "bg-error";
  }
  return days < 30 ? "bg-warning" : "bg-success";
};

const rows = computed(() =>
  (products.data.value ?? []).map((product) => {
    const trend = trendsById.value.get(product.id);
    const revenueFcfa = sumOf(trend?.current ?? [], (value) => value);
    const perDay = (trend?.currentQty ?? 0) / (weeks.value * 7);
    return {
      ...product,
      coverageDays: perDay > 0 ? Math.round(product.stockQty / perDay) : null,
      previous: trend?.previous ?? [],
      revenueFcfa,
      revenueTrend: trendRatio(
        revenueFcfa,
        sumOf(trend?.previous ?? [], (value) => value),
      ),
      soldQty: trend?.currentQty ?? 0,
      weekly: trend?.current ?? [],
    };
  }),
);
type Row = (typeof rows.value)[number];

const unitMarginRate = (row: Row) =>
  row.suggestedSalePriceFcfa && row.stockQty > 0
    ? formatMarginRate(row.suggestedSalePriceFcfa - row.averageCostFcfa, row.suggestedSalePriceFcfa)
    : null;
const coverageWidth = (row: Row) =>
  `${Math.min(100, ((row.coverageDays ?? 0) / COVERAGE_FULL_DAYS) * 100)}%`;
const coverageText = (row: Row) => {
  if (row.coverageDays === null) {
    return `Pas de ventes · seuil ${formatQty(row.alertThreshold)}`;
  }
  return `≈ ${row.coverageDays} j · seuil ${formatQty(row.alertThreshold)}`;
};
const productSearchText = (row: Row) => `${row.name} ${row.reference ?? ""} ${row.category ?? ""}`;

const rightAligned = { class: { td: "text-right", th: "text-right" } };

const columns: TableColumn<Row>[] = [
  { accessorKey: "name", enableHiding: false, header: "Produit" },
  { accessorKey: "revenueFcfa", header: "Ventes", meta: rightAligned },
  {
    enableSorting: false,
    header: "Tendance",
    id: "trend",
    meta: { class: { td: "w-36 min-w-28" } },
  },
  { accessorKey: "stockQty", header: "Stock", meta: rightAligned },
  { accessorKey: "coverageDays", header: "Couverture", sortUndefined: "last" },
  { accessorKey: "stockValueFcfa", header: "Valeur stock", meta: rightAligned },
  { accessorKey: "suggestedSalePriceFcfa", header: "Prix conseillé", meta: rightAligned },
  { enableHiding: false, header: "", id: "actions", meta: rightAligned },
];
</script>

<template>
  <PagePanel id="products" title="Produits">
    <template #description>
      {{ totals.count }} produit{{ totals.count > 1 ? "s" : "" }} · stock valorisé
      <span class="text-highlighted font-medium tabular-nums">{{ formatFcfa(totals.value) }}</span>
    </template>
    <template #tabs>
      <UTabs v-model="status" :items="statusTabs" :content="false" />
    </template>
    <template #actions>
      <UButton :icon="icons.plus" label="Nouveau produit" @click="openCreate" />
    </template>

    <DataTable
      :data="rows"
      :columns="columns"
      :loading="products.isFetching.value"
      :search-text="productSearchText"
      search-placeholder="Produit, référence, catégorie…"
      :initial-sorting="[{ desc: true, id: 'revenueFcfa' }]"
      :item-label="['produit', 'produits']"
      storage-key="products"
    >
      <template #filters>
        <USelect v-model="category" :items="categoryItems" class="w-48" />
        <USwitch v-model="includeArchived" label="Archivés" />
      </template>
      <template #toolbar>
        <PeriodTabs v-model="weeks" />
      </template>

      <template #name-cell="{ row }">
        <NuxtLink :to="`/produits/${row.original.id}`" class="group block min-w-44">
          <span class="text-highlighted font-medium group-hover:underline">{{
            row.original.name
          }}</span>
          <UBadge
            v-if="row.original.archivedAt"
            color="neutral"
            variant="outline"
            size="sm"
            class="ms-2"
          >
            Archivé
          </UBadge>
          <p class="text-dimmed text-xs">
            {{ [row.original.reference, row.original.category].filter(Boolean).join(" · ") || "—" }}
          </p>
        </NuxtLink>
      </template>

      <template #revenueFcfa-cell="{ row }">
        <template v-if="row.original.revenueFcfa > 0">
          <TrendValue
            :value="formatFcfa(row.original.revenueFcfa)"
            :ratio="row.original.revenueTrend"
          />
          <p class="text-dimmed text-xs tabular-nums">
            {{ formatQty(row.original.soldQty, row.original.unit) }} vendus
          </p>
        </template>
        <span v-else class="text-dimmed">Aucune vente</span>
      </template>

      <template #trend-cell="{ row }">
        <Sparkline
          v-if="row.original.weekly.length > 0"
          :values="row.original.weekly"
          :compare="row.original.previous"
        />
        <span v-else class="text-dimmed text-xs">—</span>
      </template>

      <template #stockQty-cell="{ row }">
        <span class="font-medium tabular-nums">{{
          formatQty(row.original.stockQty, row.original.unit)
        }}</span>
        <div class="mt-0.5"><StockStatusBadge :status="row.original.status" /></div>
      </template>

      <template #coverageDays-cell="{ row }">
        <div class="w-28 space-y-1">
          <div class="bg-accented/60 h-1.5 overflow-hidden rounded-full">
            <div
              class="h-full rounded-full"
              :class="coverageClass(row.original.coverageDays)"
              :style="{ width: coverageWidth(row.original) }"
            />
          </div>
          <p class="text-muted text-xs tabular-nums">{{ coverageText(row.original) }}</p>
        </div>
      </template>

      <template #stockValueFcfa-cell="{ row }">
        <span class="font-medium tabular-nums">{{ formatFcfa(row.original.stockValueFcfa) }}</span>
        <p v-if="row.original.stockQty > 0" class="text-dimmed text-xs tabular-nums">
          {{ formatFcfa(row.original.averageCostFcfa) }} / {{ row.original.unit }}
        </p>
      </template>

      <template #suggestedSalePriceFcfa-cell="{ row }">
        <span class="tabular-nums">
          {{
            row.original.suggestedSalePriceFcfa === null
              ? "—"
              : formatFcfa(row.original.suggestedSalePriceFcfa)
          }}
        </span>
        <p v-if="unitMarginRate(row.original)" class="text-dimmed text-xs tabular-nums">
          marge {{ unitMarginRate(row.original) }}
        </p>
      </template>

      <template #actions-cell="{ row }">
        <UDropdownMenu :items="rowActions(row.original)" :content="{ align: 'end' }">
          <UButton
            :icon="icons.moreActions"
            color="neutral"
            variant="ghost"
            :aria-label="`Actions pour ${row.original.name}`"
          />
        </UDropdownMenu>
      </template>

      <template #empty>
        <div class="flex flex-col items-center gap-3 py-10 text-center">
          <UIcon :name="icons.products" class="text-dimmed size-10" />
          <p class="text-muted">Aucun produit ne correspond à ces critères.</p>
          <UButton variant="soft" :icon="icons.plus" label="Créer un produit" @click="openCreate" />
        </div>
      </template>

      <template #footer>
        <TrendLegend :weeks="weeks" />
      </template>
    </DataTable>

    <ProductFormModal v-model:open="formOpen" :product="editedProduct" />
    <LotEntryModal v-model:open="entryOpen" :product="entryProduct" />
    <ConfirmDialog
      v-model:open="deleteOpen"
      title="Supprimer le produit ?"
      :description="`« ${deletedProduct?.name} » sera définitivement supprimé.`"
      confirm-label="Supprimer"
      :loading="removeMutation.isPending.value"
      @confirm="confirmDelete"
    />
  </PagePanel>
</template>
