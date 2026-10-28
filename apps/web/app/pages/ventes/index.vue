<script setup lang="ts">
import type { TabsItem } from "@nuxt/ui";

import PagePanel from "~/components/layout/PagePanel.vue";
import ProductSalesTable from "~/components/sales/ProductSalesTable.vue";
import SalesFilters from "~/components/sales/SalesFilters.vue";
import SalesTable from "~/components/sales/SalesTable.vue";

const icons = useIcons();
const create = useCreateDialogs();

useHead({ title: "Ventes" });

// `?du=AAAA-MM-JJ&au=AAAA-MM-JJ` (calendrier d'activité du tableau de bord) fixe la période.
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const route = useRoute();
const queryDay = (value: unknown) =>
  typeof value === "string" && DAY_PATTERN.test(value) ? value : "";
const filtersFromQuery = (): SalesFilterState => ({
  ...emptySalesFilters(),
  from: queryDay(route.query.du),
  to: queryDay(route.query.au),
});
const filters = ref<SalesFilterState>(filtersFromQuery());
watch(
  () => [route.query.du, route.query.au],
  () => {
    filters.value = filtersFromQuery();
  },
);

const view = ref<"products" | "sales">("sales");
const views: TabsItem[] = [
  { label: "Ventes", value: "sales" },
  { label: "Par produit", value: "products" },
];
</script>

<template>
  <PagePanel id="sales" title="Ventes">
    <template #description>
      <template v-if="view === 'sales'">Chaque vente, son encaissement et sa marge.</template>
      <template v-else>Quantités vendues et marge par produit, sur la période choisie.</template>
    </template>
    <template #tabs>
      <UTabs v-model="view" :items="views" :content="false" />
    </template>
    <template #actions>
      <UButton :icon="icons.plus" label="Nouvelle vente" @click="create.openSale()" />
    </template>

    <template #toolbar>
      <SalesFilters v-model="filters" :period-only="view === 'products'" />
    </template>

    <SalesTable v-if="view === 'sales'" :filters="filters" />
    <ProductSalesTable v-else :from="filters.from" :to="filters.to" />
  </PagePanel>
</template>
