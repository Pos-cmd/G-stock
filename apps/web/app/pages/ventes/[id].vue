<script setup lang="ts">
import {
  formatDate,
  formatDateTime,
  formatFcfa,
  formatQty,
} from "@G-stock/core/format";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPE_LABELS,
  RETURN_REFUND_METHOD_LABELS,
} from "@G-stock/core/labels";
import type { DropdownMenuItem, TableColumn } from "@nuxt/ui";
import { useMutation, useQuery } from "@tanstack/vue-query";

import DataTable from "~/components/common/DataTable.vue";
import ReasonDialog from "~/components/common/ReasonDialog.vue";
import PagePanel from "~/components/layout/PagePanel.vue";
import DiscountModal from "~/components/sales/DiscountModal.vue";
import PaymentModal from "~/components/sales/PaymentModal.vue";
import SaleEditModal from "~/components/sales/SaleEditModal.vue";
import SaleReturnModal from "~/components/sales/SaleReturnModal.vue";
import SaleStatusBadge from "~/components/sales/SaleStatusBadge.vue";
import type { SaleDetail } from "~/types/api";

const icons = useIcons();

type SaleItem = SaleDetail["items"][number];

const route = useRoute();
const saleId = computed(() => String(route.params.id));

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidateSales = useInvalidateSales();
const invalidateStock = useInvalidateStock();

const { generate, generating } = useGenerateDocument();
const { share, sharing } = useShareReceipt();

const sale = useQuery(
  computed(() => $orpc.sales.get.queryOptions({ input: { id: saleId.value } }))
);
const data = computed(() => sale.data.value);
const isActive = computed(() => data.value?.status === "active");

useHead({ title: () => data.value?.reference ?? "Vente" });

const paymentOpen = ref(false);
const discountOpen = ref(false);
const cancelOpen = ref(false);
const editOpen = ref(false);
const returnOpen = ref(false);

type SalePayment = SaleDetail["payments"][number];

/** Paiement en cours de correction (erreur de frappe) : le modal s'ouvre pré-rempli. */
const editedPayment = ref<SalePayment | null>(null);
const paymentToCancel = ref<SalePayment | null>(null);

const openPaymentCreate = () => {
  editedPayment.value = null;
  paymentOpen.value = true;
};
const openPaymentEdit = (payment: SalePayment) => {
  editedPayment.value = payment;
  paymentOpen.value = true;
};

const cancelPaymentMutation = useMutation(
  $orpc.payments.cancel.mutationOptions()
);
const confirmCancelPayment = async (reason: string) => {
  const payment = paymentToCancel.value;
  if (!payment) {
    return;
  }
  try {
    await cancelPaymentMutation.mutateAsync({ id: payment.id, reason });
    await Promise.all([invalidateSales(), invalidateStock()]);
    paymentToCancel.value = null;
    notify.success(
      "Paiement annulé",
      `${formatFcfa(payment.amountFcfa)} retiré du solde du client`
    );
  } catch (error) {
    notify.error("Annulation impossible", error);
  }
};

/** Corriger ou annuler un paiement sans quitter la vente. */
const paymentActions = (payment: SalePayment): DropdownMenuItem[][] => [
  [
    {
      icon: icons.edit,
      label: "Corriger le paiement",
      onSelect: () => openPaymentEdit(payment),
    },
  ],
  [
    {
      color: "error",
      icon: icons.cancel,
      label: "Annuler le paiement",
      onSelect: () => {
        paymentToCancel.value = payment;
      },
    },
  ],
];

const cancelMutation = useMutation($orpc.sales.cancel.mutationOptions());
const confirmCancel = async (reason: string) => {
  try {
    const result = await cancelMutation.mutateAsync({
      id: saleId.value,
      reason,
    });
    await Promise.all([invalidateSales(), invalidateStock()]);
    cancelOpen.value = false;
    notify.success(
      "Vente annulée",
      result.cancelledPaymentsFcfa > 0
        ? `Stock remis en place ; ${formatFcfa(result.cancelledPaymentsFcfa)} de paiements annulés`
        : "Stock remis en place"
    );
  } catch (error) {
    notify.error("Annulation impossible", error);
  }
};

const moreActions = computed<DropdownMenuItem[][]>(() => [
  [
    {
      icon: icons.edit,
      label: "Modifier la vente",
      onSelect: () => {
        editOpen.value = true;
      },
    },
    {
      icon: icons.undo,
      label: "Reprendre des articles",
      onSelect: () => {
        returnOpen.value = true;
      },
    },
    {
      icon: icons.discount,
      label: "Accorder une remise",
      onSelect: () => {
        discountOpen.value = true;
      },
    },
  ],
  [
    {
      color: "error",
      icon: icons.cancel,
      label: "Annuler la vente",
      onSelect: () => {
        cancelOpen.value = true;
      },
    },
  ],
]);

const rightAligned = { class: { td: "text-right", th: "text-right" } };
const columns: TableColumn<SaleItem>[] = [
  { accessorKey: "productName", header: "Produit" },
  { accessorKey: "qty", header: "Quantité", meta: rightAligned },
  { accessorKey: "unitPriceFcfa", header: "Prix unitaire", meta: rightAligned },
  { accessorKey: "amountFcfa", header: "Montant", meta: rightAligned },
  { accessorKey: "costFcfa", header: "Coût", meta: rightAligned },
  { accessorKey: "marginFcfa", header: "Marge", meta: rightAligned },
  { accessorKey: "lots", header: "Lots" },
];
</script>

<template>
  <PagePanel
    id="sale-detail"
    :title="data?.reference ?? 'Vente'"
    :description="
      data ? `${data.customer.name} · ${formatDate(data.saleDate)}` : undefined
    "
    :icon="icons.sale"
    :parents="[{ label: 'Ventes', to: '/ventes' }]"
  >
    <template v-if="data" #badges>
      <SaleStatusBadge :status="data.status" :due-fcfa="data.summary.dueFcfa" />
    </template>
    <template #actions>
      <template v-if="data">
        <UFieldGroup>
          <UButton
            color="neutral"
            variant="outline"
            :icon="icons.pdf"
            label="Reçu PDF"
            :loading="generating"
            @click="generate('receipt', data.id)"
          />
          <UTooltip
            text="Reçu au format téléphone, avec un message pour le client"
          >
            <UButton
              color="neutral"
              variant="outline"
              :icon="icons.whatsapp"
              label="WhatsApp"
              :loading="sharing"
              :ui="{ leadingIcon: 'text-success' }"
              @click="share(data)"
            />
          </UTooltip>
          <UDropdownMenu
            v-if="isActive"
            :items="moreActions"
            :content="{ align: 'end' }"
          >
            <UButton
              color="neutral"
              variant="outline"
              :icon="icons.moreActions"
              aria-label="Autres actions"
            />
          </UDropdownMenu>
        </UFieldGroup>
        <UButton
          v-if="isActive && data.summary.dueFcfa > 0"
          :icon="icons.payment"
          label="Encaisser"
          @click="openPaymentCreate"
        />
      </template>
    </template>

    <UAlert
      v-if="sale.isError.value"
      color="error"
      variant="subtle"
      :icon="icons.error"
      title="Vente introuvable"
      :description="sale.error.value?.message"
    />

    <div v-else-if="data" class="space-y-6">
      <UAlert
        v-if="data.status === 'cancelled'"
        color="neutral"
        variant="subtle"
        :icon="icons.cancel"
        :title="`Annulée le ${formatDateTime(data.cancelledAt ?? data.createdAt)}${data.cancelledByName ? ` par ${data.cancelledByName}` : ''}`"
        :description="`Motif : ${data.cancelReason}. Le stock est revenu dans ses lots et les paiements de la vente ont été annulés.`"
      />

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <UPageCard variant="subtle" title="Vente" class="lg:self-start">
          <dl class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-muted">Client</dt>
              <dd class="mt-1">
                <NuxtLink
                  :to="`/clients/${data.customer.id}`"
                  class="text-highlighted font-medium hover:underline"
                >
                  {{ data.customer.name }}
                </NuxtLink>
                <span v-if="data.customer.phone" class="text-dimmed">
                  · {{ data.customer.phone }}</span
                >
              </dd>
            </div>
            <div>
              <dt class="text-muted">Date</dt>
              <dd class="text-highlighted mt-1">
                {{ formatDate(data.saleDate) }}
              </dd>
            </div>
            <div>
              <dt class="text-muted">Paiement</dt>
              <dd class="text-highlighted mt-1">
                {{ PAYMENT_TYPE_LABELS[data.paymentType] }}
              </dd>
            </div>
            <div>
              <dt class="text-muted">Enregistrée par</dt>
              <dd class="text-highlighted mt-1">
                {{ data.createdByName ?? "—" }}
                <span class="text-dimmed"
                  >· {{ formatDateTime(data.createdAt) }}</span
                >
              </dd>
            </div>
            <div v-if="data.notes" class="sm:col-span-2">
              <dt class="text-muted">Notes</dt>
              <dd class="text-highlighted mt-1 whitespace-pre-line">
                {{ data.notes }}
              </dd>
            </div>
          </dl>
        </UPageCard>

        <UPageCard variant="subtle" title="Montants" :icon="icons.amounts">
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-muted">Total des articles</dt>
              <dd class="tabular-nums">
                {{ formatFcfa(data.summary.totalFcfa) }}
              </dd>
            </div>
            <div
              v-if="data.summary.discountFcfa > 0"
              class="flex justify-between gap-4"
            >
              <dt class="text-muted">Remises</dt>
              <dd class="text-warning tabular-nums">
                − {{ formatFcfa(data.summary.discountFcfa) }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-highlighted font-medium">Montant net</dt>
              <dd class="text-highlighted text-lg font-semibold tabular-nums">
                {{ formatFcfa(data.summary.netFcfa) }}
              </dd>
            </div>
            <USeparator />
            <div class="flex justify-between gap-4">
              <dt class="text-muted">Coût de revient</dt>
              <dd class="tabular-nums">
                {{ formatFcfa(data.summary.costFcfa) }}
              </dd>
            </div>
            <div v-if="isActive" class="flex justify-between gap-4">
              <dt class="text-muted">Marge</dt>
              <dd
                class="tabular-nums"
                :class="
                  data.summary.marginFcfa < 0 ? 'text-error' : 'text-success'
                "
              >
                {{ formatFcfa(data.summary.marginFcfa) }}
                <span class="text-dimmed text-xs">
                  {{
                    formatMarginRate(
                      data.summary.marginFcfa,
                      data.summary.netFcfa
                    )
                  }}
                </span>
              </dd>
            </div>
            <template v-if="isActive">
              <USeparator />
              <div class="flex justify-between gap-4">
                <dt class="text-muted">Payé</dt>
                <dd class="tabular-nums">
                  {{ formatFcfa(data.summary.paidFcfa) }}
                </dd>
              </div>
              <div class="flex justify-between gap-4">
                <dt class="text-muted">Reste dû</dt>
                <dd
                  class="font-semibold tabular-nums"
                  :class="
                    data.summary.dueFcfa > 0 ? 'text-warning' : 'text-success'
                  "
                >
                  {{
                    data.summary.dueFcfa > 0
                      ? formatFcfa(data.summary.dueFcfa)
                      : "Soldée"
                  }}
                </dd>
              </div>
            </template>
          </dl>
        </UPageCard>
      </div>

      <DataTable
        title="Articles vendus"
        :data="data.items"
        :columns="columns"
        :searchable="false"
        :item-label="['article', 'articles']"
        storage-key="sale-lines"
      >
        <template #productName-cell="{ row }">
          <NuxtLink
            :to="`/produits/${row.original.productId}`"
            class="text-highlighted font-medium hover:underline"
          >
            {{ row.original.productName }}
          </NuxtLink>
        </template>
        <template #qty-cell="{ row }">
          <span class="tabular-nums">{{
            formatQty(row.original.qty, row.original.productUnit)
          }}</span>
        </template>
        <template #unitPriceFcfa-cell="{ row }">
          <span class="tabular-nums">{{
            formatFcfa(row.original.unitPriceFcfa)
          }}</span>
        </template>
        <template #amountFcfa-cell="{ row }">
          <span class="text-highlighted font-medium tabular-nums">{{
            formatFcfa(row.original.amountFcfa)
          }}</span>
        </template>
        <template #costFcfa-cell="{ row }">
          <span class="text-muted tabular-nums">{{
            formatFcfa(row.original.costFcfa)
          }}</span>
        </template>
        <template #marginFcfa-cell="{ row }">
          <span
            class="tabular-nums"
            :class="row.original.marginFcfa < 0 ? 'text-error' : ''"
          >
            {{ formatFcfa(row.original.marginFcfa) }}
          </span>
        </template>
        <template #lots-cell="{ row }">
          <div class="space-y-0.5">
            <p
              v-for="lot in row.original.lots"
              :key="lot.lotId"
              class="text-xs"
            >
              <span class="font-mono">{{ lot.lotCode }}</span>
              <span class="text-dimmed">
                · {{ formatQty(lot.qty) }} à
                {{ formatFcfa(lot.unitCostFcfa) }}</span
              >
            </p>
          </div>
        </template>
      </DataTable>

      <div class="grid gap-6 lg:grid-cols-2">
        <UPageCard variant="subtle" title="Remises" :icon="icons.discount">
          <p v-if="data.discounts.length === 0" class="text-muted text-sm">
            Aucune remise.
          </p>
          <ul v-else class="divide-default divide-y text-sm">
            <li
              v-for="discount in data.discounts"
              :key="discount.id"
              class="flex justify-between gap-4 py-2"
            >
              <div class="min-w-0">
                <p class="text-highlighted">{{ discount.reason }}</p>
                <p class="text-dimmed text-xs">
                  {{ formatDate(discount.discountDate) }}
                  <template v-if="discount.createdByName">
                    · {{ discount.createdByName }}</template
                  >
                </p>
              </div>
              <span
                class="text-warning font-medium whitespace-nowrap tabular-nums"
              >
                − {{ formatFcfa(discount.amountFcfa) }}
              </span>
            </li>
          </ul>
        </UPageCard>

        <UPageCard
          variant="subtle"
          title="Paiements de cette vente"
          :icon="icons.payment"
        >
          <p v-if="data.payments.length === 0" class="text-muted text-sm">
            Aucun paiement rattaché. Les paiements libres du client soldent ses
            ventes les plus anciennes d'abord.
          </p>
          <ul v-else class="divide-default divide-y text-sm">
            <li
              v-for="payment in data.payments"
              :key="payment.id"
              class="flex items-start justify-between gap-4 py-2"
            >
              <div class="min-w-0">
                <p
                  :class="
                    payment.cancelledAt
                      ? 'text-dimmed line-through'
                      : 'text-highlighted'
                  "
                >
                  {{ PAYMENT_METHOD_LABELS[payment.method] }} ·
                  {{ formatDate(payment.paymentDate) }}
                </p>
                <p v-if="payment.cancelledAt" class="text-dimmed text-xs">
                  Annulé : {{ payment.cancelReason }}
                </p>
                <p v-else-if="payment.notes" class="text-dimmed text-xs">
                  {{ payment.notes }}
                </p>
              </div>
              <div class="flex items-center gap-1">
                <span
                  class="font-medium whitespace-nowrap tabular-nums"
                  :class="
                    payment.cancelledAt
                      ? 'text-dimmed line-through'
                      : 'text-success'
                  "
                >
                  {{ formatFcfa(payment.amountFcfa) }}
                </span>
                <UDropdownMenu
                  v-if="!payment.cancelledAt && isActive"
                  :items="paymentActions(payment)"
                  :content="{ align: 'end' }"
                >
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    :icon="icons.moreActions"
                    :aria-label="`Actions sur le paiement de ${formatFcfa(payment.amountFcfa)}`"
                  />
                </UDropdownMenu>
              </div>
            </li>
          </ul>
        </UPageCard>
      </div>

      <UPageCard
        v-if="data.returns.length > 0"
        variant="subtle"
        title="Reprises"
        :icon="icons.undo"
      >
        <ul class="divide-default divide-y text-sm">
          <li
            v-for="item of data.returns"
            :key="item.id"
            class="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2"
          >
            <div class="min-w-0">
              <p class="text-highlighted">
                {{ formatDate(item.returnDate) }} ·
                {{ RETURN_REFUND_METHOD_LABELS[item.refundMethod] }}
              </p>
              <p class="text-dimmed text-xs">{{ item.reason }}</p>
              <p class="text-dimmed text-xs">
                <template v-for="(line, index) in item.items" :key="line.id">
                  <span v-if="index > 0"> · </span>
                  {{ line.productName }} × {{ formatQty(line.qty) }}
                  <span v-if="!line.restocked">(non remis en stock)</span>
                </template>
              </p>
            </div>
            <span
              class="text-highlighted font-medium whitespace-nowrap tabular-nums"
            >
              − {{ formatFcfa(item.amountFcfa) }}
            </span>
          </li>
        </ul>
      </UPageCard>

      <UPageCard
        v-if="data.revisions.length > 0"
        variant="subtle"
        title="Journal des modifications"
        :icon="icons.edit"
      >
        <ul class="divide-default divide-y text-sm">
          <li
            v-for="revision of data.revisions"
            :key="revision.id"
            class="py-2"
          >
            <p class="text-highlighted">
              {{ formatDateTime(revision.revisionDate) }} ·
              {{ revision.createdByName ?? "—" }}
            </p>
            <p class="text-muted text-xs">{{ revision.reason }}</p>
            <p class="text-dimmed text-xs">{{ revision.summary }}</p>
          </li>
        </ul>
      </UPageCard>

      <PaymentModal
        v-model:open="paymentOpen"
        :customer="{
          dueFcfa: data.summary.dueFcfa,
          id: data.customer.id,
          name: data.customer.name,
        }"
        :payment="editedPayment"
        :sale-id="data.id"
      />
      <SaleEditModal
        v-model:open="editOpen"
        :sale="{ ...data, totalFcfa: data.summary.totalFcfa }"
      />
      <SaleReturnModal
        v-model:open="returnOpen"
        :sale="{ ...data, dueFcfa: data.summary.dueFcfa }"
      />
      <DiscountModal
        v-model:open="discountOpen"
        :sale="{
          id: data.id,
          netFcfa: data.summary.netFcfa,
          reference: data.reference,
        }"
      />
      <ReasonDialog
        v-model:open="cancelOpen"
        title="Annuler la vente ?"
        :description="`Le stock de ${data.reference} reviendra dans ses lots d'origine et ses paiements seront annulés. La vente restera dans l'historique.`"
        confirm-label="Annuler la vente"
        :loading="cancelMutation.isPending.value"
        @confirm="confirmCancel"
      />
      <ReasonDialog
        :open="paymentToCancel !== null"
        title="Annuler ce paiement ?"
        :description="
          paymentToCancel
            ? `${formatFcfa(paymentToCancel.amountFcfa)} du ${formatDate(paymentToCancel.paymentDate)} : le montant retournera dans le solde dû du client.`
            : ''
        "
        confirm-label="Annuler le paiement"
        :loading="cancelPaymentMutation.isPending.value"
        @update:open="(value) => !value && (paymentToCancel = null)"
        @confirm="confirmCancelPayment"
      />
    </div>
  </PagePanel>
</template>
