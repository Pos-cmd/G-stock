<script setup lang="ts">
import type { TabsItem } from "@nuxt/ui";

import PagePanel from "~/components/layout/PagePanel.vue";
import ProductSalesTable from "~/components/sales/ProductSalesTable.vue";
import SalesFilters from "~/components/sales/SalesFilters.vue";
import SalesTable from "~/components/sales/SalesTable.vue";

useHead({ title: "Ventes" });

const filters = ref<SalesFilterState>(emptySalesFilters());

const tabs: TabsItem[] = [
  { icon: "i-lucide-receipt", label: "Ventes", slot: "sales", value: "sales" },
  {
    icon: "i-lucide-boxes",
    label: "Par produit",
    slot: "products",
    value: "products",
  },
];
</script>

<template>
  <PagePanel id="sales" title="Ventes" icon="i-lucide-shopping-cart">
    <template #actions>
      <UButton to="/ventes/nouvelle" icon="i-lucide-plus" label="Nouvelle vente" />
    </template>

    <template #toolbar>
      <SalesFilters v-model="filters" />
    </template>

    <UTabs :items="tabs" variant="link" class="w-full">
      <template #sales>
        <div class="pt-2">
          <SalesTable :filters="filters" />
        </div>
      </template>
      <template #products>
        <div class="pt-2">
          <p class="text-muted mb-3 text-sm">
            Selon la période choisie ; les autres filtres ne s'appliquent qu'à la liste des ventes.
          </p>
          <ProductSalesTable :from="filters.from" :to="filters.to" />
        </div>
      </template>
    </UTabs>
  </PagePanel>
</template>
