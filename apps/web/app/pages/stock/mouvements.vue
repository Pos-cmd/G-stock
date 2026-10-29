<script setup lang="ts">
import type { MovementType } from "@G-stock/core/enums";
import { MOVEMENT_TYPE_LABELS } from "@G-stock/core/labels";
import { useQuery } from "@tanstack/vue-query";

import DateRangeField from "~/components/common/DateRangeField.vue";
import PagePanel from "~/components/layout/PagePanel.vue";
import MovementsTable from "~/components/stock/MovementsTable.vue";

const icons = useIcons();

useHead({ title: "Mouvements de stock" });

const ALL = "all";

const { $orpc } = useNuxtApp();

const productId = ref<string | undefined>();
const type = ref<MovementType | typeof ALL>(ALL);
const from = ref("");
const to = ref("");

const products = useQuery($orpc.products.list.queryOptions({ input: { includeArchived: true } }));
const productItems = computed(() =>
  (products.data.value ?? []).map((product) => ({
    label: product.name,
    value: product.id,
  })),
);
const typeItems = [
  { label: "Tous les types", value: ALL },
  ...Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => ({
    label,
    value,
  })),
];

const filters = computed(() => ({
  // Bornes incluses : du début du premier jour à la fin du dernier.
  from: from.value ? new Date(`${from.value}T00:00:00`) : null,
  productId: productId.value ?? null,
  to: to.value ? new Date(`${to.value}T23:59:59.999`) : null,
  type: type.value === ALL ? null : type.value,
}));

const hasFilters = computed(
  () => productId.value !== undefined || type.value !== ALL || from.value !== "" || to.value !== "",
);

const resetFilters = () => {
  productId.value = undefined;
  type.value = ALL;
  from.value = "";
  to.value = "";
};
</script>

<template>
  <PagePanel
    id="stock-movements"
    title="Mouvements de stock"
    description="Chaque entrée, sortie et correction de stock, lot par lot."
  >
    <MovementsTable :filters="filters">
      <template #filters="{ stacked }">
        <UFieldGroup :orientation="stacked ? 'vertical' : 'horizontal'">
          <USelectMenu
            v-model="productId"
            :items="productItems"
            value-key="value"
            placeholder="Tous les produits"
            :search-input="{ placeholder: 'Rechercher…' }"
            clear
            :class="stacked ? 'w-full' : 'w-64'"
          />
          <USelect v-model="type" :items="typeItems" :class="stacked ? 'w-full' : 'w-44'" />
        </UFieldGroup>
        <DateRangeField
          v-model:from="from"
          v-model:to="to"
          :class="stacked ? 'w-full' : 'w-full sm:w-72'"
        />
        <UButton
          v-if="hasFilters"
          color="neutral"
          variant="ghost"
          :icon="icons.close"
          label="Réinitialiser"
          @click="resetFilters"
        />
      </template>
    </MovementsTable>
  </PagePanel>
</template>
