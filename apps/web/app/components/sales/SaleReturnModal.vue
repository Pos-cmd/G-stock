<script setup lang="ts">
import { RETURN_REFUND_METHODS } from "@G-stock/core/enums";
import type { ReturnRefundMethod } from "@G-stock/core/enums";
import { formatDate, formatFcfa, formatQty } from "@G-stock/core/format";
import { RETURN_REFUND_METHOD_LABELS } from "@G-stock/core/labels";
import { lineAmountFcfa } from "@G-stock/core/sales";
import type { FormSubmitEvent } from "@nuxt/ui";
import { useMutation } from "@tanstack/vue-query";
import { z } from "zod";

import DateField from "~/components/common/DateField.vue";
import ResponsiveModal from "~/components/common/ResponsiveModal.vue";

/** Article repris : ce qui revient, et s'il retourne en stock. */
interface ReturnRow {
  productName: string;
  qty: number;
  restocked: boolean;
  saleItemId: string;
  soldQty: number;
  unit: string | null;
  unitPriceFcfa: number;
}

const { sale } = defineProps<{
  sale: {
    dueFcfa: number;
    id: string;
    items: readonly {
      id: string;
      productName: string;
      productUnit: string | null;
      qty: number;
      unitPriceFcfa: number;
    }[];
    reference: string;
  };
}>();
const open = defineModel<boolean>("open", { required: true });

const icons = useIcons();
const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidateSales = useInvalidateSales();
const invalidateStock = useInvalidateStock();

const formSchema = z
  .object({
    items: z.array(
      z.object({
        productName: z.string(),
        qty: z.number().min(0, "Quantité invalide"),
        restocked: z.boolean(),
        saleItemId: z.uuid(),
        soldQty: z.number(),
        unit: z.string().nullish(),
        unitPriceFcfa: z.number(),
      })
    ),
    reason: z
      .string()
      .trim()
      .min(3, "Indiquez le motif de la reprise")
      .max(500),
    refundMethod: z.enum(RETURN_REFUND_METHODS),
    returnDate: z.iso.date("Date invalide"),
  })
  .superRefine((value, ctx) => {
    if (!value.items.some((item) => item.qty > 0)) {
      ctx.addIssue({
        code: "custom",
        message: "Choisissez au moins un article repris",
        path: ["items"],
      });
    }
  });
type FormOutput = z.output<typeof formSchema>;

interface ReturnState {
  items: ReturnRow[];
  reason: string;
  refundMethod: ReturnRefundMethod;
  returnDate: string;
}

const state = reactive<ReturnState>({
  items: [],
  reason: "",
  refundMethod: "credit",
  returnDate: toDateInputValue(),
});

/** Résultat enregistré : l'écran propose alors de revendre la marchandise tout de suite. */
const saved = ref<{
  amountFcfa: number;
  items: { productId: string; qty: number }[];
  returnId: string;
} | null>(null);

const reset = () => {
  state.items = sale.items.map((item) => ({
    productName: item.productName,
    qty: 0,
    restocked: true,
    saleItemId: item.id,
    soldQty: item.qty,
    unit: item.productUnit,
    unitPriceFcfa: item.unitPriceFcfa,
  }));
  state.reason = "";
  state.refundMethod = "credit";
  state.returnDate = toDateInputValue();
  saved.value = null;
};

watch(open, (isOpen) => {
  if (isOpen) {
    reset();
  }
});

const selected = computed(() => state.items.filter((item) => item.qty > 0));
const amountFcfa = computed(() =>
  selected.value.reduce(
    (sum, item) => sum + lineAmountFcfa(item.qty, item.unitPriceFcfa),
    0
  )
);
const remainingDueFcfa = computed(() =>
  Math.max(sale.dueFcfa - amountFcfa.value, 0)
);
const refundItems = Object.entries(RETURN_REFUND_METHOD_LABELS).map(
  ([value, label]) => ({ label, value })
);
const returnAll = () => {
  for (const item of state.items) {
    item.qty = item.soldQty;
  }
};

const mutation = useMutation($orpc.sales.return.mutationOptions());

const onSubmit = async (event: FormSubmitEvent<FormOutput>) => {
  try {
    const result = await mutation.mutateAsync({
      items: event.data.items
        .filter((item) => item.qty > 0)
        .map((item) => ({
          qty: item.qty,
          restocked: item.restocked,
          saleItemId: item.saleItemId,
        })),
      reason: event.data.reason,
      refundMethod: event.data.refundMethod,
      returnDate: fromDateInputValue(event.data.returnDate),
      saleId: sale.id,
    });
    await Promise.all([invalidateSales(), invalidateStock()]);
    notify.success(
      "Reprise enregistrée",
      `${formatFcfa(result.amountFcfa)} · ${sale.reference}`
    );
    saved.value = {
      amountFcfa: result.amountFcfa,
      items: result.items,
      returnId: result.returnId,
    };
  } catch (error) {
    notify.error("Reprise impossible", error);
  }
};

/** Raccourci : la marchandise reprise repart chez un autre client, lignes déjà remplies. */
const resell = async () => {
  const lines = (saved.value?.items ?? [])
    .map((item) => `${item.productId}:${item.qty}`)
    .join(",");
  open.value = false;
  await navigateTo(`/ventes/nouvelle?reprise=${encodeURIComponent(lines)}`);
};
</script>

<template>
  <ResponsiveModal
    v-model:open="open"
    :title="saved ? 'Reprise enregistrée' : 'Reprendre des articles'"
    :description="`${sale.reference} · ${formatFcfa(sale.dueFcfa)} restant dû`"
  >
    <template #body>
      <div v-if="saved" class="space-y-4">
        <UAlert
          color="success"
          variant="subtle"
          :icon="icons.check"
          :title="`${formatFcfa(saved.amountFcfa)} repris`"
          description="La vente est corrigée, le stock remis dans ses lots et la reprise gardée dans l'historique."
        />
        <p class="text-muted text-sm">
          Vous pouvez proposer cette marchandise à un autre client : les lignes
          seront déjà remplies dans une nouvelle vente.
        </p>
        <div class="flex flex-wrap justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            label="Fermer"
            @click="open = false"
          />
          <UButton
            :icon="icons.customerAdd"
            label="Vendre à un autre client"
            @click="resell"
          />
        </div>
      </div>

      <UForm
        v-else
        id="sale-return-form"
        :schema="formSchema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="text-muted text-sm">
            Choisissez les articles rendus et leur quantité.
          </p>
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            label="Tout reprendre"
            @click="returnAll"
          />
        </div>

        <UFormField name="items">
          <div class="border-default divide-default divide-y rounded-lg border">
            <div
              v-for="(item, index) in state.items"
              :key="item.saleItemId"
              class="flex flex-wrap items-center gap-3 p-3"
            >
              <div class="min-w-0 flex-1">
                <p class="text-highlighted truncate text-sm font-medium">
                  {{ item.productName }}
                </p>
                <p class="text-dimmed text-xs">
                  {{ formatQty(item.soldQty, item.unit) }} vendus à
                  {{ formatFcfa(item.unitPriceFcfa) }}
                </p>
              </div>
              <UInputNumber
                v-model="item.qty"
                :min="0"
                :max="item.soldQty"
                :step="0.001"
                size="sm"
                class="w-28"
                :aria-label="`Quantité reprise de ${item.productName}`"
                :name="`qty-${index}`"
              />
              <UTooltip text="Remettre la marchandise en stock">
                <USwitch v-model="item.restocked" size="sm" />
              </UTooltip>
            </div>
          </div>
        </UFormField>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Date de la reprise" name="returnDate" required>
            <DateField v-model="state.returnDate" class="w-full" />
          </UFormField>
          <UFormField label="Motif" name="reason" required>
            <UInput
              v-model="state.reason"
              placeholder="Article défectueux, erreur de commande…"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField
          label="Règlement"
          name="refundMethod"
          help="Un avoir reste sur le compte du client ; un remboursement sort de la caisse."
        >
          <URadioGroup v-model="state.refundMethod" :items="refundItems" />
        </UFormField>

        <div class="bg-elevated/50 space-y-1 rounded-lg p-3 text-sm">
          <div class="flex justify-between gap-4">
            <span class="text-muted">Montant repris</span>
            <span class="font-medium tabular-nums">{{
              formatFcfa(amountFcfa)
            }}</span>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-muted">Reste dû après reprise</span>
            <span class="tabular-nums">{{ formatFcfa(remainingDueFcfa) }}</span>
          </div>
          <div
            v-if="
              state.refundMethod === 'credit' &&
              sale.dueFcfa === 0 &&
              amountFcfa > 0
            "
            class="text-info text-xs"
          >
            Le client a déjà payé : {{ formatFcfa(amountFcfa) }} resteront en
            avoir sur son compte.
          </div>
          <div v-if="selected.length === 0" class="text-dimmed text-xs">
            Aucun article sélectionné pour l'instant.
          </div>
        </div>
      </UForm>
    </template>
    <template v-if="!saved" #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          label="Annuler"
          @click="open = false"
        />
        <UButton
          type="submit"
          form="sale-return-form"
          :icon="icons.undo"
          label="Enregistrer la reprise"
          :disabled="selected.length === 0"
          :loading="mutation.isPending.value"
        />
      </div>
    </template>
  </ResponsiveModal>
</template>
