<script setup lang="ts">
import { saleDiscountSchema } from "@G-stock/api/schemas/sales";
import { formatFcfa } from "@G-stock/core/format";
import type { FormSubmitEvent } from "@nuxt/ui";
import { useMutation } from "@tanstack/vue-query";
import { z } from "zod";
import ResponsiveModal from "~/components/common/ResponsiveModal.vue";

const icons = useIcons();

/** Remise accordée après la vente : montant et motif obligatoire, tracés dans l'historique. */
const { sale } = defineProps<{
  sale: { id: string; reference: string; netFcfa: number };
}>();
const open = defineModel<boolean>("open", { required: true });

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidateSales = useInvalidateSales();

const formSchema = saleDiscountSchema.omit({ discountDate: true, saleId: true }).extend({
  discountDate: z.iso.date("Date invalide"),
});
type FormOutput = z.output<typeof formSchema>;

const state = reactive({
  amountFcfa: 0,
  discountDate: toDateInputValue(),
  reason: "",
});

watch(open, (isOpen) => {
  if (isOpen) {
    Object.assign(state, {
      amountFcfa: 0,
      discountDate: toDateInputValue(),
      reason: "",
    });
  }
});

const mutation = useMutation($orpc.sales.addDiscount.mutationOptions());

const onSubmit = async (event: FormSubmitEvent<FormOutput>) => {
  try {
    await mutation.mutateAsync({
      ...event.data,
      discountDate: fromDateInputValue(event.data.discountDate),
      saleId: sale.id,
    });
    await invalidateSales();
    notify.success(
      "Remise enregistrée",
      `${formatFcfa(event.data.amountFcfa)} sur ${sale.reference}`,
    );
    open.value = false;
  } catch (error) {
    notify.error("Remise impossible", error);
  }
};
</script>

<template>
  <ResponsiveModal
    variant="modal"
    v-model:open="open"
    title="Accorder une remise"
    :description="`${sale.reference} · montant net actuel ${formatFcfa(sale.netFcfa)}. Si la vente est déjà payée, la remise devient un avoir du client.`"
  >
    <template #body>
      <UForm
        id="discount-form"
        :schema="formSchema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Montant de la remise" name="amountFcfa" required>
            <UInputNumber
              v-model="state.amountFcfa"
              :min="0"
              :max="sale.netFcfa"
              :step="500"
              :format-options="FCFA_FORMAT"
              class="w-full"
              autofocus
            />
          </UFormField>
          <UFormField label="Date" name="discountDate" required>
            <UInput v-model="state.discountDate" type="date" class="w-full" />
          </UFormField>
        </div>
        <UFormField label="Motif" name="reason" required help="Il restera visible sur la vente.">
          <UTextarea
            v-model="state.reason"
            :rows="2"
            autoresize
            placeholder="Ex. : rouleaux abîmés, geste commercial…"
            class="w-full"
          />
        </UFormField>
        <div class="bg-elevated/50 flex justify-between rounded-lg px-3 py-2 text-sm">
          <span class="text-muted">Nouveau montant net</span>
          <span class="text-highlighted font-semibold tabular-nums">
            {{ formatFcfa(Math.max(sale.netFcfa - (state.amountFcfa || 0), 0)) }}
          </span>
        </div>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Annuler" @click="open = false" />
        <UButton
          type="submit"
          form="discount-form"
          :icon="icons.discount"
          label="Enregistrer la remise"
          :loading="mutation.isPending.value"
        />
      </div>
    </template>
  </ResponsiveModal>
</template>
