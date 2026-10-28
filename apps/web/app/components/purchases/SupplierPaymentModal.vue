<script setup lang="ts">
import { supplierPaymentInputSchema } from "@G-stock/api/schemas/purchases";
import { formatFcfa, formatRmb } from "@G-stock/core/format";
import type { FormSubmitEvent } from "@nuxt/ui";
import { useMutation } from "@tanstack/vue-query";
import { z } from "zod";
import ResponsiveModal from "~/components/common/ResponsiveModal.vue";

const icons = useIcons();

/** Versement au fournisseur : montant envoyé en FCFA, taux du jour facultatif. */
const { order } = defineProps<{
  order: {
    id: string;
    reference: string;
    payment: {
      orderFcfaPerRmb: number;
      remainingRmb: number;
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
  fcfaPerRmb: number | null;
  notes: string;
  paymentDate: string;
}

const state = reactive<SupplierPaymentFormState>({
  amountFcfa: 0,
  fcfaPerRmb: null,
  notes: "",
  paymentDate: toDateInputValue(),
});

watch(open, (isOpen) => {
  if (isOpen) {
    Object.assign(state, {
      amountFcfa: 0,
      fcfaPerRmb: null,
      notes: "",
      paymentDate: toDateInputValue(),
    });
  }
});

const rateFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 2,
});
const effectiveRate = computed(() => state.fcfaPerRmb || order.payment.orderFcfaPerRmb);
const convertedRmb = computed(() =>
  state.amountFcfa > 0 ? state.amountFcfa / effectiveRate.value : 0,
);
const remainingAfter = computed(() => order.payment.remainingRmb - convertedRmb.value);

/** Montant qui solde la commande au taux saisi. */
const fillRemaining = () => {
  state.amountFcfa = Math.ceil(order.payment.remainingRmb * effectiveRate.value);
};

const mutation = useMutation($orpc.purchases.addPayment.mutationOptions());

const onSubmit = async (event: FormSubmitEvent<FormOutput>) => {
  try {
    await mutation.mutateAsync({
      ...event.data,
      fcfaPerRmb: event.data.fcfaPerRmb ?? null,
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
    :description="`${order.reference} · reste ${formatRmb(order.payment.remainingRmb)}`"
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
          <UFormField label="Montant envoyé (FCFA)" name="amountFcfa" required>
            <UInputNumber
              v-model="state.amountFcfa"
              :min="0"
              :step="100000"
              :increment="false"
              :decrement="false"
              :format-options="{ maximumFractionDigits: 0 }"
              class="w-full"
              autofocus
            />
          </UFormField>
          <UFormField label="Date" name="paymentDate" required>
            <UInput v-model="state.paymentDate" type="date" class="w-full" />
          </UFormField>
          <UFormField
            label="Taux du jour (FCFA pour 1 RMB)"
            name="fcfaPerRmb"
            :help="`Vide : taux de la commande, ${rateFormatter.format(order.payment.orderFcfaPerRmb)}.`"
            class="sm:col-span-2"
          >
            <UInputNumber
              :model-value="state.fcfaPerRmb ?? undefined"
              :min="0"
              :step="0.5"
              :increment="false"
              :decrement="false"
              :format-options="{ maximumFractionDigits: 4 }"
              :placeholder="rateFormatter.format(order.payment.orderFcfaPerRmb)"
              class="w-full"
              @update:model-value="state.fcfaPerRmb = $event || null"
            />
          </UFormField>
        </div>

        <div class="bg-elevated/50 space-y-1 rounded-lg px-3 py-2 text-sm">
          <div class="flex justify-between gap-4">
            <span class="text-muted">Payé au fournisseur</span>
            <strong class="text-highlighted tabular-nums">{{ formatRmb(convertedRmb) }}</strong>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-muted">Reste ensuite</span>
            <span
              class="tabular-nums"
              :class="remainingAfter < -0.01 ? 'text-warning' : 'text-highlighted'"
            >
              {{ formatRmb(Math.max(remainingAfter, 0)) }}
            </span>
          </div>
          <p v-if="remainingAfter < -0.01" class="text-warning text-xs">
            Dépasse le prix de la marchandise de
            {{ formatRmb(-remainingAfter) }} : l'excédent reste une avance chez le fournisseur.
          </p>
          <UButton
            v-else-if="order.payment.remainingRmb > 0"
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
