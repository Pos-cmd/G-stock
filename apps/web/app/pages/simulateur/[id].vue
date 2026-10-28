<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";

import ConfirmDialog from "~/components/common/ConfirmDialog.vue";
import PagePanel from "~/components/layout/PagePanel.vue";
import SimulationEditor from "~/components/simulator/SimulationEditor.vue";

const icons = useIcons();

const SAVE_FIRST_HINT = "Enregistrez d'abord vos modifications";

const route = useRoute();
const simulationId = computed(() => String(route.params.id));

const { $orpc } = useNuxtApp();
const notify = useNotify();
const queryClient = useQueryClient();
const invalidatePurchases = useInvalidatePurchases();
const invalidateStock = useInvalidateStock();

const simulation = useQuery(
  computed(() => $orpc.simulations.get.queryOptions({ input: { id: simulationId.value } })),
);
const data = computed(() => simulation.data.value);

useHead({ title: () => data.value?.name ?? "Simulation" });

const editor = useTemplateRef<InstanceType<typeof SimulationEditor>>("editor");
const { generate, generating } = useGenerateDocument();
const dirty = ref(false);
const convertOpen = ref(false);

const duplicateMutation = useMutation($orpc.simulations.duplicate.mutationOptions());
const convertMutation = useMutation($orpc.simulations.convertToOrder.mutationOptions());

const duplicate = async () => {
  try {
    const copy = await duplicateMutation.mutateAsync({ id: simulationId.value });
    await queryClient.invalidateQueries({ queryKey: $orpc.simulations.key() });
    notify.success("Simulation dupliquée", copy.name);
    await navigateTo(`/simulateur/${copy.id}`);
  } catch (error) {
    notify.error("Duplication impossible", error);
  }
};

const convert = async () => {
  try {
    const result = await convertMutation.mutateAsync({ id: simulationId.value });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: $orpc.simulations.key() }),
      invalidatePurchases(),
      invalidateStock(),
    ]);
    convertOpen.value = false;
    notify.success(
      `Commande ${result.reference} créée`,
      result.createdProducts.length > 0
        ? `Produits créés : ${result.createdProducts.join(", ")}`
        : undefined,
    );
    await navigateTo(`/achats/${result.orderId}`);
  } catch (error) {
    notify.error("Création de la commande impossible", error);
  }
};

const moreActions = computed<DropdownMenuItem[][]>(() => [
  [
    {
      icon: icons.copy,
      label: "Dupliquer pour comparer",
      onSelect: duplicate,
    },
    {
      icon: icons.compare,
      label: "Comparer avec…",
      to: comparisonLink([{ id: simulationId.value, type: "simulation" }]),
    },
  ],
]);
</script>

<template>
  <PagePanel
    id="simulation-detail"
    :title="data?.name ?? 'Simulation'"
    :icon="icons.simulations"
    :parents="[{ label: 'Simulations', to: '/simulateur' }]"
  >
    <template #actions>
      <UFieldGroup>
        <UTooltip :text="SAVE_FIRST_HINT" :disabled="!dirty">
          <UButton
            color="neutral"
            variant="outline"
            :icon="icons.pdf"
            label="PDF"
            :disabled="dirty || !data"
            :loading="generating"
            @click="generate('simulation', simulationId)"
          />
        </UTooltip>
        <UButton
          v-if="data?.purchaseOrderId"
          :to="`/achats/${data.purchaseOrderId}`"
          color="neutral"
          variant="outline"
          :icon="icons.purchases"
          :label="`Commande ${data.orderReference ?? ''}`"
        />
        <UTooltip v-else :text="SAVE_FIRST_HINT" :disabled="!dirty">
          <UButton
            color="neutral"
            variant="outline"
            :icon="icons.purchases"
            label="Créer la commande"
            :disabled="dirty || !data"
            @click="convertOpen = true"
          />
        </UTooltip>
        <UDropdownMenu :items="moreActions" :content="{ align: 'end' }">
          <UButton
            color="neutral"
            variant="outline"
            :icon="icons.moreActions"
            aria-label="Autres actions"
          />
        </UDropdownMenu>
      </UFieldGroup>
      <UButton
        type="submit"
        form="simulation-form"
        :icon="icons.save"
        label="Enregistrer"
        :disabled="!dirty"
        :loading="editor?.saving"
      />
    </template>

    <UAlert
      v-if="simulation.isError.value"
      color="error"
      variant="subtle"
      :icon="icons.error"
      title="Simulation introuvable"
      :description="simulation.error.value?.message"
    />
    <SimulationEditor v-else-if="data" ref="editor" v-model:dirty="dirty" :simulation="data" />

    <ConfirmDialog
      v-model:open="convertOpen"
      title="Créer la commande fournisseur ?"
      description="Une commande en brouillon sera créée avec ces quantités, prix et frais (les frais libres deviennent des « autres frais »). Les lignes sans produit du catalogue créeront le produit, avec le prix de vente simulé comme prix conseillé."
      confirm-label="Créer la commande"
      confirm-color="primary"
      :loading="convertMutation.isPending.value"
      @confirm="convert"
    />
  </PagePanel>
</template>
