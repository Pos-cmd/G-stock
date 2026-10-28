<script setup lang="ts">
import { isUuid } from "@G-stock/core/ids";

import PagePanel from "~/components/layout/PagePanel.vue";
import SaleForm from "~/components/sales/SaleForm.vue";

const icons = useIcons();

useHead({ title: "Nouvelle vente" });

const route = useRoute();
const customerId = isUuid(route.query.client) ? route.query.client : undefined;

const form = useTemplateRef<InstanceType<typeof SaleForm>>("form");

const onSaved = async (id: string) => {
  await navigateTo(`/ventes/${id}`, { replace: true });
};
</script>

<template>
  <PagePanel
    id="sale-new"
    title="Nouvelle vente"
    description="Le stock et la marge sont calculés sur les lots réels, au fil de la saisie."
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

    <SaleForm ref="form" :customer-id="customerId" @saved="onSaved" />
  </PagePanel>
</template>
