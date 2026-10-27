<script setup lang="ts">
import { EDITABLE_PURCHASE_STATUSES } from "@G-stock/api/schemas/purchases";
import type { PurchaseOrderStatus } from "@G-stock/core/enums";
import { formatDate, formatFcfa } from "@G-stock/core/format";
import { PURCHASE_ORDER_STATUS_LABELS } from "@G-stock/core/labels";
import type { DropdownMenuItem } from "@nuxt/ui";
import { useMutation, useQuery } from "@tanstack/vue-query";

import ConfirmDialog from "~/components/common/ConfirmDialog.vue";
import PagePanel from "~/components/layout/PagePanel.vue";
import PurchaseOrderForm from "~/components/purchases/PurchaseOrderForm.vue";
import PurchaseOrderView from "~/components/purchases/PurchaseOrderView.vue";
import PurchaseStatusBadge from "~/components/purchases/PurchaseStatusBadge.vue";

type EditableStatus = (typeof EDITABLE_PURCHASE_STATUSES)[number];

const SAVE_FIRST_HINT = "Enregistrez d'abord vos modifications";

const route = useRoute();
const orderId = computed(() => Number(route.params.id));

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidatePurchases = useInvalidatePurchases();

const order = useQuery(
  computed(() => $orpc.purchases.get.queryOptions({ input: { id: orderId.value } })),
);
const data = computed(() => order.data.value);

useHead({ title: () => data.value?.reference ?? "Commande" });

const form = useTemplateRef<InstanceType<typeof PurchaseOrderForm>>("form");
const dirty = ref(false);
const cancelOpen = ref(false);
const deleteOpen = ref(false);

const statusItems = EDITABLE_PURCHASE_STATUSES.map((value) => ({
  label: PURCHASE_ORDER_STATUS_LABELS[value],
  value,
}));

const statusMutation = useMutation($orpc.purchases.setStatus.mutationOptions());
const cancelMutation = useMutation($orpc.purchases.cancel.mutationOptions());
const removeMutation = useMutation($orpc.purchases.remove.mutationOptions());

const isEditableStatus = (status: PurchaseOrderStatus): status is EditableStatus =>
  (EDITABLE_PURCHASE_STATUSES as readonly PurchaseOrderStatus[]).includes(status);

const changeStatus = async (status: EditableStatus) => {
  try {
    await statusMutation.mutateAsync({ id: orderId.value, status });
    await invalidatePurchases();
    notify.success("Statut mis à jour", PURCHASE_ORDER_STATUS_LABELS[status]);
  } catch (error) {
    notify.error("Changement de statut impossible", error);
  }
};

const confirmCancel = async () => {
  try {
    await cancelMutation.mutateAsync({ id: orderId.value });
    await invalidatePurchases();
    cancelOpen.value = false;
    notify.success("Commande annulée", data.value?.reference);
  } catch (error) {
    notify.error("Annulation impossible", error);
  }
};

const confirmDelete = async () => {
  try {
    await removeMutation.mutateAsync({ id: orderId.value });
    deleteOpen.value = false;
    notify.success("Commande supprimée", data.value?.reference);
    await invalidatePurchases();
    await navigateTo("/achats", { replace: true });
  } catch (error) {
    notify.error("Suppression impossible", error);
  }
};

// Une saisie de réception a déjà été enregistrée (frais réels, conteneur…).
const receptionStarted = computed(() => {
  const order = data.value;
  return Boolean(order && (order.fees.length > 0 || order.containerNumber || order.arrivedAt));
});

const moreActions = computed<DropdownMenuItem[][]>(() => [
  [
    {
      icon: "i-lucide-ban",
      label: "Annuler la commande",
      onSelect: () => {
        cancelOpen.value = true;
      },
    },
  ],
  ...(data.value?.status === "draft"
    ? [
        [
          {
            color: "error" as const,
            icon: "i-lucide-trash-2",
            label: "Supprimer le brouillon",
            onSelect: () => {
              deleteOpen.value = true;
            },
          },
        ],
      ]
    : []),
]);
</script>

<template>
  <PagePanel id="purchase-detail" :title="data?.reference ?? 'Commande'" icon="i-lucide-ship">
    <template #actions>
      <UButton
        to="/achats"
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        label="Commandes"
      />
      <template v-if="data?.isLocked">
        <PurchaseStatusBadge :status="data.status" />
        <UButton
          v-if="data.status === 'cancelled'"
          color="error"
          variant="outline"
          icon="i-lucide-trash-2"
          label="Supprimer"
          @click="deleteOpen = true"
        />
      </template>
      <template v-else-if="data">
        <USelect
          :model-value="isEditableStatus(data.status) ? data.status : undefined"
          :items="statusItems"
          :loading="statusMutation.isPending.value"
          aria-label="Statut de la commande"
          class="w-36"
          @update:model-value="changeStatus"
        />
        <UDropdownMenu :items="moreActions" :content="{ align: 'end' }">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-ellipsis-vertical"
            aria-label="Autres actions"
          />
        </UDropdownMenu>
        <UTooltip :text="SAVE_FIRST_HINT" :disabled="!dirty">
          <UButton
            color="success"
            variant="soft"
            icon="i-lucide-package-check"
            label="Réceptionner"
            :disabled="dirty"
            :to="`/achats/${orderId}/reception`"
          />
        </UTooltip>
        <UButton
          type="submit"
          form="purchase-form"
          icon="i-lucide-save"
          label="Enregistrer"
          :disabled="!dirty"
          :loading="form?.saving"
        />
      </template>
    </template>

    <UAlert
      v-if="order.isError.value"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Commande introuvable"
      :description="order.error.value?.message"
    />

    <div v-else-if="data" class="space-y-6">
      <template v-if="data.isLocked">
        <UAlert
          v-if="data.status === 'received' && data.receivedAt"
          color="success"
          variant="subtle"
          icon="i-lucide-package-check"
          :title="`Réceptionnée le ${formatDate(data.receivedAt)}`"
          description="Les lots ont été ajoutés au stock au coût de revient ci-dessous. La commande n'est plus modifiable."
        />
        <UAlert
          v-else
          color="neutral"
          variant="subtle"
          icon="i-lucide-ban"
          title="Commande annulée"
          description="Elle n'a eu aucun effet sur le stock."
        />
        <PurchaseOrderView :order="data" />
      </template>

      <template v-else>
        <UAlert
          v-if="receptionStarted"
          color="info"
          variant="subtle"
          icon="i-lucide-truck"
          title="Réception en préparation"
          :description="`Frais réels saisis : ${formatFcfa(data.fees.reduce((sum, fee) => sum + fee.amountFcfa, 0))}. Le stock ne bouge qu'à la validation de la réception.`"
          :actions="[
            {
              label: 'Continuer la réception',
              to: `/achats/${orderId}/reception`,
              trailingIcon: 'i-lucide-arrow-right',
            },
          ]"
        />
        <PurchaseOrderForm ref="form" v-model:dirty="dirty" :order="data" />
      </template>
    </div>

    <ConfirmDialog
      v-model:open="cancelOpen"
      title="Annuler la commande ?"
      description="Elle restera dans l'historique avec le statut « Annulée » et ne pourra plus être modifiée ni réceptionnée."
      confirm-label="Annuler la commande"
      :loading="cancelMutation.isPending.value"
      @confirm="confirmCancel"
    />
    <ConfirmDialog
      v-model:open="deleteOpen"
      title="Supprimer la commande ?"
      :description="`${data?.reference ?? 'La commande'} sera définitivement supprimée.`"
      confirm-label="Supprimer"
      :loading="removeMutation.isPending.value"
      @confirm="confirmDelete"
    />
  </PagePanel>
</template>
