<script setup lang="ts">
import { paymentInputSchema } from "@G-stock/api/schemas/sales";
import type { PaymentMethod } from "@G-stock/core/enums";
import { formatDate, formatFcfa } from "@G-stock/core/format";
import { PAYMENT_METHOD_LABELS } from "@G-stock/core/labels";
import type { FormSubmitEvent } from "@nuxt/ui";
import { useMutation, useQuery } from "@tanstack/vue-query";
import { z } from "zod";

/** Encaissement d'un client, rattaché ou non à une vente. */
const { customer, saleId = null } = defineProps<{
  customer: { id: string; name: string; dueFcfa: number };
  saleId?: string | null;
}>();
const open = defineModel<boolean>("open", { required: true });

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidateSales = useInvalidateSales();

const formSchema = paymentInputSchema
  .omit({ customerId: true, paymentDate: true, saleId: true })
  .extend({
    notes: z.string().max(500, "500 caractères maximum"),
    paymentDate: z.iso.date("Date invalide"),
    saleId: z.uuid().optional(),
  });
type FormOutput = z.output<typeof formSchema>;

interface PaymentFormState {
  amountFcfa: number;
  method: PaymentMethod;
  notes: string;
  paymentDate: string;
  saleId: string | undefined;
}

const state = reactive<PaymentFormState>({
  amountFcfa: 0,
  method: "cash",
  notes: "",
  paymentDate: toDateInputValue(),
  saleId: undefined,
});

// Ventes qui restent à payer, pour rattacher le paiement.
const unpaidSales = useQuery(
  computed(() => ({
    ...$orpc.sales.list.queryOptions({
      input: {
        customerId: customer.id,
        page: 1,
        pageSize: 100,
        paymentState: "due",
      },
    }),
    enabled: open.value,
  })),
);
const saleItems = computed(() =>
  (unpaidSales.data.value?.items ?? []).map((sale) => ({
    label: `${sale.reference} · ${formatDate(sale.saleDate)}`,
    suffix: `reste ${formatFcfa(sale.dueFcfa)}`,
    value: sale.id,
  })),
);
const selectedDue = computed(() => {
  const sale = unpaidSales.data.value?.items.find((item) => item.id === state.saleId);
  return sale?.dueFcfa ?? customer.dueFcfa;
});

watch(open, (isOpen) => {
  if (!isOpen) {
    return;
  }
  Object.assign(state, {
    amountFcfa: 0,
    method: "cash",
    notes: "",
    paymentDate: toDateInputValue(),
    saleId: saleId ?? undefined,
  });
});
// Propose le reste dû de la vente choisie (ou du client).
watch(
  [selectedDue, open],
  ([due, isOpen]) => {
    if (isOpen && due > 0) {
      state.amountFcfa = due;
    }
  },
  { immediate: true },
);

const methodItems = Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({
  label,
  value,
}));

const mutation = useMutation($orpc.payments.create.mutationOptions());

const onSubmit = async (event: FormSubmitEvent<FormOutput>) => {
  try {
    await mutation.mutateAsync({
      ...event.data,
      customerId: customer.id,
      notes: event.data.notes,
      paymentDate: fromDateInputValue(event.data.paymentDate),
      saleId: event.data.saleId ?? null,
    });
    await invalidateSales();
    notify.success(
      "Paiement enregistré",
      `${formatFcfa(event.data.amountFcfa)} · ${customer.name}`,
    );
    open.value = false;
  } catch (error) {
    notify.error("Paiement impossible", error);
  }
};
</script>

<template>
  <UModal
    v-model:open="open"
    title="Encaisser un paiement"
    :description="`${customer.name} · reste dû ${formatFcfa(customer.dueFcfa)}`"
  >
    <template #body>
      <UForm
        id="payment-form"
        :schema="formSchema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField
          label="Vente concernée"
          name="saleId"
          help="Sans vente choisie, le paiement solde les ventes les plus anciennes d'abord."
        >
          <USelectMenu
            v-model="state.saleId"
            :items="saleItems"
            value-key="value"
            placeholder="Ventes les plus anciennes d'abord"
            clear
            class="w-full"
          />
        </UFormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Montant (FCFA)" name="amountFcfa" required>
            <UInputNumber
              v-model="state.amountFcfa"
              :min="0"
              :step="1000"
              :format-options="{ maximumFractionDigits: 0 }"
              class="w-full"
              autofocus
            />
          </UFormField>
          <UFormField label="Date" name="paymentDate" required>
            <UInput v-model="state.paymentDate" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Moyen de paiement" name="method" class="sm:col-span-2">
            <URadioGroup v-model="state.method" :items="methodItems" orientation="horizontal" />
          </UFormField>
        </div>
        <UFormField label="Notes" name="notes">
          <UInput
            v-model="state.notes"
            placeholder="Référence mobile money, reçu…"
            class="w-full"
          />
        </UFormField>
        <p v-if="state.amountFcfa > customer.dueFcfa" class="text-info text-xs">
          Le montant dépasse ce que doit le client : l'excédent sera gardé en avoir.
        </p>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Annuler" @click="open = false" />
        <UButton
          type="submit"
          form="payment-form"
          icon="i-lucide-banknote"
          label="Enregistrer le paiement"
          :loading="mutation.isPending.value"
        />
      </div>
    </template>
  </UModal>
</template>
