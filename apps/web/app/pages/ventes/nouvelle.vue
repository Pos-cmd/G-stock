<script setup lang="ts">
import { isUuid } from "@G-stock/core/ids";

import PagePanel from "~/components/layout/PagePanel.vue";
import SaleForm from "~/components/sales/SaleForm.vue";

const icons = useIcons();

useHead({ title: "Nouvelle vente" });

const route = useRoute();
const customerId = isUuid(route.query.client) ? route.query.client : undefined;

/** Articles repris à revendre tout de suite : `?reprise=<produit>:<quantité>,…`. */
const initialLines = computed(() => {
  const raw = route.query.reprise;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  return value
    .split(",")
    .map((part) => part.split(":"))
    .flatMap(([productId, qty]) => {
      const parsedQty = Number(qty);
      return isUuid(productId) && parsedQty > 0
        ? [{ productId, qty: parsedQty }]
        : [];
    });
});

const form = useTemplateRef<InstanceType<typeof SaleForm>>("form");

const onSaved = async (id: string) => {
  await navigateTo(`/ventes/${id}`, { replace: true });
};
</script>

<template>
  <PagePanel
    id="sale-new"
    title="Nouvelle vente"
    :description="
      initialLines.length > 0
        ? 'Articles repris : choisissez le client qui les reprend, les lignes sont déjà remplies.'
        : 'Le stock et la marge sont calculés sur les lots réels, au fil de la saisie.'
    "
    :icon="icons.sale"
    :parents="[{ label: 'Ventes', to: '/ventes' }]"
  >
    <template #actions>
      <UButton
        type="submit"
        form="sale-form"
        :icon="icons.check"
        label="Enregistrer la vente"
        :loading="form?.saving"
      />
    </template>

    <SaleForm
      ref="form"
      :customer-id="customerId"
      :initial-lines="initialLines"
      @saved="onSaved"
    />
  </PagePanel>
</template>
