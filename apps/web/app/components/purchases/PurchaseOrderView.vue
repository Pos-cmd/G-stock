<script setup lang="ts">
import {
  formatCurrency,
  formatDate,
  formatFcfa,
  formatOrderRates,
  formatQty,
} from "@G-stock/core/format";
import {
  ALLOCATION_METHOD_LABELS,
  FEE_CURRENCY_LABELS,
  PRICING_BASIS_LABELS,
  PURCHASE_CURRENCY_LABELS,
} from "@G-stock/core/labels";
import type { TableColumn } from "@nuxt/ui";

import DataTable from "~/components/common/DataTable.vue";
import PurchaseCostSummary from "~/components/purchases/PurchaseCostSummary.vue";
import type { PurchaseOrderDetail, PurchaseOrderItemRow } from "~/types/api";

const { order } = defineProps<{ order: PurchaseOrderDetail }>();

const isReceived = computed(() => order.status === "received");
const goodsHint = computed(() => {
  if (isReceived.value) {
    return order.receivedGoodsFcfa === null ? null : "Figée à la réception";
  }
  return order.payment.paymentCount > 0 ? PAID_GOODS_HINT : null;
});
const feeLines = computed(() =>
  isReceived.value ? receptionFeeLines(order.fees) : estimateFeeLines(order),
);
const arrivalInfo = computed(() =>
  [
    { label: "Arrivée au port", value: order.arrivedAt ? formatDate(order.arrivedAt) : null },
    { label: "Entrée en stock", value: order.receivedAt ? formatDate(order.receivedAt) : null },
    { label: "N° conteneur", value: order.containerNumber },
    { label: "N° BL", value: order.billOfLading },
    { label: "Transitaire", value: order.forwarder },
  ].filter((info) => info.value),
);

const rightAligned = { class: { td: "text-right", th: "text-right" } };
const columns = computed<TableColumn<PurchaseOrderItemRow>[]>(() => [
  { accessorKey: "productName", header: "Produit" },
  { accessorKey: "qty", header: "Qté en stock", meta: rightAligned },
  ...(order.items.some((item) => item.weightTons)
    ? [{ accessorKey: "weightTons", header: "Poids", meta: rightAligned }]
    : []),
  {
    accessorKey: "unitPrice",
    header: `Prix (${FEE_CURRENCY_LABELS[order.currency]})`,
    meta: rightAligned,
  },
  ...(order.allocationMethod === "proportional"
    ? [{ accessorKey: "trips", header: "Voyages", meta: rightAligned }]
    : []),
  { accessorKey: "goodsFcfa", header: "Total", meta: rightAligned },
  { accessorKey: "transportShareFcfa", header: "Part des frais", meta: rightAligned },
  { accessorKey: "unitCostFcfa", header: "Coût unitaire", meta: rightAligned },
  { accessorKey: "lotCode", header: "Lot" },
]);
</script>

<template>
  <div class="space-y-6">
    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <UPageCard variant="subtle" title="Commande" class="lg:self-start">
        <dl class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt class="text-muted">Fournisseur</dt>
            <dd class="text-highlighted mt-1">
              {{ order.supplier?.name ?? "—" }}
              <span v-if="order.supplier" class="text-dimmed">· {{ order.supplier.country }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-muted">Date de commande</dt>
            <dd class="text-highlighted mt-1">{{ formatDate(order.orderDate) }}</dd>
          </div>
          <div>
            <dt class="text-muted">Prix fournisseur</dt>
            <dd class="text-highlighted mt-1">En {{ PURCHASE_CURRENCY_LABELS[order.currency] }}</dd>
          </div>
          <div>
            <dt class="text-muted">Taux figés</dt>
            <dd class="text-highlighted mt-1 tabular-nums">{{ formatOrderRates(order) }}</dd>
          </div>
          <div>
            <dt class="text-muted">Répartition des frais</dt>
            <dd class="text-highlighted mt-1">
              {{ ALLOCATION_METHOD_LABELS[order.allocationMethod] }}
            </dd>
          </div>
          <div v-for="info in arrivalInfo" :key="info.label">
            <dt class="text-muted">{{ info.label }}</dt>
            <dd class="text-highlighted mt-1">{{ info.value }}</dd>
          </div>
          <div v-if="order.notes" class="sm:col-span-2">
            <dt class="text-muted">Notes</dt>
            <dd class="text-highlighted mt-1 whitespace-pre-line">{{ order.notes }}</dd>
          </div>
        </dl>
      </UPageCard>

      <PurchaseCostSummary
        :title="isReceived ? 'Prix de revient réel' : 'Prix de revient estimé'"
        :costs="order.costs"
        :fee-lines="feeLines"
        :estimate-total-fcfa="isReceived ? order.estimate.totalFcfa : null"
        :goods-hint="goodsHint"
        class="lg:self-start"
      />
    </div>

    <DataTable
      title="Lignes de la commande"
      :data="order.items"
      :columns="columns"
      :searchable="order.items.length > 8"
      search-placeholder="Produit…"
      :item-label="['ligne', 'lignes']"
      storage-key="order-lines"
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
          formatQty(row.original.qtyReceived ?? row.original.qty, row.original.productUnit)
        }}</span>
        <p
          v-if="row.original.qtyReceived !== null && row.original.qtyReceived !== row.original.qty"
          class="text-warning text-xs tabular-nums"
        >
          sur {{ formatQty(row.original.qty) }} commandé(s)
        </p>
      </template>
      <template #weightTons-cell="{ row }">
        <span class="tabular-nums">{{
          row.original.weightTons ? formatQty(row.original.weightTons, "T") : "—"
        }}</span>
      </template>
      <template #unitPrice-cell="{ row }">
        <span class="tabular-nums">{{
          formatCurrency(row.original.unitPrice, order.currency)
        }}</span>
        <span class="text-dimmed ms-1 text-xs">
          {{ PRICING_BASIS_LABELS[row.original.pricingBasis] }}</span
        >
      </template>
      <template #trips-cell="{ row }">
        <span class="tabular-nums">{{ formatQty(row.original.trips) }}</span>
      </template>
      <template #goodsFcfa-cell="{ row }">
        <span class="tabular-nums">{{ formatFcfa(row.original.goodsFcfa) }}</span>
        <p class="text-dimmed text-xs">
          {{ formatCurrency(row.original.goodsAmount, order.currency) }}
        </p>
      </template>
      <template #transportShareFcfa-cell="{ row }">
        <span class="text-muted tabular-nums">{{
          formatFcfa(row.original.transportShareFcfa)
        }}</span>
      </template>
      <template #unitCostFcfa-cell="{ row }">
        <span class="text-highlighted font-semibold tabular-nums">{{
          formatFcfa(row.original.unitCostFcfa)
        }}</span>
        <p v-if="row.original.costPerTonFcfa" class="text-dimmed text-xs tabular-nums">
          {{ formatFcfa(row.original.costPerTonFcfa) }} / T
        </p>
      </template>
      <template #lotCode-cell="{ row }">
        <span v-if="row.original.lotCode" class="font-mono text-xs">{{
          row.original.lotCode
        }}</span>
        <span v-else class="text-dimmed">—</span>
      </template>
    </DataTable>
  </div>
</template>
