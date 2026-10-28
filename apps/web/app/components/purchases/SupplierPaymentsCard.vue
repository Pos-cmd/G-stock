<script setup lang="ts">
import { formatDate, formatFcfa, formatRmb } from "@G-stock/core/format";
import { useMutation } from "@tanstack/vue-query";

import ReasonDialog from "~/components/common/ReasonDialog.vue";
import SupplierPaymentModal from "~/components/purchases/SupplierPaymentModal.vue";
import type { PurchaseOrderDetail } from "~/types/api";

const icons = useIcons();

/** Versements au fournisseur d'une commande : ce qui est payé, à quel taux, ce qui reste. */
const { order } = defineProps<{ order: PurchaseOrderDetail }>();

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidatePurchases = useInvalidatePurchases();

const addOpen = ref(false);
const cancelling = ref<PurchaseOrderDetail["payments"][number] | null>(null);
const cancelOpen = computed({
  get: () => cancelling.value !== null,
  set: (value) => {
    if (!value) {
      cancelling.value = null;
    }
  },
});

const rateFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 2,
});
const percentFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
  style: "percent",
});

const payment = computed(() => order.payment);
const paidRatio = computed(() =>
  payment.value.goodsRmb > 0 ? Math.min(payment.value.paidRmb / payment.value.goodsRmb, 1) : 0,
);
const canPay = computed(() => order.status !== "cancelled");
const exchange = computed(() => payment.value.exchangeDifferenceFcfa);

const rmbOf = (entry: PurchaseOrderDetail["payments"][number]) =>
  entry.amountFcfa / (entry.fcfaPerRmb ?? payment.value.orderFcfaPerRmb);

const cancelMutation = useMutation($orpc.purchases.cancelPayment.mutationOptions());
const confirmCancel = async (reason: string) => {
  if (!cancelling.value) {
    return;
  }
  try {
    await cancelMutation.mutateAsync({ id: cancelling.value.id, reason });
    await invalidatePurchases();
    notify.success("Versement annulé", formatFcfa(cancelling.value.amountFcfa));
    cancelling.value = null;
  } catch (error) {
    notify.error("Annulation impossible", error);
  }
};
</script>

<template>
  <UPageCard
    variant="subtle"
    description="Chaque versement est noté en FCFA avec le taux obtenu ce jour-là : le prix de revient suit le coût réel de la marchandise."
  >
    <template #title>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span class="flex items-center gap-2">
          <UIcon :name="icons.supplierPayment" class="text-primary size-5" />
          Paiements au fournisseur
        </span>
        <UButton
          v-if="canPay"
          :icon="icons.plus"
          label="Ajouter un versement"
          color="neutral"
          variant="outline"
          @click="addOpen = true"
        />
      </div>
    </template>

    <div class="space-y-4">
      <div class="grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <p class="text-muted">Payé</p>
          <p class="text-highlighted text-base font-semibold tabular-nums">
            {{ formatRmb(payment.paidRmb) }}
          </p>
          <p class="text-dimmed text-xs tabular-nums">
            {{ formatFcfa(payment.paidFcfa) }}
            <template v-if="payment.averageFcfaPerRmb">
              · {{ rateFormatter.format(payment.averageFcfaPerRmb) }} FCFA/RMB en moyenne
            </template>
          </p>
        </div>
        <div>
          <p class="text-muted">Reste à payer</p>
          <p
            class="text-base font-semibold tabular-nums"
            :class="payment.isPaid ? 'text-success' : 'text-warning'"
          >
            {{ payment.isPaid ? "Soldée" : formatRmb(payment.remainingRmb) }}
          </p>
          <p v-if="!payment.isPaid" class="text-dimmed text-xs tabular-nums">
            ≈ {{ formatFcfa(payment.remainingFcfa) }} au taux de la commande ({{
              rateFormatter.format(payment.orderFcfaPerRmb)
            }})
          </p>
          <p v-else-if="payment.overpaidRmb > 0" class="text-info text-xs tabular-nums">
            Avance de {{ formatRmb(payment.overpaidRmb) }} chez le fournisseur
          </p>
        </div>
        <div>
          <p class="text-muted">Marchandise</p>
          <p class="text-highlighted text-base font-semibold tabular-nums">
            {{ formatRmb(payment.goodsRmb) }}
          </p>
          <p class="text-dimmed text-xs tabular-nums">
            Coût réel : {{ formatFcfa(payment.goodsFcfa) }}
          </p>
        </div>
      </div>

      <UProgress
        :model-value="paidRatio * 100"
        :color="payment.isPaid ? 'success' : 'primary'"
        size="sm"
        :aria-label="`Payé à ${percentFormatter.format(paidRatio)}`"
      />

      <UAlert
        v-if="exchange"
        :color="exchange > 0 ? 'warning' : 'success'"
        variant="subtle"
        :icon="icons.exchangeRate"
        :title="`${exchange > 0 ? 'Perte' : 'Gain'} de change : ${formatFcfa(Math.abs(exchange))}`"
        :description="`Les lots ont été valorisés à la réception avec ${formatFcfa(order.costs.goodsFcfa)} de marchandise ; avec les versements, elle revient à ${formatFcfa(payment.goodsFcfa)}. Les lots ne sont pas recalculés.`"
      />

      <ul v-if="order.payments.length > 0" class="divide-default divide-y text-sm">
        <li
          v-for="entry in order.payments"
          :key="entry.id"
          class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2"
          :class="entry.cancelledAt ? 'opacity-60' : ''"
        >
          <div class="min-w-0">
            <p :class="entry.cancelledAt ? 'line-through' : 'text-highlighted'">
              {{ formatDate(entry.paymentDate) }} ·
              {{ formatFcfa(entry.amountFcfa) }}
            </p>
            <p class="text-dimmed text-xs">
              {{
                entry.fcfaPerRmb
                  ? `Taux du jour : ${rateFormatter.format(entry.fcfaPerRmb)}`
                  : "Taux de la commande"
              }}
              <template v-if="entry.notes"> · {{ entry.notes }}</template>
              <template v-if="entry.cancelledAt"> · Annulé : {{ entry.cancelReason }} </template>
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span class="tabular-nums" :class="entry.cancelledAt ? 'line-through' : ''">
              {{ formatRmb(rmbOf(entry)) }}
            </span>
            <UButton
              v-if="!entry.cancelledAt"
              :icon="icons.undo"
              color="neutral"
              variant="ghost"
              size="xs"
              :aria-label="`Annuler le versement du ${formatDate(entry.paymentDate)}`"
              @click="cancelling = entry"
            />
          </div>
        </li>
      </ul>
      <p v-else class="text-dimmed text-sm">Aucun versement enregistré.</p>
    </div>

    <SupplierPaymentModal v-model:open="addOpen" :order="order" />
    <ReasonDialog
      v-model:open="cancelOpen"
      title="Annuler ce versement ?"
      :description="`${cancelling ? formatFcfa(cancelling.amountFcfa) : ''} du ${cancelling ? formatDate(cancelling.paymentDate) : ''}. Il restera visible, barré, mais ne comptera plus.`"
      confirm-label="Annuler le versement"
      :loading="cancelMutation.isPending.value"
      @confirm="confirmCancel"
    />
  </UPageCard>
</template>
