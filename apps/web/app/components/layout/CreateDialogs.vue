<script setup lang="ts">
import PageModal from "~/components/common/PageModal.vue";
import CustomerFormModal from "~/components/customers/CustomerFormModal.vue";
import ProductFormModal from "~/components/products/ProductFormModal.vue";
import PurchaseOrderForm from "~/components/purchases/PurchaseOrderForm.vue";
import SaleForm from "~/components/sales/SaleForm.vue";
import SimulationEditor from "~/components/simulator/SimulationEditor.vue";

// Fenêtres de création partagées par toute l'application (voir useCreateDialogs).
const icons = useIcons();
const route = useRoute();
const { state } = useCreateDialogs();

const saleForm = useTemplateRef<InstanceType<typeof SaleForm>>("saleForm");
const purchaseForm = useTemplateRef<InstanceType<typeof PurchaseOrderForm>>("purchaseForm");
const simulationForm = useTemplateRef<InstanceType<typeof SimulationEditor>>("simulationForm");

type DialogKey = "customer" | "product" | "purchase" | "sale" | "simulation";

const PAGES = {
  purchase: "/achats/nouvelle",
  sale: "/ventes/nouvelle",
  simulation: "/simulateur/nouvelle",
} as const;

// Déjà sur la page : l'agrandir n'apporterait rien.
const canExpand = (key: keyof typeof PAGES) => route.path !== PAGES[key];

const expand = async (key: keyof typeof PAGES, form: { stashDraft: () => void } | null) => {
  form?.stashDraft();
  state.value[key] = false;
  await navigateTo(PAGES[key]);
};

const openCreated = async (key: DialogKey, path: string) => {
  state.value[key] = false;
  await navigateTo(path);
};
</script>

<template>
  <PageModal
    v-model:open="state.sale"
    title="Nouvelle vente"
    :icon="icons.sale"
    :expandable="canExpand('sale')"
    @expand="expand('sale', saleForm)"
  >
    <template #body>
      <SaleForm
        ref="saleForm"
        form-id="sale-dialog-form"
        :customer-id="state.saleCustomerId"
        @saved="openCreated('sale', `/ventes/${$event}`)"
      />
    </template>
    <template #footer>
      <UButton color="neutral" variant="outline" label="Annuler" @click="state.sale = false" />
      <UButton
        type="submit"
        form="sale-dialog-form"
        :icon="icons.check"
        label="Enregistrer la vente"
        :loading="saleForm?.saving"
      />
    </template>
  </PageModal>

  <PageModal
    v-model:open="state.purchase"
    title="Nouvelle commande fournisseur"
    :icon="icons.purchases"
    :expandable="canExpand('purchase')"
    @expand="expand('purchase', purchaseForm)"
  >
    <template #body>
      <PurchaseOrderForm
        ref="purchaseForm"
        form-id="purchase-dialog-form"
        @saved="openCreated('purchase', `/achats/${$event}`)"
      />
    </template>
    <template #footer>
      <UButton color="neutral" variant="outline" label="Annuler" @click="state.purchase = false" />
      <UButton
        type="submit"
        form="purchase-dialog-form"
        :icon="icons.save"
        label="Créer la commande"
        :loading="purchaseForm?.saving"
      />
    </template>
  </PageModal>

  <PageModal
    v-model:open="state.simulation"
    title="Nouvelle simulation"
    :icon="icons.simulations"
    :expandable="canExpand('simulation')"
    @expand="expand('simulation', simulationForm)"
  >
    <template #body>
      <SimulationEditor
        ref="simulationForm"
        form-id="simulation-dialog-form"
        @saved="openCreated('simulation', `/simulateur/${$event}`)"
      />
    </template>
    <template #footer>
      <UButton
        color="neutral"
        variant="outline"
        label="Annuler"
        @click="state.simulation = false"
      />
      <UButton
        type="submit"
        form="simulation-dialog-form"
        :icon="icons.save"
        label="Enregistrer"
        :loading="simulationForm?.saving"
      />
    </template>
  </PageModal>

  <ProductFormModal
    v-model:open="state.product"
    @saved="openCreated('product', `/produits/${$event}`)"
  />
  <CustomerFormModal
    v-model:open="state.customer"
    @saved="openCreated('customer', `/clients/${$event}`)"
  />
</template>
