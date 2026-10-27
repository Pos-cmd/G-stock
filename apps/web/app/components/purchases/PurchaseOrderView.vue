<script setup lang="ts">
import { formatDate, formatFcfa, formatQty, formatRmb } from "@G-stock/core/format";
import { ALLOCATION_METHOD_LABELS } from "@G-stock/core/labels";
import type { TableColumn } from "@nuxt/ui";

import PurchaseCostSummary from "~/components/purchases/PurchaseCostSummary.vue";
import type { PurchaseOrderDetail, PurchaseOrderItemRow } from "~/types/api";

const { order } = defineProps<{ order: PurchaseOrderDetail }>();

const rightAligned = { class: { td: "text-right", th: "text-right" } };
const columns = computed<TableColumn<PurchaseOrderItemRow>[]>(() => [
  { accessorKey: "productName", header: "Produit" },
  { accessorKey: "qty", header: "Quantité", meta: rightAligned },
  { accessorKey: "unitPriceRmb", header: "Prix unit. (RMB)", meta: rightAligned },
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
            <dt class="text-muted">Taux figés</dt>
            <dd class="text-highlighted mt-1 tabular-nums">
              {{ order.rmbPerUsd }} RMB = 1 $ = {{ order.fcfaPerUsd }} FCFA
            </dd>
          </div>
          <div>
            <dt class="text-muted">Répartition des frais</dt>
            <dd class="text-highlighted mt-1">
              {{ ALLOCATION_METHOD_LABELS[order.allocationMethod] }}
            </dd>
          </div>
          <div v-if="order.notes" class="sm:col-span-2">
            <dt class="text-muted">Notes</dt>
            <dd class="text-highlighted mt-1 whitespace-pre-line">{{ order.notes }}</dd>
          </div>
        </dl>
      </UPageCard>

      <PurchaseCostSummary :costs="order.costs" :fees="order" class="lg:self-start" />
    </div>

    <UTable :data="order.items" :columns="columns" class="border-default rounded-lg border">
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
      <template #unitPriceRmb-cell="{ row }">
        <span class="tabular-nums">{{ formatRmb(row.original.unitPriceRmb) }}</span>
      </template>
      <template #trips-cell="{ row }">
        <span class="tabular-nums">{{ formatQty(row.original.trips) }}</span>
      </template>
      <template #goodsFcfa-cell="{ row }">
        <span class="tabular-nums">{{ formatFcfa(row.original.goodsFcfa) }}</span>
        <p class="text-dimmed text-xs">{{ formatRmb(row.original.goodsRmb) }}</p>
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
      </template>
      <template #lotCode-cell="{ row }">
        <span v-if="row.original.lotCode" class="font-mono text-xs">{{
          row.original.lotCode
        }}</span>
        <span v-else class="text-dimmed">—</span>
      </template>
    </UTable>
  </div>
</template>
