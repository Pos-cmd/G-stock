<script setup lang="ts">
import { isUuid } from "@G-stock/core/ids";
import type { PurchaseOrderStatus } from "@G-stock/core/enums";
import { formatCurrency, formatDate, formatFcfa, formatQty } from "@G-stock/core/format";
import { PURCHASE_ORDER_STATUS_LABELS } from "@G-stock/core/labels";
import type { TableColumn } from "@nuxt/ui";
import { keepPreviousData, useQuery } from "@tanstack/vue-query";

import DataTable from "~/components/common/DataTable.vue";
import PagePanel from "~/components/layout/PagePanel.vue";
import PurchaseStatusBadge from "~/components/purchases/PurchaseStatusBadge.vue";
import type { PurchaseOrderRow } from "~/types/api";

const icons = useIcons();
const create = useCreateDialogs();

useHead({ title: "Commandes fournisseurs" });

const ALL = "all";

const { $orpc } = useNuxtApp();
const route = useRoute();

const status = ref<PurchaseOrderStatus | typeof ALL>(ALL);
// Lien « commandes de ce fournisseur » depuis la page Fournisseurs.
const supplierId = ref<string | undefined>(
  isUuid(route.query.fournisseur) ? route.query.fournisseur : undefined,
);

const orders = useQuery(
  computed(() => ({
    ...$orpc.purchases.list.queryOptions({
      input: {
        status: status.value === ALL ? null : status.value,
        supplierId: supplierId.value ?? null,
      },
    }),
    placeholderData: keepPreviousData,
  })),
);
const suppliers = useQuery($orpc.suppliers.list.queryOptions());

const statusItems = [
  { label: "Tous les statuts", value: ALL },
  ...Object.entries(PURCHASE_ORDER_STATUS_LABELS).map(([value, label]) => ({ label, value })),
];
const supplierItems = computed(() =>
  (suppliers.data.value ?? []).map((supplier) => ({ label: supplier.name, value: supplier.id })),
);

const totals = computed(() => {
  const rows = (orders.data.value ?? []).filter((order) => order.status !== "cancelled");
  return {
    count: orders.data.value?.length ?? 0,
    value: rows.reduce((sum, order) => sum + order.totalFcfa, 0),
  };
});

/** Part déjà payée au fournisseur, en FCFA. */
const paidShare = (order: PurchaseOrderRow) => {
  const due = order.payment.paidFcfa + order.payment.remainingFcfa;
  return due > 0 ? Math.min(1, order.payment.paidFcfa / due) : 0;
};
const feesShare = (order: PurchaseOrderRow) =>
  order.totalFcfa > 0 ? Math.round((order.feesFcfa / order.totalFcfa) * 100) : 0;
const orderSearchText = (order: PurchaseOrderRow) =>
  `${order.reference} ${order.supplierName ?? ""} ${order.notes ?? ""}`;
const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

const rightAligned = { class: { td: "text-right", th: "text-right" } };
const columns: TableColumn<PurchaseOrderRow>[] = [
  { accessorKey: "reference", enableHiding: false, header: "Commande" },
  { accessorKey: "orderDate", header: "Date" },
  { accessorKey: "status", header: "Statut" },
  { accessorKey: "goodsAmount", header: "Marchandise", meta: rightAligned },
  { accessorKey: "totalFcfa", header: "Prix de revient", meta: rightAligned },
  {
    accessorFn: (order) =>
      order.status === "cancelled" || (order.status === "draft" && order.payment.paidFcfa === 0)
        ? -1
        : order.payment.remainingFcfa,
    header: "Paiement",
    id: "payment",
  },
];
</script>

<template>
  <PagePanel id="purchases" title="Commandes fournisseurs">
    <template #description>
      {{ totals.count }} commande{{ totals.count > 1 ? "s" : "" }} · prix de revient total
      <span class="text-highlighted font-medium tabular-nums">{{ formatFcfa(totals.value) }}</span>
      hors commandes annulées
    </template>
    <template #actions>
      <UButton :icon="icons.plus" label="Nouvelle commande" @click="create.openPurchase()" />
    </template>

    <div class="space-y-3">
      <DataTable
        :data="orders.data.value ?? []"
        :columns="columns"
        :loading="orders.isFetching.value"
        :search-text="orderSearchText"
        search-placeholder="Référence, fournisseur, notes…"
        :item-label="['commande', 'commandes']"
        storage-key="purchases"
      >
        <template #filters>
          <UFieldGroup>
            <USelect v-model="status" :items="statusItems" class="w-40" />
            <USelectMenu
              v-model="supplierId"
              :items="supplierItems"
              value-key="value"
              placeholder="Tous les fournisseurs"
              :search-input="{ placeholder: 'Rechercher…' }"
              clear
              class="w-56"
            />
          </UFieldGroup>
        </template>

        <template #reference-cell="{ row }">
          <NuxtLink :to="`/achats/${row.original.id}`" class="group block min-w-40">
            <span class="text-highlighted font-mono text-[13px] font-medium group-hover:underline">
              {{ row.original.reference }}
            </span>
            <p class="text-dimmed text-xs">
              {{ row.original.supplierName ?? "Sans fournisseur" }} ·
              {{ plural(row.original.itemCount, "ligne") }}
            </p>
          </NuxtLink>
        </template>

        <template #orderDate-cell="{ row }">
          {{ formatDate(row.original.orderDate) }}
          <p class="text-dimmed text-xs">
            {{
              row.original.receivedAt
                ? `reçue le ${formatDate(row.original.receivedAt)}`
                : formatDaysAgo(row.original.orderDate)
            }}
          </p>
        </template>

        <template #status-cell="{ row }">
          <PurchaseStatusBadge :status="row.original.status" />
        </template>

        <template #goodsAmount-cell="{ row }">
          <span class="tabular-nums">{{
            formatCurrency(row.original.goodsAmount, row.original.currency)
          }}</span>
          <p class="text-dimmed text-xs tabular-nums">
            {{ formatFcfa(row.original.goodsFcfa) }}
            <template v-if="row.original.totalWeightTons > 0">
              · {{ formatQty(row.original.totalWeightTons, "T") }}
            </template>
          </p>
        </template>

        <template #totalFcfa-cell="{ row }">
          <span class="text-highlighted font-semibold tabular-nums">{{
            formatFcfa(row.original.totalFcfa)
          }}</span>
          <p class="text-dimmed text-xs tabular-nums">
            dont {{ feesShare(row.original) }} % de frais
          </p>
        </template>

        <template #payment-cell="{ row }">
          <span v-if="row.original.status === 'cancelled'" class="text-dimmed">—</span>
          <span
            v-else-if="row.original.status === 'draft' && row.original.payment.paidFcfa === 0"
            class="text-dimmed text-xs"
          >
            Pas encore engagée
          </span>
          <div v-else class="w-36 space-y-1">
            <div class="bg-accented/60 h-1.5 overflow-hidden rounded-full">
              <div
                class="h-full rounded-full"
                :class="row.original.payment.isPaid ? 'bg-success' : 'bg-(--ui-chart-1)'"
                :style="{ width: `${paidShare(row.original) * 100}%` }"
              />
            </div>
            <p class="text-xs tabular-nums">
              <span v-if="row.original.payment.isPaid" class="text-success">Soldée</span>
              <span v-else-if="row.original.payment.paidFcfa === 0" class="text-muted">
                Rien versé · reste
                {{ formatCurrency(row.original.payment.remainingAmount, row.original.currency) }}
              </span>
              <span v-else class="text-warning">
                Reste
                {{ formatCurrency(row.original.payment.remainingAmount, row.original.currency) }}
              </span>
            </p>
          </div>
        </template>

        <template #empty>
          <div class="flex flex-col items-center gap-3 py-10 text-center">
            <UIcon :name="icons.purchases" class="text-dimmed size-10" />
            <p class="text-muted">Aucune commande ne correspond à ces critères.</p>
            <UButton
              variant="soft"
              :icon="icons.plus"
              label="Créer une commande"
              @click="create.openPurchase()"
            />
          </div>
        </template>
      </DataTable>
    </div>
  </PagePanel>
</template>
