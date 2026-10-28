<script setup lang="ts">
import { lotEntrySchema } from "@G-stock/api/schemas/stock";
import { rmbToFcfa } from "@G-stock/core/currency";
import { formatFcfa, formatQty } from "@G-stock/core/format";
import type { FormSubmitEvent } from "@nuxt/ui";
import { useMutation } from "@tanstack/vue-query";
import { z } from "zod";

import { useSettingsStore } from "~/stores/settings";
import ResponsiveModal from "~/components/common/ResponsiveModal.vue";

const icons = useIcons();

const { product } = defineProps<{
  product: { id: string; name: string; unit: string } | null;
}>();
const open = defineModel<boolean>("open", { required: true });

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidateStock = useInvalidateStock();
const settingsStore = useSettingsStore();

const formSchema = lotEntrySchema.omit({ productId: true, receivedAt: true }).extend({
  receivedAt: z.iso.date("Date invalide"),
});
type FormState = Omit<z.input<typeof formSchema>, "notes"> & { notes: string };

const state = reactive<FormState>({
  notes: "",
  qty: 1,
  receivedAt: toDateInputValue(),
  unitCostFcfa: 0,
});
const converter = reactive({ feesPerUnitFcfa: 0, priceRmb: null as number | null });

watch(open, async (isOpen) => {
  if (!isOpen) {
    return;
  }
  await settingsStore.load();
  Object.assign(state, { notes: "", qty: 1, receivedAt: toDateInputValue(), unitCostFcfa: 0 });
  Object.assign(converter, { feesPerUnitFcfa: 0, priceRmb: null });
});

const convertedCost = computed(() =>
  converter.priceRmb
    ? rmbToFcfa(converter.priceRmb, settingsStore.rates) + (converter.feesPerUnitFcfa || 0)
    : null,
);

const applyConvertedCost = () => {
  if (convertedCost.value !== null) {
    state.unitCostFcfa = convertedCost.value;
  }
};

const totalValue = computed(() => Math.round((state.qty ?? 0) * (state.unitCostFcfa ?? 0)));

const mutation = useMutation($orpc.stock.lots.create.mutationOptions());

const onSubmit = async (event: FormSubmitEvent<z.output<typeof formSchema>>) => {
  if (!product) {
    return;
  }
  try {
    const lot = await mutation.mutateAsync({
      ...event.data,
      productId: product.id,
      receivedAt: fromDateInputValue(event.data.receivedAt),
    });
    await invalidateStock();
    notify.success(
      "Entrée de stock enregistrée",
      `${lot.lotCode} · ${formatQty(lot.qtyInitial, product.unit)}`,
    );
    open.value = false;
  } catch (error) {
    notify.error("Entrée de stock impossible", error);
  }
};
</script>

<template>
  <ResponsiveModal
    v-model:open="open"
    title="Entrée de stock"
    :description="product ? `Nouveau lot pour « ${product.name} »` : undefined"
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <template #body>
      <UForm
        id="lot-entry-form"
        :schema="formSchema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField :label="`Quantité (${product?.unit ?? 'unité'})`" name="qty" required>
            <UInputNumber
              v-model="state.qty"
              :min="0"
              :step="1"
              :format-options="{ maximumFractionDigits: 3 }"
              class="w-full"
              autofocus
            />
          </UFormField>

          <UFormField label="Date de réception" name="receivedAt" required>
            <UInput v-model="state.receivedAt" type="date" class="w-full" />
          </UFormField>

          <UFormField
            label="Coût de revient unitaire (FCFA)"
            name="unitCostFcfa"
            required
            class="sm:col-span-2"
            help="Prix d'achat converti + frais de transport répartis, par unité."
          >
            <UInputNumber
              v-model="state.unitCostFcfa"
              :min="0"
              :step="100"
              :format-options="{ maximumFractionDigits: 0 }"
              class="w-full"
            />
          </UFormField>
        </div>

        <UCollapsible class="rounded-lg border border-default">
          <UButton
            color="neutral"
            variant="ghost"
            block
            :icon="icons.calculate"
            :trailing-icon="icons.chevronDown"
            label="Calculer depuis un prix en RMB"
            class="justify-start"
            :ui="{ trailingIcon: 'ms-auto' }"
          />
          <template #content>
            <div class="grid gap-3 border-t border-default p-3 sm:grid-cols-2">
              <UFormField label="Prix unitaire (RMB)">
                <UInputNumber
                  v-model="converter.priceRmb"
                  :min="0"
                  :step="0.5"
                  :format-options="{ maximumFractionDigits: 2 }"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Frais par unité (FCFA)">
                <UInputNumber
                  v-model="converter.feesPerUnitFcfa"
                  :min="0"
                  :step="50"
                  :format-options="{ maximumFractionDigits: 0 }"
                  class="w-full"
                />
              </UFormField>
              <div class="flex items-center justify-between gap-3 sm:col-span-2">
                <p class="text-sm text-muted">
                  Taux : {{ settingsStore.rates.rmbPerUsd }} RMB = 1 $ =
                  {{ settingsStore.rates.fcfaPerUsd }} FCFA
                  <template v-if="convertedCost !== null">
                    <br />
                    Coût calculé :
                    <strong class="text-highlighted">{{ formatFcfa(convertedCost) }}</strong>
                  </template>
                </p>
                <UButton
                  size="sm"
                  variant="soft"
                  label="Utiliser"
                  :disabled="convertedCost === null"
                  @click="applyConvertedCost"
                />
              </div>
            </div>
          </template>
        </UCollapsible>

        <UFormField label="Notes" name="notes">
          <UTextarea
            v-model="state.notes"
            :rows="2"
            autoresize
            placeholder="Ex. : stock initial, conteneur de mars…"
            class="w-full"
          />
        </UFormField>

        <div class="flex items-center justify-between rounded-lg bg-elevated/50 px-3 py-2 text-sm">
          <span class="text-muted">Valeur du lot</span>
          <span class="font-semibold text-highlighted tabular-nums">{{
            formatFcfa(totalValue)
          }}</span>
        </div>
      </UForm>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Annuler" @click="open = false" />
        <UButton
          type="submit"
          form="lot-entry-form"
          label="Enregistrer l'entrée"
          :loading="mutation.isPending.value"
        />
      </div>
    </template>
  </ResponsiveModal>
</template>
