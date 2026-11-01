<script setup lang="ts">
import { saleCancellationSchema } from "@G-stock/api/schemas/sales";
import { formatDate } from "@G-stock/core/format";
import type { FormSubmitEvent } from "@nuxt/ui";
import { useMutation } from "@tanstack/vue-query";
import { z } from "zod";

import DateField from "~/components/common/DateField.vue";
import ResponsiveModal from "~/components/common/ResponsiveModal.vue";

const icons = useIcons();

/** Corrige la date d'une annulation : la vente, ses retours de stock et ses paiements suivent. */
const { sale } = defineProps<{
  sale: { cancelledAt: Date | string | null; id: string; reference: string };
}>();
const open = defineModel<boolean>("open", { required: true });

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidateSales = useInvalidateSales();
const invalidateStock = useInvalidateStock();

const formSchema = saleCancellationSchema
  .omit({ cancelledAt: true, id: true })
  .extend({ cancelledAt: z.iso.date("Date invalide") });
type FormOutput = z.output<typeof formSchema>;

const state = reactive({ cancelledAt: "", reason: "" });

watch(open, (isOpen) => {
  if (isOpen) {
    Object.assign(state, {
      cancelledAt: sale.cancelledAt
        ? toDateInputValue(new Date(sale.cancelledAt))
        : toDateInputValue(),
      reason: "",
    });
  }
});

const currentDate = computed(() =>
  sale.cancelledAt ? formatDate(new Date(sale.cancelledAt)) : "—"
);

const mutation = useMutation($orpc.sales.correctCancellation.mutationOptions());

const onSubmit = async (event: FormSubmitEvent<FormOutput>) => {
  try {
    const result = await mutation.mutateAsync({
      ...event.data,
      cancelledAt: fromDateInputValue(event.data.cancelledAt),
      id: sale.id,
    });
    await Promise.all([invalidateSales(), invalidateStock()]);
    notify.success(
      "Date d'annulation corrigée",
      result.movementCount > 0
        ? `${result.movementCount} mouvement(s) de stock et ${result.paymentsFcfa > 0 ? "les paiements annulés" : "aucun paiement"} suivent la nouvelle date`
        : "La vente porte la nouvelle date"
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
    variant="modal"
    title="Corriger la date d'annulation"
    :description="`${sale.reference} · date enregistrée : ${currentDate}. La vente reste annulée ; seuls la date, les retours de stock et les paiements annulés changent.`"
  >
    <template #body>
      <UForm
        id="cancellation-form"
        :schema="formSchema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField
          label="Date réelle de l'annulation"
          name="cancelledAt"
          required
          help="C'est cette date qui classe le retour de stock dans l'historique."
        >
          <DateField v-model="state.cancelledAt" class="w-full" autofocus />
        </UFormField>
        <UFormField
          label="Motif de la correction"
          name="reason"
          required
          help="Il restera visible dans le journal de la vente."
        >
          <UTextarea
            v-model="state.reason"
            :rows="2"
            autoresize
            placeholder="Ex. : la vente a été annulée le lendemain, pas aujourd'hui…"
            class="w-full"
          />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          label="Retour"
          @click="open = false"
        />
        <UButton
          type="submit"
          form="cancellation-form"
          :icon="icons.calendar"
          label="Corriger la date"
          :loading="mutation.isPending.value"
        />
      </div>
    </template>
  </ResponsiveModal>
</template>
