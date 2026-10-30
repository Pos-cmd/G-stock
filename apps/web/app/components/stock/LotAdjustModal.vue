<script setup lang="ts">
import { lotAdjustSchema } from "@G-stock/api/schemas/stock";
import { formatQty } from "@G-stock/core/format";
import { roundQty } from "@G-stock/core/stock";
import type { FormSubmitEvent } from "@nuxt/ui";
import { useMutation } from "@tanstack/vue-query";
import { z } from "zod";

import DateField from "~/components/common/DateField.vue";
import ResponsiveModal from "~/components/common/ResponsiveModal.vue";
import type { StockLot } from "~/types/api";

const { lot, unit } = defineProps<{ lot: StockLot | null; unit: string }>();
const open = defineModel<boolean>("open", { required: true });

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidateStock = useInvalidateStock();

/** Le jour de l'ajustement est une date d'input (AAAA-MM-JJ), converti à l'envoi. */
const formSchema = lotAdjustSchema.extend({
  occurredAt: z.union([z.literal(""), z.iso.date("Date invalide")]),
});
type FormOutput = z.output<typeof formSchema>;

const state = reactive({
  lotId: "",
  newQty: 0,
  occurredAt: toDateInputValue(),
  reason: "",
});

watch(open, (isOpen) => {
  if (isOpen && lot) {
    Object.assign(state, {
      lotId: lot.id,
      newQty: lot.qtyRemaining,
      occurredAt: toDateInputValue(),
      reason: "",
    });
  }
});

const delta = computed(() =>
  lot ? roundQty((state.newQty ?? 0) - lot.qtyRemaining) : 0
);

const mutation = useMutation($orpc.stock.lots.adjust.mutationOptions());

const onSubmit = async (event: FormSubmitEvent<FormOutput>) => {
  const { occurredAt, ...rest } = event.data;
  try {
    await mutation.mutateAsync({
      ...rest,
      occurredAt: occurredAt ? fromDateInputValue(occurredAt) : null,
    });
    await invalidateStock();
    notify.success(
      "Stock ajusté",
      `${lot?.lotCode ?? "Lot"} : ${formatQty(event.data.newQty, unit)}`
    );
    open.value = false;
  } catch (error) {
    notify.error("Ajustement impossible", error);
  }
};
</script>

<template>
  <ResponsiveModal
    variant="modal"
    v-model:open="open"
    title="Ajuster un lot"
    :description="
      lot
        ? `${lot.lotCode} · reste actuel ${formatQty(lot.qtyRemaining, unit)}`
        : undefined
    "
  >
    <template #body>
      <UForm
        id="lot-adjust-form"
        :schema="formSchema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField
          :label="`Quantité réelle restante (${unit})`"
          name="newQty"
          required
        >
          <UInputNumber
            v-model="state.newQty"
            :min="0"
            :step="1"
            :format-options="QUANTITY_FORMAT"
            class="w-full"
            autofocus
          />
          <template #help>
            <span v-if="delta > 0" class="text-success"
              >Écart : +{{ formatQty(delta, unit) }}</span
            >
            <span v-else-if="delta < 0" class="text-error"
              >Écart : {{ formatQty(delta, unit) }}</span
            >
            <span v-else>Aucun écart pour l'instant.</span>
          </template>
        </UFormField>

        <UFormField label="Motif" name="reason" required>
          <UTextarea
            v-model="state.reason"
            :rows="2"
            autoresize
            placeholder="Ex. : inventaire, casse, erreur de saisie…"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Date de l'ajustement"
          name="occurredAt"
          help="Le jour de l'inventaire ou de la casse, pas celui de la saisie."
        >
          <DateField v-model="state.occurredAt" class="w-full" />
        </UFormField>
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
          form="lot-adjust-form"
          label="Enregistrer l'ajustement"
          :disabled="delta === 0"
          :loading="mutation.isPending.value"
        />
      </div>
    </template>
  </ResponsiveModal>
</template>
