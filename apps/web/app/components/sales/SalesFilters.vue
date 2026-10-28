<script setup lang="ts">
import { SALE_STATUS_LABELS } from "@G-stock/core/labels";
import { useQuery } from "@tanstack/vue-query";

const icons = useIcons();

/** Filtres de l'historique : recherche, période (avec raccourcis), produit, statut, paiement. */
const {
  periodOnly = false,
  showSearch = true,
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

const applyPreset = (range: (now: Date) => readonly [Date, Date]) => {
  const [from, to] = range(new Date());
  filters.value = {
    ...filters.value,
    from: toDateInputValue(from),
    to: toDateInputValue(to),
  };
};

const hasFilters = computed(() => {
  const empty = emptySalesFilters();
  return (Object.keys(empty) as (keyof SalesFilterState)[]).some(
    (key) => filters.value[key] !== empty[key],
  );
});
</script>

<template>
  <div class="flex w-full flex-wrap items-center gap-2 py-1">
    <UInput
      v-if="showSearch && !periodOnly"
      v-model="filters.search"
      :icon="icons.search"
      placeholder="N° de vente, client…"
      class="w-full sm:w-56"
    />
    <!-- Période : raccourcis, puis dates de début et de fin -->
    <UFieldGroup>
      <UDropdownMenu
        :items="
          PERIOD_PRESETS.map((preset) => ({
            label: preset.label,
            onSelect: () => applyPreset(preset.range),
          }))
        "
      >
        <UButton color="neutral" variant="outline" :icon="icons.period" label="Période" />
      </UDropdownMenu>
      <UInput v-model="filters.from" type="date" aria-label="Depuis le" class="w-36" />
      <UInput v-model="filters.to" type="date" aria-label="Jusqu'au" class="w-36" />
    </UFieldGroup>
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
