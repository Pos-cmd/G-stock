<script setup lang="ts">
import { formatDate, formatFcfa } from "@G-stock/core/format";
import { PAYMENT_METHOD_LABELS } from "@G-stock/core/labels";
import type { TabsItem } from "@nuxt/ui";
import { useMutation, useQuery } from "@tanstack/vue-query";

import ConfirmDialog from "~/components/common/ConfirmDialog.vue";
import KpiCard from "~/components/common/KpiCard.vue";
import ReasonDialog from "~/components/common/ReasonDialog.vue";
import CustomerFormModal from "~/components/customers/CustomerFormModal.vue";
import ReceivableBadge from "~/components/customers/ReceivableBadge.vue";
import PagePanel from "~/components/layout/PagePanel.vue";
import PaymentModal from "~/components/sales/PaymentModal.vue";
import ProductSalesTable from "~/components/sales/ProductSalesTable.vue";
import SalesFilters from "~/components/sales/SalesFilters.vue";
import SalesTable from "~/components/sales/SalesTable.vue";

const icons = useIcons();
const create = useCreateDialogs();

const route = useRoute();
const customerId = computed(() => String(route.params.id));

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidateSales = useInvalidateSales();

const customer = useQuery(
  computed(() => $orpc.customers.get.queryOptions({ input: { id: customerId.value } })),
);
const data = computed(() => customer.data.value);
const paymentList = useQuery(
  computed(() =>
    $orpc.payments.list.queryOptions({
      input: { customerId: customerId.value },
    }),
  ),
);

useHead({ title: () => data.value?.name ?? "Client" });

const filters = ref<SalesFilterState>(emptySalesFilters());

const tabs: TabsItem[] = [
  { label: "Achats", slot: "sales", value: "sales" },
  {
    label: "Par produit",
    slot: "products",
    value: "products",
  },
  {
    label: "Paiements",
    slot: "payments",
    value: "payments",
  },
];

const formOpen = ref(false);
const paymentOpen = ref(false);
const deleteOpen = ref(false);
const cancelledPaymentId = ref<string | null>(null);
const cancelPaymentOpen = computed({
  get: () => cancelledPaymentId.value !== null,
  set: (isOpen: boolean) => {
    if (!isOpen) {
      cancelledPaymentId.value = null;
    }
  },
});

const removeMutation = useMutation($orpc.customers.remove.mutationOptions());
const confirmDelete = async () => {
  try {
    await removeMutation.mutateAsync({ id: customerId.value });
    deleteOpen.value = false;
    notify.success("Client supprimé", data.value?.name);
    await invalidateSales();
    await navigateTo("/clients", { replace: true });
  } catch (error) {
    notify.error("Suppression impossible", error);
  }
};

const cancelPaymentMutation = useMutation($orpc.payments.cancel.mutationOptions());
const confirmCancelPayment = async (reason: string) => {
  if (cancelledPaymentId.value === null) {
    return;
  }
  try {
    await cancelPaymentMutation.mutateAsync({
      id: cancelledPaymentId.value,
      reason,
    });
    await invalidateSales();
    cancelledPaymentId.value = null;
    notify.success("Paiement annulé");
  } catch (error) {
    notify.error("Annulation impossible", error);
  }
};
</script>

<template>
  <PagePanel
    id="customer-detail"
    :title="data?.name ?? 'Client'"
    :description="data ? [data.phone, data.address].filter(Boolean).join(' · ') : undefined"
    :parents="[{ label: 'Clients', to: '/clients' }]"
  >
    <template #leading>
      <UAvatar :alt="data?.name ?? 'Client'" size="xl" class="ring-default ring" />
    </template>
    <template v-if="data?.receivableLevel && data.daysOverdue !== null" #badges>
      <ReceivableBadge :level="data.receivableLevel" :days="data.daysOverdue" />
    </template>
    <template #actions>
      <UButton
        v-if="data && data.saleCount === 0"
        color="error"
        variant="ghost"
        :icon="icons.trash"
        aria-label="Supprimer le client"
        @click="deleteOpen = true"
      />
      <UFieldGroup>
        <UButton
          color="neutral"
          variant="outline"
          :icon="icons.edit"
          label="Modifier"
          :disabled="!data"
          @click="formOpen = true"
        />
        <UButton
          color="neutral"
          variant="outline"
          :icon="icons.payment"
          label="Encaisser"
          :disabled="!data"
          @click="paymentOpen = true"
        />
      </UFieldGroup>
      <UButton :icon="icons.sales" label="Nouvelle vente" @click="create.openSale(customerId)" />
    </template>

    <UAlert
      v-if="customer.isError.value"
      color="error"
      variant="subtle"
      :icon="icons.error"
      title="Client introuvable"
      :description="customer.error.value?.message"
    />

    <div v-else class="space-y-6">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total acheté"
          :icon="icons.customerPurchases"
          :loading="customer.isPending.value"
          :value="formatFcfa(data?.purchasedFcfa ?? 0)"
          :hint="`${data?.saleCount ?? 0} vente(s), remises déduites`"
        />
        <KpiCard
          label="Reste dû"
          :icon="icons.pending"
          :color="(data?.dueFcfa ?? 0) > 0 ? 'warning' : 'success'"
          :loading="customer.isPending.value"
          :value="formatFcfa(data?.dueFcfa ?? 0)"
          :hint="
            data?.oldestUnpaidDate
              ? `Plus ancienne dette : ${formatDate(data.oldestUnpaidDate)}`
              : 'Aucune dette'
          "
        />
        <KpiCard
          label="Avoir"
          :icon="icons.customerCredit"
          color="success"
          :loading="customer.isPending.value"
          :value="formatFcfa(data?.creditFcfa ?? 0)"
          hint="Trop-perçu ou remise après paiement"
        />
        <KpiCard
          label="Dernier achat"
          :icon="icons.calendar"
          color="neutral"
          :loading="customer.isPending.value"
          :value="data?.lastSaleDate ? formatDate(data.lastSaleDate) : '—'"
        />
      </div>

      <UPageCard v-if="data" variant="subtle">
        <div class="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <span v-if="data.phone"
            ><UIcon :name="icons.phone" class="text-dimmed me-1 align-middle" />{{
              data.phone
            }}</span
          >
          <span v-if="data.address"
            ><UIcon :name="icons.address" class="text-dimmed me-1 align-middle" />{{
              data.address
            }}</span
          >
          <ReceivableBadge
            v-if="data.receivableLevel && data.daysOverdue !== null"
            :level="data.receivableLevel"
            :days="data.daysOverdue"
          />
          <span v-if="data.notes" class="text-muted whitespace-pre-line">{{ data.notes }}</span>
          <span v-if="!data.phone && !data.address && !data.notes" class="text-dimmed"
            >Aucune coordonnée.</span
          >
        </div>
      </UPageCard>

      <UTabs :items="tabs" default-value="sales">
        <template #sales>
          <div class="space-y-3 pt-2">
            <SalesFilters v-model="filters" :show-search="false" />
            <SalesTable :filters="filters" :customer-id="customerId" :show-customer="false" />
          </div>
        </template>

        <template #products>
          <div class="space-y-3 pt-2">
            <SalesFilters v-model="filters" period-only />
            <ProductSalesTable :from="filters.from" :to="filters.to" :customer-id="customerId" />
          </div>
        </template>

        <template #payments>
          <div class="pt-2">
            <p
              v-if="(paymentList.data.value ?? []).length === 0"
              class="text-muted py-6 text-center text-sm"
            >
              Aucun paiement enregistré.
            </p>
            <ul v-else class="divide-default border-default divide-y rounded-lg border text-sm">
              <li
                v-for="payment in paymentList.data.value"
                :key="payment.id"
                class="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div class="min-w-0">
                  <p :class="payment.cancelledAt ? 'text-dimmed line-through' : 'text-highlighted'">
                    {{ formatDate(payment.paymentDate) }} ·
                    {{ PAYMENT_METHOD_LABELS[payment.method] }}
                    <NuxtLink
                      v-if="payment.saleReference && payment.saleId"
                      :to="`/ventes/${payment.saleId}`"
                      class="text-primary font-mono text-xs"
                    >
                      {{ payment.saleReference }}
                    </NuxtLink>
                  </p>
                  <p class="text-dimmed text-xs">
                    <template v-if="payment.cancelledAt"
                      >Annulé : {{ payment.cancelReason }}</template
                    >
                    <template v-else>
                      {{ [payment.notes, payment.createdByName].filter(Boolean).join(" · ") }}
                    </template>
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <span
                    class="font-medium whitespace-nowrap tabular-nums"
                    :class="payment.cancelledAt ? 'text-dimmed line-through' : 'text-success'"
                  >
                    {{ formatFcfa(payment.amountFcfa) }}
                  </span>
                  <UButton
                    v-if="!payment.cancelledAt"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :icon="icons.undo"
                    :aria-label="`Annuler le paiement du ${formatDate(payment.paymentDate)}`"
                    @click="cancelledPaymentId = payment.id"
                  />
                </div>
              </li>
            </ul>
          </div>
        </template>
      </UTabs>
    </div>

    <template v-if="data">
      <CustomerFormModal v-model:open="formOpen" :customer="data" />
      <PaymentModal v-model:open="paymentOpen" :customer="data" />
      <ConfirmDialog
        v-model:open="deleteOpen"
        title="Supprimer le client ?"
        :description="`« ${data.name} » sera définitivement supprimé.`"
        confirm-label="Supprimer"
        :loading="removeMutation.isPending.value"
        @confirm="confirmDelete"
      />
    </template>
    <ReasonDialog
      v-model:open="cancelPaymentOpen"
      title="Annuler ce paiement ?"
      description="Il ne comptera plus dans le solde du client, mais restera visible, barré, avec son motif."
      confirm-label="Annuler le paiement"
      :loading="cancelPaymentMutation.isPending.value"
      @confirm="confirmCancelPayment"
    />
  </PagePanel>
</template>
