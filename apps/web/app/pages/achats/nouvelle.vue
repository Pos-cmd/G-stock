<script setup lang="ts">
import PagePanel from "~/components/layout/PagePanel.vue";
import PurchaseOrderForm from "~/components/purchases/PurchaseOrderForm.vue";

useHead({ title: "Nouvelle commande" });

const form = useTemplateRef<InstanceType<typeof PurchaseOrderForm>>("form");

const onSaved = async (id: number) => {
  await navigateTo(`/achats/${id}`, { replace: true });
};
</script>

<template>
  <PagePanel id="purchase-new" title="Nouvelle commande fournisseur" icon="i-lucide-ship">
    <template #actions>
      <UButton
        to="/achats"
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        label="Commandes"
      />
      <UButton
        type="submit"
        form="purchase-form"
        icon="i-lucide-save"
        label="Créer la commande"
        :loading="form?.saving"
      />
    </template>

    <PurchaseOrderForm ref="form" @saved="onSaved" />
  </PagePanel>
</template>
