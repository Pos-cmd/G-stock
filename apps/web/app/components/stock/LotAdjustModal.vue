<script setup lang="ts">
import { lotAdjustSchema } from "@G-stock/api/schemas/stock";
import type { LotAdjustInput } from "@G-stock/api/schemas/stock";
import { formatQty } from "@G-stock/core/format";
import { roundQty } from "@G-stock/core/stock";
import type { FormSubmitEvent } from "@nuxt/ui";
import { useMutation } from "@tanstack/vue-query";
import type { z } from "zod";

import type { StockLot } from "~/types/api";
import ResponsiveModal from "~/components/common/ResponsiveModal.vue";

const { lot, unit } = defineProps<{ lot: StockLot | null; unit: string }>();
const open = defineModel<boolean>("open", { required: true });

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidateStock = useInvalidateStock();

const state = reactive<LotAdjustInput>({ lotId: "", newQty: 0, reason: "" });

watch(open, (isOpen) => {
  if (isOpen && lot) {
    Object.assign(state, { lotId: lot.id, newQty: lot.qtyRemaining, reason: "" });
  }
});

const delta = computed(() => (lot ? roundQty((state.newQty ?? 0) - lot.qtyRemaining) : 0));

const mutation = useMutation($orpc.stock.lots.adjust.mutationOptions());

const onSubmit = async (event: FormSubmitEvent<z.output<typeof lotAdjustSchema>>) => {
  try {
    await mutation.mutateAsync(event.data);
    await invalidateStock();
    notify.success(
      "Stock ajusté",
      `${lot?.lotCode ?? "Lot"} : ${formatQty(event.data.newQty, unit)}`,
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
      lot ? `${lot.lotCode} · reste actuel ${formatQty(lot.qtyRemaining, unit)}` : undefined
    "
  >
    <template #body>
      <UForm
        id="lot-adjust-form"
        :schema="lotAdjustSchema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField :label="`Quantité réelle restante (${unit})`" name="newQty" required>
          <UInputNumber
            v-model="state.newQty"
            :min="0"
            :step="1"
            :format-options="{ maximumFractionDigits: 3 }"
            class="w-full"
            autofocus
          />
          <template #help>
            <span v-if="delta > 0" class="text-success">Écart : +{{ formatQty(delta, unit) }}</span>
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
      </UForm>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Annuler" @click="open = false" />
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
