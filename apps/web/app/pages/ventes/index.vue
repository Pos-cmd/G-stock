<script setup lang="ts">
import { isUuid } from "@G-stock/core/ids";
import type { TabsItem } from "@nuxt/ui";

import PagePanel from "~/components/layout/PagePanel.vue";
import ProductSalesTable from "~/components/sales/ProductSalesTable.vue";
import SalesFilters from "~/components/sales/SalesFilters.vue";
import SalesTable from "~/components/sales/SalesTable.vue";

const icons = useIcons();
const create = useCreateDialogs();

useHead({ title: "Ventes" });

// `?du=AAAA-MM-JJ&au=AAAA-MM-JJ&produit=…` (calendriers d'activité) fixe la période et le produit.
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const route = useRoute();
const queryDay = (value: unknown) =>
  typeof value === "string" && DAY_PATTERN.test(value) ? value : "";
const filtersFromQuery = (): SalesFilterState => ({
  ...emptySalesFilters(),
  from: queryDay(route.query.du),
  productId: isUuid(route.query.produit) ? route.query.produit : undefined,
  to: queryDay(route.query.au),
});
const filters = ref<SalesFilterState>(filtersFromQuery());
watch(
  () => [route.query.du, route.query.au, route.query.produit],
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

    <SalesTable v-if="view === 'sales'" :filters="filters">
      <template #filters>
        <SalesFilters v-model="filters" />
      </template>
    </SalesTable>
    <ProductSalesTable v-else :from="filters.from" :to="filters.to">
      <template #filters>
        <SalesFilters v-model="filters" period-only />
      </template>
    </ProductSalesTable>
  </PagePanel>
</template>
