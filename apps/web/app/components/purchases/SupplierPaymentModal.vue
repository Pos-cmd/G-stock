<script setup lang="ts">
import { supplierPaymentInputSchema } from "@G-stock/api/schemas/purchases";
import type { PurchaseCurrency } from "@G-stock/core/enums";
import { formatCurrency, formatFcfa } from "@G-stock/core/format";
import { FEE_CURRENCY_LABELS } from "@G-stock/core/labels";
import type { FormSubmitEvent } from "@nuxt/ui";
import { useMutation } from "@tanstack/vue-query";
import { z } from "zod";
import DateField from "~/components/common/DateField.vue";
import ResponsiveModal from "~/components/common/ResponsiveModal.vue";

const icons = useIcons();

/**
 * Versement au fournisseur : montant envoyé en FCFA, taux du jour facultatif, exprimé dans la
 * devise de la commande (RMB ou USD).
 */
const { order } = defineProps<{
  order: {
    id: string;
    reference: string;
    payment: {
      currency: PurchaseCurrency;
      orderFcfaRate: number;
      remainingAmount: number;
      remainingFcfa: number;
    };
  };
}>();
const open = defineModel<boolean>("open", { required: true });

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidatePurchases = useInvalidatePurchases();

const formSchema = supplierPaymentInputSchema.omit({ orderId: true, paymentDate: true }).extend({
  notes: z.string().max(500, "500 caractères maximum"),
  paymentDate: z.iso.date("Date invalide"),
});
type FormOutput = z.output<typeof formSchema>;

interface SupplierPaymentFormState {
  amountFcfa: number;
  fcfaRate: number | null;
  notes: string;
  paymentDate: string;
}

const state = reactive<SupplierPaymentFormState>({
  amountFcfa: 0,
  fcfaRate: null,
  notes: "",
  paymentDate: toDateInputValue(),
});

watch(open, (isOpen) => {
  if (isOpen) {
    Object.assign(state, {
      amountFcfa: 0,
      fcfaRate: null,
      notes: "",
      paymentDate: toDateInputValue(),
    });
  }
});

const rateFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 2,
});
const currency = computed(() => order.payment.currency);
const formatAmount = (amount: number) => formatCurrency(amount, currency.value);
const effectiveRate = computed(() => state.fcfaRate || order.payment.orderFcfaRate);
const convertedAmount = computed(() =>
  state.amountFcfa > 0 ? state.amountFcfa / effectiveRate.value : 0,
);
const remainingAfter = computed(() => order.payment.remainingAmount - convertedAmount.value);

/** Montant qui solde la commande au taux saisi. */
const fillRemaining = () => {
  state.amountFcfa = Math.ceil(order.payment.remainingAmount * effectiveRate.value);
};

const mutation = useMutation($orpc.purchases.addPayment.mutationOptions());

const onSubmit = async (event: FormSubmitEvent<FormOutput>) => {
  try {
    await mutation.mutateAsync({
      ...event.data,
      fcfaRate: event.data.fcfaRate ?? null,
      orderId: order.id,
      paymentDate: fromDateInputValue(event.data.paymentDate),
    });
    await invalidatePurchases();
    notify.success(
      "Versement enregistré",
      `${formatFcfa(event.data.amountFcfa)} · ${order.reference}`,
    );
    open.value = false;
  } catch (error) {
    notify.error("Versement impossible", error);
  }
};
</script>

<template>
  <ResponsiveModal
    v-model:open="open"
    title="Versement au fournisseur"
    :description="`${order.reference} · reste ${formatAmount(order.payment.remainingAmount)}`"
  >
    <template #body>
      <UForm
        id="supplier-payment-form"
        :schema="formSchema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Montant envoyé" name="amountFcfa" required>
            <UInputNumber
              v-model="state.amountFcfa"
              :min="0"
              :step="100000"
              :increment="false"
              :decrement="false"
              :format-options="FCFA_FORMAT"
              class="w-full"
              autofocus
            />
          </UFormField>
          <UFormField label="Date" name="paymentDate" required>
            <DateField v-model="state.paymentDate" class="w-full" />
          </UFormField>
          <UFormField
            :label="`Taux du jour (FCFA pour 1 ${FEE_CURRENCY_LABELS[currency]})`"
            name="fcfaRate"
            :help="`Vide : taux de la commande, ${rateFormatter.format(order.payment.orderFcfaRate)}.`"
            class="sm:col-span-2"
          >
            <UInputNumber
              :model-value="state.fcfaRate ?? undefined"
              :min="0"
              :step="0.5"
              :increment="false"
              :decrement="false"
              :format-options="FCFA_RATE_FORMAT"
              :placeholder="rateFormatter.format(order.payment.orderFcfaRate)"
              class="w-full"
              @update:model-value="state.fcfaRate = $event || null"
            />
          </UFormField>
        </div>

        <div class="bg-elevated/50 space-y-1 rounded-lg px-3 py-2 text-sm">
          <div class="flex justify-between gap-4">
            <span class="text-muted">Payé au fournisseur</span>
            <strong class="text-highlighted tabular-nums">{{
              formatAmount(convertedAmount)
            }}</strong>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-muted">Reste ensuite</span>
            <span
              class="tabular-nums"
              :class="remainingAfter < -0.01 ? 'text-warning' : 'text-highlighted'"
            >
              {{ formatAmount(Math.max(remainingAfter, 0)) }}
            </span>
          </div>
          <p v-if="remainingAfter < -0.01" class="text-warning text-xs">
            Dépasse le prix de la marchandise de
            {{ formatAmount(-remainingAfter) }} : l'excédent reste une avance chez le fournisseur.
          </p>
          <UButton
            v-else-if="order.payment.remainingAmount > 0"
            label="Solder la commande à ce taux"
            :icon="icons.payInFull"
            size="xs"
            color="neutral"
            variant="link"
            class="px-0"
            @click="fillRemaining"
          />
        </div>

        <UFormField label="Notes" name="notes">
          <UInput
            v-model="state.notes"
            placeholder="Agent de change, référence du transfert…"
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
          form="supplier-payment-form"
          :icon="icons.supplierPayment"
          label="Enregistrer le versement"
          :loading="mutation.isPending.value"
        />
      </div>
    </template>
  </ResponsiveModal>
</template>
