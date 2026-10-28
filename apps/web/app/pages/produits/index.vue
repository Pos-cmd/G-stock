<script setup lang="ts">
import { STOCK_STATUSES } from "@G-stock/core/enums";
import type { StockStatus } from "@G-stock/core/enums";
import { formatFcfa, formatQty } from "@G-stock/core/format";
import type { DropdownMenuItem, TableColumn, TabsItem } from "@nuxt/ui";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/vue-query";

import ConfirmDialog from "~/components/common/ConfirmDialog.vue";
import PagePanel from "~/components/layout/PagePanel.vue";
import ProductFormModal from "~/components/products/ProductFormModal.vue";
import StockStatusBadge from "~/components/products/StockStatusBadge.vue";
import LotEntryModal from "~/components/stock/LotEntryModal.vue";
import type { ProductRow } from "~/types/api";

const icons = useIcons();

useHead({ title: "Produits" });

const ALL = "all";
const SEARCH_DEBOUNCE_MS = 300;

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidateStock = useInvalidateStock();

const search = ref("");
const debouncedSearch = refDebounced(search, SEARCH_DEBOUNCE_MS);
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
        search: debouncedSearch.value || null,
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

const rightAligned = { class: { td: "text-right", th: "text-right" } };

const columns: TableColumn<ProductRow>[] = [
  { accessorKey: "name", header: "Produit" },
  { accessorKey: "category", header: "Catégorie" },
  { accessorKey: "stockQty", header: "Stock", meta: rightAligned },
  { accessorKey: "status", header: "Statut" },
  { accessorKey: "averageCostFcfa", header: "Coût moyen", meta: rightAligned },
  { accessorKey: "stockValueFcfa", header: "Valeur stock", meta: rightAligned },
  {
    accessorKey: "suggestedSalePriceFcfa",
    header: "Prix conseillé",
    meta: rightAligned,
  },
  { header: "", id: "actions", meta: rightAligned },
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

    <template #toolbar>
      <div class="flex w-full flex-wrap items-center gap-2 py-1">
        <UFieldGroup class="w-full sm:w-auto">
          <UInput
            v-model="search"
            :icon="icons.search"
            placeholder="Rechercher un produit, une référence…"
            class="min-w-0 flex-1 sm:w-72 sm:flex-none"
          />
          <USelect v-model="category" :items="categoryItems" class="w-48" />
        </UFieldGroup>
        <USwitch v-model="includeArchived" label="Afficher les archivés" class="ms-auto" />
      </div>
    </template>

    <div class="space-y-3">
      <UTable
        :data="products.data.value ?? []"
        :columns="columns"
        :loading="products.isFetching.value"
      >
        <template #name-cell="{ row }">
          <NuxtLink :to="`/produits/${row.original.id}`" class="group block">
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
            <p v-if="row.original.reference" class="text-dimmed text-xs">
              {{ row.original.reference }}
            </p>
          </NuxtLink>
        </template>

        <template #category-cell="{ row }">
          <span class="text-muted">{{ row.original.category ?? "—" }}</span>
        </template>

        <template #stockQty-cell="{ row }">
          <span class="font-medium tabular-nums">{{
            formatQty(row.original.stockQty, row.original.unit)
          }}</span>
          <p class="text-dimmed text-xs">seuil {{ formatQty(row.original.alertThreshold) }}</p>
        </template>

        <template #status-cell="{ row }">
          <StockStatusBadge :status="row.original.status" />
        </template>

        <template #averageCostFcfa-cell="{ row }">
          <span class="tabular-nums">{{
            row.original.stockQty > 0 ? formatFcfa(row.original.averageCostFcfa) : "—"
          }}</span>
        </template>

        <template #stockValueFcfa-cell="{ row }">
          <span class="font-medium tabular-nums">{{
            formatFcfa(row.original.stockValueFcfa)
          }}</span>
        </template>

        <template #suggestedSalePriceFcfa-cell="{ row }">
          <span class="tabular-nums">
            {{
              row.original.suggestedSalePriceFcfa === null
                ? "—"
                : formatFcfa(row.original.suggestedSalePriceFcfa)
            }}
          </span>
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
            <UButton
              variant="soft"
              :icon="icons.plus"
              label="Créer un produit"
              @click="openCreate"
            />
          </div>
        </template>
      </UTable>
    </div>

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
