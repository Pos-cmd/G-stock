<script setup lang="ts">
import { purchaseReceptionSchema } from "@G-stock/api/schemas/purchases";
import type { AllocationMethod, FeeCurrency } from "@G-stock/core/enums";
import { formatFcfa, formatQty } from "@G-stock/core/format";
import { uuidv7 } from "@G-stock/core/ids";
import {
  ALLOCATION_METHOD_LABELS,
  FEE_CURRENCY_LABELS,
  SUGGESTED_FEE_LABELS,
} from "@G-stock/core/labels";
import {
  computeLandedCostsFromFees,
  feeToFcfa,
  totalGoodsAmount,
} from "@G-stock/core/purchasing";
import { paidGoodsFcfa } from "@G-stock/core/supplier-payments";
import type { FormSubmitEvent } from "@nuxt/ui";
import { useMutation, useQuery } from "@tanstack/vue-query";
import { z } from "zod";

import ConfirmDialog from "~/components/common/ConfirmDialog.vue";
import DateField from "~/components/common/DateField.vue";
import PagePanel from "~/components/layout/PagePanel.vue";
import PurchaseCostSummary from "~/components/purchases/PurchaseCostSummary.vue";
import type { PurchaseOrderDetail } from "~/types/api";

const icons = useIcons();

const route = useRoute();
const orderId = computed(() => String(route.params.id));

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidateStock = useInvalidateStock();
const invalidatePurchases = useInvalidatePurchases();

const order = useQuery(
  computed(() =>
    $orpc.purchases.get.queryOptions({ input: { id: orderId.value } })
  )
);
const data = computed(() => order.data.value);

/** Commande déjà réceptionnée : la page sert à corriger, avec un motif et une trace. */
const isCorrection = computed(() => data.value?.status === "received");
const isCancelled = computed(() => data.value?.status === "cancelled");

useHead({
  title: () =>
    data.value
      ? `${isCorrection.value ? "Correction" : "Réception"} ${data.value.reference}`
      : "Réception",
});

const formSchema = purchaseReceptionSchema
  .omit({ arrivedAt: true, id: true })
  .extend({
    arrivedAt: z.union([z.literal(""), z.iso.date("Date invalide")]),
    /* Motif de la correction : obligatoire seulement quand la commande est déjà reçue. */
    reason: z.string().trim().max(500, "500 caractères maximum"),
    receivedAt: z.iso.date("Indiquez la date d'entrée en stock"),
  })
  .superRefine((value, ctx) => {
    if (isCorrection.value && value.reason.length < 3) {
      ctx.addIssue({
        code: "custom",
        message: "Indiquez le motif de la correction (3 caractères minimum)",
        path: ["reason"],
      });
    }
  });
type FormOutput = z.output<typeof formSchema>;

interface FeeLine {
  key: string;
  label: string;
  amount: number;
  currency: FeeCurrency;
  allocationMethod: AllocationMethod;
}

interface ReceptionState {
  arrivedAt: string;
  receivedAt: string;
  containerNumber: string;
  billOfLading: string;
  forwarder: string;
  fees: FeeLine[];
  items: { id: string; qtyReceived: number }[];
  reason: string;
}

const feeLine = (
  fee: Partial<Omit<FeeLine, "key">> & { allocationMethod: AllocationMethod }
): FeeLine => ({
  amount: 0,
  currency: "fcfa",
  key: uuidv7(),
  label: "",
  ...fee,
});

/** Première saisie : l'estimation de la commande, plus une ligne Douane à compléter. */
const defaultFees = (source: PurchaseOrderDetail): FeeLine[] => {
  const { allocationMethod } = source;
  return [
    ...(source.estimate.freightFcfa > 0
      ? [
          feeLine({
            allocationMethod,
            amount: source.estimate.freightFcfa,
            label: "Fret maritime",
          }),
        ]
      : []),
    feeLine({ allocationMethod, label: "Douane" }),
    ...(source.localTransportFcfa > 0
      ? [
          feeLine({
            allocationMethod,
            amount: source.localTransportFcfa,
            label: "Transport local",
          }),
        ]
      : []),
    ...(source.otherFeesFcfa > 0
      ? [
          feeLine({
            allocationMethod,
            amount: source.otherFeesFcfa,
            label: "Autres frais",
          }),
        ]
      : []),
  ];
};

/** Aujourd'hui, ou le jour de la commande quand elle est plus ancienne. */
const defaultReceptionDate = (orderDate: Date | string): string => {
  const today = toDateInputValue();
  const orderDay = toDateInputValue(new Date(orderDate));
  return orderDay < today ? orderDay : today;
};

const stateFrom = (source: PurchaseOrderDetail): ReceptionState => ({
  arrivedAt: source.arrivedAt
    ? toDateInputValue(new Date(source.arrivedAt))
    : "",
  billOfLading: source.billOfLading ?? "",
  containerNumber: source.containerNumber ?? "",
  fees:
    source.fees.length > 0
      ? source.fees.map((fee) =>
          feeLine({
            allocationMethod: fee.allocationMethod,
            amount: fee.amount,
            currency: fee.currency,
            label: fee.label,
          })
        )
      : defaultFees(source),
  forwarder: source.forwarder ?? "",
  items: source.items.map((item) => ({
    id: item.id,
    qtyReceived: item.qtyReceived ?? item.qty,
  })),
  // Une commande antidatée est reçue le jour de sa commande, pas aujourd'hui : proposer cette
  // date évite d'enregistrer l'entrée en stock au jour de la saisie.
  reason: "",
  receivedAt:
    source.status === "received" && source.receivedAt
      ? toDateInputValue(new Date(source.receivedAt))
      : defaultReceptionDate(source.orderDate),
});

const state = reactive<ReceptionState>({
  arrivedAt: "",
  billOfLading: "",
  containerNumber: "",
  fees: [],
  forwarder: "",
  items: [],
  reason: "",
  receivedAt: toDateInputValue(),
});

// Initialisé une seule fois : un rafraîchissement après enregistrement ne touche pas à la saisie.
const initialized = ref(false);
watch(
  data,
  (source) => {
    if (source && !initialized.value) {
      Object.assign(state, stateFrom(source));
      receivedAtTouched.value = false;
      initialized.value = true;
    }
  },
  { immediate: true }
);

/** Entrée en stock antérieure à la commande : inhabituel, on le signale sans bloquer. */
const receptionBeforeOrder = computed(() => {
  const orderDay = data.value
    ? toDateInputValue(new Date(data.value.orderDate))
    : null;
  return Boolean(orderDay && state.receivedAt && state.receivedAt < orderDay);
});

/**
 * Tant que la date d'entrée en stock n'a pas été saisie à la main, elle suit l'arrivée au port :
 * la marchandise entre en stock le jour où elle arrive, pas le jour de la saisie.
 */
const receivedAtTouched = ref(false);
watch(
  () => state.arrivedAt,
  (arrivedAt) => {
    const today = toDateInputValue();
    if (!receivedAtTouched.value && arrivedAt && arrivedAt <= today) {
      state.receivedAt = arrivedAt;
    }
  }
);

// Listes de choix
const currencyItems = Object.entries(FEE_CURRENCY_LABELS).map(
  ([value, label]) => ({
    label,
    value,
  })
);
const allocationItems = Object.entries(ALLOCATION_METHOD_LABELS).map(
  ([value, label]) => ({
    label,
    value,
  })
);
const feeLabelItems: string[] = [...SUGGESTED_FEE_LABELS];
const missingSuggestions = computed(() =>
  SUGGESTED_FEE_LABELS.filter(
    (label) => !state.fees.some((fee) => fee.label === label)
  )
);

const addFee = (label = "") => {
  state.fees.push(
    feeLine({
      allocationMethod: data.value?.allocationMethod ?? "equal",
      label,
    })
  );
};
const removeFee = (key: string) => {
  state.fees = state.fees.filter((fee) => fee.key !== key);
};

// Calcul en direct, avec la même fonction que le serveur.
const rates = computed(() => ({
  fcfaPerUsd: data.value?.fcfaPerUsd ?? 1,
  rmbPerUsd: data.value?.rmbPerUsd ?? 1,
}));
const feeAmountsFcfa = computed(() =>
  state.fees.map((fee) => feeToFcfa(fee.amount || 0, fee.currency, rates.value))
);
const activePayments = computed(() =>
  (data.value?.payments ?? []).filter((payment) => !payment.cancelledAt)
);
const costs = computed(() => {
  const items = (data.value?.items ?? []).map((item, index) => ({
    ...item,
    receivedQty: state.items[index]?.qtyReceived ?? item.qty,
  }));
  const currency = data.value?.currency ?? "rmb";
  return computeLandedCostsFromFees({
    currency,
    fees: state.fees.map((fee, index) => ({
      allocationMethod: fee.allocationMethod,
      amountFcfa: feeAmountsFcfa.value[index] ?? 0,
    })),
    goodsFcfa: paidGoodsFcfa({
      currency,
      goodsAmount: totalGoodsAmount(items),
      payments: activePayments.value,
      rates: rates.value,
    }),
    items,
    rates: rates.value,
  });
});
const feeLines = computed(() =>
  receptionFeeLines(
    state.fees.map((fee, index) => ({
      ...fee,
      amountFcfa: feeAmountsFcfa.value[index] ?? 0,
    }))
  )
);

const missingWeight = computed(
  () =>
    state.fees.some((fee) => fee.allocationMethod === "weight") &&
    (data.value?.items ?? []).some((item) => !item.weightTons)
);

const receivedLines = computed(() =>
  (data.value?.items ?? []).flatMap((item, index) => {
    const qtyReceived = state.items[index]?.qtyReceived ?? 0;
    const unitCostFcfa = costs.value.lines[index]?.unitCostFcfa ?? 0;
    return qtyReceived > 0 ? [{ item, qtyReceived, unitCostFcfa }] : [];
  })
);
const stockValueFcfa = computed(() =>
  receivedLines.value.reduce(
    (sum, line) => sum + line.qtyReceived * line.unitCostFcfa,
    0
  )
);

// Enregistrement et validation
const intent = ref<"save" | "receive">("save");
const confirmOpen = ref(false);
const pendingReceivedAt = ref<Date | null>(null);

const saveMutation = useMutation(
  $orpc.purchases.saveReception.mutationOptions()
);
const receiveMutation = useMutation($orpc.purchases.receive.mutationOptions());
const correctMutation = useMutation($orpc.purchases.correct.mutationOptions());

const receptionInput = (formData: FormOutput) => {
  const {
    arrivedAt,
    receivedAt: _receivedAt,
    reason: _reason,
    ...rest
  } = formData;
  return {
    ...rest,
    arrivedAt: arrivedAt ? fromDateInputValue(arrivedAt) : null,
    id: orderId.value,
  };
};
const lastInput = ref<ReturnType<typeof receptionInput> | null>(null);

const onSubmit = async (event: FormSubmitEvent<FormOutput>) => {
  const input = receptionInput(event.data);
  const receivedAt = fromDateInputValue(event.data.receivedAt);
  if (isCorrection.value) {
    try {
      const result = await correctMutation.mutateAsync({
        ...input,
        reason: event.data.reason,
        receivedAt,
      });
      await Promise.all([invalidateStock(), invalidatePurchases()]);
      notify.success(
        "Réception corrigée",
        `${result.lotCount} lot${result.lotCount > 1 ? "s" : ""} mis à jour · revient à ${formatFcfa(result.totalFcfa)}`
      );
      await navigateTo(`/achats/${orderId.value}`);
    } catch (error) {
      notify.error("Correction impossible", error);
    }
    return;
  }
  if (intent.value === "receive") {
    lastInput.value = input;
    pendingReceivedAt.value = receivedAt;
    confirmOpen.value = true;
    return;
  }
  try {
    await saveMutation.mutateAsync(input);
    await invalidatePurchases();
    notify.success(
      "Réception enregistrée",
      "Le stock n'a pas encore été mis à jour."
    );
  } catch (error) {
    notify.error("Enregistrement impossible", error);
  }
};

const confirmReceive = async () => {
  if (!lastInput.value || !pendingReceivedAt.value) {
    return;
  }
  try {
    const result = await receiveMutation.mutateAsync({
      ...lastInput.value,
      receivedAt: pendingReceivedAt.value,
    });
    await Promise.all([invalidateStock(), invalidatePurchases()]);
    confirmOpen.value = false;
    notify.success(
      "Marchandise réceptionnée",
      `${result.lotCount} lot${result.lotCount > 1 ? "s" : ""} ajouté${result.lotCount > 1 ? "s" : ""} au stock`
    );
    await navigateTo(`/achats/${orderId.value}`);
  } catch (error) {
    notify.error("Réception impossible", error);
  }
};

const confirmDescription = computed(
  () =>
    `${receivedLines.value.length} lot${receivedLines.value.length > 1 ? "s" : ""} pour une valeur de ${formatFcfa(stockValueFcfa.value)}. La commande sera ensuite verrouillée ; les écarts se corrigeront par un ajustement de lot.`
);
</script>

<template>
  <PagePanel
    id="purchase-reception"
    :title="isCorrection ? 'Corriger la réception' : 'Réception'"
    :description="
      data
        ? `${data.reference} · ${data.supplier?.name ?? 'Sans fournisseur'}`
        : undefined
    "
    :icon="icons.reception"
    :parents="[
      { label: 'Commandes', to: '/achats' },
      { label: data?.reference ?? 'Commande', to: `/achats/${orderId}` },
    ]"
  >
    <template #actions>
      <template v-if="data && !isCancelled">
        <template v-if="isCorrection">
          <UButton
            type="submit"
            form="reception-form"
            :icon="icons.save"
            label="Enregistrer la correction"
            :loading="correctMutation.isPending.value"
          />
        </template>
        <template v-else>
          <UButton
            type="submit"
            form="reception-form"
            color="neutral"
            variant="outline"
            :icon="icons.save"
            label="Enregistrer"
            :loading="saveMutation.isPending.value"
            @click="intent = 'save'"
          />
          <UButton
            type="submit"
            form="reception-form"
            color="success"
            :icon="icons.reception"
            label="Valider la réception"
            @click="intent = 'receive'"
          />
        </template>
      </template>
    </template>

    <UAlert
      v-if="order.isError.value"
      color="error"
      variant="subtle"
      :icon="icons.error"
      title="Commande introuvable"
      :description="order.error.value?.message"
    />

    <UAlert
      v-else-if="isCancelled"
      color="neutral"
      variant="subtle"
      :icon="icons.locked"
      title="Commande annulée"
      description="Cette commande ne peut plus être réceptionnée ni corrigée."
      :actions="[{ label: 'Voir la commande', to: `/achats/${orderId}` }]"
    />

    <UForm
      v-else-if="data && initialized"
      id="reception-form"
      :schema="formSchema"
      :state="state"
      class="space-y-6"
      @submit="onSubmit"
    >
      <UAlert
        v-if="isCorrection"
        color="warning"
        variant="subtle"
        :icon="icons.stockAdjust"
        title="Correction d'une commande réceptionnée"
        description="Les lots et les mouvements d'entrée prennent le nouveau coût de revient et la nouvelle date. Les ventes déjà enregistrées gardent le coût qu'elles ont figé : leur marge ne bouge pas."
      >
        <template #actions>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            :label="`Journal (${data.revisions.length})`"
            :to="`/achats/${orderId}`"
          />
        </template>
      </UAlert>
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <UPageCard variant="subtle" title="Arrivée" class="lg:self-start">
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <UFormField
              v-if="isCorrection"
              label="Motif de la correction"
              name="reason"
              required
              class="sm:col-span-2 xl:col-span-3"
            >
              <UInput
                v-model="state.reason"
                placeholder="Frais de douane erronés, date de saisie au lieu de la date réelle…"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Arrivée au port" name="arrivedAt">
              <DateField v-model="state.arrivedAt" class="w-full" />
            </UFormField>
            <UFormField
              label="Entrée en stock"
              name="receivedAt"
              required
              help="C'est cette date que verront les lots et les mouvements de stock. Elle suit l'arrivée au port tant que vous ne la corrigez pas."
            >
              <DateField
                v-model="state.receivedAt"
                class="w-full"
                @update:model-value="receivedAtTouched = true"
              />
            </UFormField>
            <UFormField label="N° conteneur" name="containerNumber">
              <UInput
                v-model="state.containerNumber"
                placeholder="MSCU1234567"
                class="w-full"
              />
            </UFormField>
            <UFormField label="N° BL" name="billOfLading">
              <UInput
                v-model="state.billOfLading"
                placeholder="Connaissement"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Transitaire" name="forwarder">
              <UInput
                v-model="state.forwarder"
                placeholder="Agent de dédouanement"
                class="w-full"
              />
            </UFormField>
          </div>
          <UAlert
            v-if="receptionBeforeOrder"
            class="mt-4"
            color="warning"
            variant="subtle"
            :icon="icons.pending"
            title="Entrée en stock avant la commande"
            description="Les mouvements de stock et les lots porteront cette date. Vérifiez que ce n'est pas le jour de la saisie."
          />
        </UPageCard>

        <PurchaseCostSummary
          title="Prix de revient réel"
          :costs="costs"
          :fee-lines="feeLines"
          :goods-hint="activePayments.length > 0 ? PAID_GOODS_HINT : null"
          :estimate-total-fcfa="data.estimate.totalFcfa"
          class="lg:self-start"
        />
      </div>

      <UPageCard
        variant="subtle"
        title="Frais réels"
        :ui="{
          container: 'lg:grid-cols-[minmax(0,1fr)]',
          wrapper: 'min-w-0',
        }"
      >
        <template #description>
          Ils remplacent l'estimation de la commande. Un frais payé en USD ou en
          RMB est converti aux taux de la commande ({{ data.rmbPerUsd }} RMB = 1
          $ = {{ data.fcfaPerUsd }} FCFA).
        </template>

        <UAlert
          v-if="missingWeight"
          color="warning"
          variant="subtle"
          :icon="icons.warning"
          description="Un frais est réparti au poids, mais certaines lignes de la commande n'ont pas de poids. Complétez la commande ou choisissez une autre répartition."
        />

        <UFormField name="fees">
          <div class="border-default overflow-x-auto rounded-lg border">
            <table class="w-full min-w-[46rem] text-sm">
              <thead
                class="bg-muted text-muted text-left font-mono text-[11px] tracking-[0.06em] uppercase"
              >
                <tr>
                  <th class="px-3 py-2 font-medium">Frais</th>
                  <th class="w-36 px-3 py-2 font-medium">Montant</th>
                  <th class="w-24 px-3 py-2 font-medium">Devise</th>
                  <th class="w-52 px-3 py-2 font-medium">Répartition</th>
                  <th class="px-3 py-2 text-right font-medium">En FCFA</th>
                  <th class="w-10" />
                </tr>
              </thead>
              <tbody class="divide-default divide-y">
                <tr
                  v-for="(fee, index) in state.fees"
                  :key="fee.key"
                  class="align-top"
                >
                  <td class="px-3 py-2">
                    <UFormField :name="`fees.${index}.label`">
                      <UInputMenu
                        v-model="fee.label"
                        mode="autocomplete"
                        :items="feeLabelItems"
                        placeholder="Douane, fret…"
                        class="w-full min-w-40"
                      />
                    </UFormField>
                  </td>
                  <td class="px-3 py-2">
                    <UFormField :name="`fees.${index}.amount`">
                      <UInputNumber
                        v-model="fee.amount"
                        :min="0"
                        :format-options="feeAmountFormat(fee.currency)"
                        :increment="false"
                        :decrement="false"
                        class="w-full"
                      />
                    </UFormField>
                  </td>
                  <td class="px-3 py-2">
                    <USelect
                      v-model="fee.currency"
                      :items="currencyItems"
                      :aria-label="`Devise du frais ${index + 1}`"
                      class="w-full"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <USelect
                      v-model="fee.allocationMethod"
                      :items="allocationItems"
                      :aria-label="`Répartition du frais ${index + 1}`"
                      class="w-full"
                    />
                  </td>
                  <td
                    class="px-3 py-3 text-right font-medium whitespace-nowrap tabular-nums"
                  >
                    {{ formatFcfa(feeAmountsFcfa[index] ?? 0) }}
                  </td>
                  <td class="px-1 py-2">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      :icon="icons.trash"
                      :aria-label="`Retirer le frais ${index + 1}`"
                      @click="removeFee(fee.key)"
                    />
                  </td>
                </tr>
                <tr v-if="state.fees.length === 0">
                  <td colspan="6" class="text-muted px-3 py-6 text-center">
                    Aucun frais : le prix de revient sera le seul prix de la
                    marchandise.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UFormField>

        <div class="flex flex-wrap items-center gap-2">
          <UButton
            variant="soft"
            :icon="icons.plus"
            label="Ajouter un frais"
            @click="addFee()"
          />
          <UButton
            v-for="label in missingSuggestions"
            :key="label"
            color="neutral"
            variant="ghost"
            size="sm"
            :icon="icons.plus"
            :label="label"
            @click="addFee(label)"
          />
        </div>
      </UPageCard>

      <UPageCard
        variant="subtle"
        title="Quantités reçues"
        :ui="{ container: 'lg:grid-cols-[minmax(0,1fr)]', wrapper: 'min-w-0' }"
      >
        <template #description>
          En cas de manquant ou de casse, le coût de la ligne est réparti sur la
          quantité reçue. Une ligne à 0 ne crée pas de lot.
        </template>

        <div class="border-default overflow-x-auto rounded-lg border">
          <table class="w-full min-w-[52rem] text-sm">
            <thead
              class="bg-muted text-muted text-left font-mono text-[11px] tracking-[0.06em] uppercase"
            >
              <tr>
                <th class="px-3 py-2 font-medium">Produit</th>
                <th class="px-3 py-2 text-right font-medium">Commandé</th>
                <th class="w-36 px-3 py-2 font-medium">Reçu</th>
                <th class="px-3 py-2 text-right font-medium">Part des frais</th>
                <th class="px-3 py-2 text-right font-medium">Coût unitaire</th>
                <th class="px-3 py-2 text-right font-medium">
                  Valeur en stock
                </th>
              </tr>
            </thead>
            <tbody class="divide-default divide-y">
              <tr
                v-for="(item, index) in data.items"
                :key="item.id"
                class="align-top"
              >
                <td class="text-highlighted px-3 py-3 font-medium">
                  {{ item.productName }}
                </td>
                <td class="px-3 py-3 text-right tabular-nums">
                  {{ formatQty(item.qty, item.productUnit) }}
                  <p v-if="item.weightTons" class="text-dimmed text-xs">
                    {{ formatQty(item.weightTons, "T") }}
                  </p>
                </td>
                <td class="px-3 py-2">
                  <UFormField
                    v-if="state.items[index]"
                    :name="`items.${index}.qtyReceived`"
                  >
                    <UInputNumber
                      v-model="state.items[index].qtyReceived"
                      :min="0"
                      :format-options="QUANTITY_FORMAT"
                      class="w-full"
                    />
                  </UFormField>
                  <p
                    v-if="
                      state.items[index] &&
                      state.items[index].qtyReceived !== item.qty
                    "
                    class="text-warning mt-1 text-xs tabular-nums"
                  >
                    écart
                    {{ formatQty(state.items[index].qtyReceived - item.qty) }}
                  </p>
                </td>
                <td class="text-muted px-3 py-3 text-right tabular-nums">
                  {{ formatFcfa(costs.lines[index]?.transportShareFcfa ?? 0) }}
                </td>
                <td class="px-3 py-3 text-right tabular-nums">
                  <span class="text-highlighted font-semibold">
                    {{ formatFcfa(costs.lines[index]?.unitCostFcfa ?? 0) }}
                  </span>
                  <p class="text-dimmed text-xs">
                    estimé {{ formatFcfa(item.unitCostFcfa) }}
                  </p>
                </td>
                <td class="px-3 py-3 text-right font-medium tabular-nums">
                  {{
                    formatFcfa(
                      (state.items[index]?.qtyReceived ?? 0) *
                        (costs.lines[index]?.unitCostFcfa ?? 0)
                    )
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UPageCard>
    </UForm>

    <ConfirmDialog
      v-model:open="confirmOpen"
      title="Valider la réception ?"
      :description="confirmDescription"
      confirm-label="Mettre en stock"
      confirm-color="success"
      :loading="receiveMutation.isPending.value"
      @confirm="confirmReceive"
    />
  </PagePanel>
</template>
