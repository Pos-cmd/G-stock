<script setup lang="ts">
import { formatDate } from "@G-stock/core/format";
import { useMutation } from "@tanstack/vue-query";
import { z } from "zod";

import DateField from "~/components/common/DateField.vue";
import ResponsiveModal from "~/components/common/ResponsiveModal.vue";

/** Corrige la date d'entrée en stock d'une commande déjà reçue : lots et mouvements suivent. */
const { order } = defineProps<{
  order: { id: string; receivedAt: Date | string | null; reference: string };
}>();
const open = defineModel<boolean>("open", { required: true });

const icons = useIcons();
const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidatePurchases = useInvalidatePurchases();
const invalidateStock = useInvalidateStock();

const formSchema = z.object({
  receivedAt: z.iso.date("Indiquez la date d'entrée en stock"),
});
type FormOutput = z.output<typeof formSchema>;

const state = reactive({ receivedAt: toDateInputValue() });

watch(open, (isOpen) => {
  if (isOpen) {
    state.receivedAt = order.receivedAt
      ? toDateInputValue(new Date(order.receivedAt))
      : toDateInputValue();
  }
});

const mutation = useMutation(
  $orpc.purchases.updateReceptionDate.mutationOptions()
);

const onSubmit = async (event: { data: FormOutput }) => {
  try {
    const result = await mutation.mutateAsync({
      id: order.id,
      receivedAt: fromDateInputValue(event.data.receivedAt),
    });
    await Promise.all([invalidatePurchases(), invalidateStock()]);
    notify.success(
      "Date d'entrée corrigée",
      `${formatDate(result.receivedAt)} · ${result.lotCount} lot(s), ${result.movementCount} mouvement(s)`
    );
    open.value = false;
  } catch (error) {
    notify.error("Correction impossible", error);
  }
};
</script>

<template>
  <ResponsiveModal
    v-model:open="open"
    title="Date d'entrée en stock"
    :description="`${order.reference} · entrée enregistrée le ${order.receivedAt ? formatDate(order.receivedAt) : '—'}`"
  >
    <template #body>
      <UForm
        id="reception-date-form"
        :schema="formSchema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField
          label="Entrée en stock réelle"
          name="receivedAt"
          required
          help="La commande, ses lots et ses mouvements de stock prennent cette date."
        >
          <DateField v-model="state.receivedAt" class="w-full" />
        </UFormField>
        <UAlert
          color="neutral"
          variant="subtle"
          :icon="icons.info"
          title="Les quantités et les coûts ne changent pas"
          description="Seule la date bouge : l'historique du stock se relit au bon jour, et l'ordre FIFO des lots suit cette date pour les prochaines ventes."
        />
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          label="Annuler"
          @click="open = false"
        />
        <UButton
          type="submit"
          form="reception-date-form"
          :icon="icons.save"
          label="Corriger la date"
          :loading="mutation.isPending.value"
        />
      </div>
    </template>
  </ResponsiveModal>
</template>
