<script setup lang="ts">
import { SALE_STATUS_LABELS } from "@G-stock/core/labels";
import { useQuery } from "@tanstack/vue-query";

import DateRangeField from "~/components/common/DateRangeField.vue";

const icons = useIcons();

/** Filtres de l'historique : recherche, période (avec raccourcis), produit, statut, paiement. */
const {
  periodOnly = false,
  showSearch = false,
  showStatus = true,
} = defineProps<{
  showSearch?: boolean;
  showStatus?: boolean;
  /** Seulement la période (résumé par produit). */
  periodOnly?: boolean;
}>();
const filters = defineModel<SalesFilterState>({ required: true });

const { $orpc } = useNuxtApp();
const products = useQuery($orpc.products.list.queryOptions({ input: { includeArchived: true } }));
const productItems = computed(() =>
  (products.data.value ?? []).map((product) => ({
    label: product.name,
    value: product.id,
  })),
);

const statusItems = [
  { label: "Tous les statuts", value: ALL },
  ...Object.entries(SALE_STATUS_LABELS).map(([value, label]) => ({
    label,
    value,
  })),
];
const paymentItems = [
  { label: "Payées ou non", value: ALL },
  { label: "Reste dû", value: "due" },
  { label: "Soldées", value: "paid" },
];

const hasFilters = computed(() => {
  const empty = emptySalesFilters();
  return (Object.keys(empty) as (keyof SalesFilterState)[]).some(
    (key) => filters.value[key] !== empty[key],
  );
});
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <UInput
      v-if="showSearch && !periodOnly"
      v-model="filters.search"
      :icon="icons.search"
      placeholder="N° de vente, client…"
      class="w-full sm:w-56"
    />
    <DateRangeField v-model:from="filters.from" v-model:to="filters.to" class="w-full sm:w-72" />
    <UFieldGroup v-if="!periodOnly">
      <USelectMenu
        v-model="filters.productId"
        :items="productItems"
        value-key="value"
        placeholder="Tous les produits"
        :search-input="{ placeholder: 'Rechercher…' }"
        clear
        class="w-52"
      />
      <USelect v-if="showStatus" v-model="filters.status" :items="statusItems" class="w-40" />
      <USelect v-model="filters.paymentState" :items="paymentItems" class="w-40" />
    </UFieldGroup>
    <UButton
      v-if="hasFilters"
      color="neutral"
      variant="ghost"
      :icon="icons.close"
      label="Réinitialiser"
      @click="filters = emptySalesFilters()"
    />
  </div>
</template>
