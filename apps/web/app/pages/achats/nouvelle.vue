<script setup lang="ts">
import PagePanel from "~/components/layout/PagePanel.vue";
import PurchaseOrderForm from "~/components/purchases/PurchaseOrderForm.vue";

const icons = useIcons();

useHead({ title: "Nouvelle commande" });

const form = useTemplateRef<InstanceType<typeof PurchaseOrderForm>>("form");

const onSaved = async (id: string) => {
  await navigateTo(`/achats/${id}`, { replace: true });
};
</script>

<template>
  <PagePanel id="purchase-new" title="Nouvelle commande fournisseur" :icon="icons.purchases">
    <template #actions>
      <UButton
        to="/achats"
        color="neutral"
        variant="ghost"
        :icon="icons.arrowLeft"
        label="Commandes"
      />
      <UButton
        type="submit"
        form="purchase-form"
        :icon="icons.save"
        label="Créer la commande"
        :loading="form?.saving"
      />
    </template>

    <PurchaseOrderForm ref="form" @saved="onSaved" />
  </PagePanel>
</template>
