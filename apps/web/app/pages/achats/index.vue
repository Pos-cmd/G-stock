<script setup lang="ts">
import { isUuid } from "@G-stock/core/ids";
import type { PurchaseOrderStatus } from "@G-stock/core/enums";
import { formatDate, formatFcfa, formatQty, formatRmb } from "@G-stock/core/format";
import { PURCHASE_ORDER_STATUS_LABELS } from "@G-stock/core/labels";
import type { TableColumn } from "@nuxt/ui";
import { keepPreviousData, useQuery } from "@tanstack/vue-query";

import PagePanel from "~/components/layout/PagePanel.vue";
import PurchaseStatusBadge from "~/components/purchases/PurchaseStatusBadge.vue";
import type { PurchaseOrderRow } from "~/types/api";

useHead({ title: "Commandes fournisseurs" });

const ALL = "all";
const SEARCH_DEBOUNCE_MS = 300;

const { $orpc } = useNuxtApp();
const route = useRoute();

const search = ref("");
const debouncedSearch = refDebounced(search, SEARCH_DEBOUNCE_MS);
const status = ref<PurchaseOrderStatus | typeof ALL>(ALL);
// Lien « commandes de ce fournisseur » depuis la page Fournisseurs.
const supplierId = ref<string | undefined>(
  isUuid(route.query.fournisseur) ? route.query.fournisseur : undefined,
);

const orders = useQuery(
  computed(() => ({
    ...$orpc.purchases.list.queryOptions({
      input: {
        search: debouncedSearch.value || null,
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

const rightAligned = { class: { td: "text-right", th: "text-right" } };
const columns: TableColumn<PurchaseOrderRow>[] = [
  { accessorKey: "reference", header: "Commande" },
  { accessorKey: "orderDate", header: "Date" },
  { accessorKey: "supplierName", header: "Fournisseur" },
  { accessorKey: "status", header: "Statut" },
  { accessorKey: "goodsRmb", header: "Marchandise", meta: rightAligned },
  { accessorKey: "feesFcfa", header: "Frais", meta: rightAligned },
  { accessorKey: "totalFcfa", header: "Prix de revient", meta: rightAligned },
];
</script>

<template>
  <PagePanel id="purchases" title="Commandes fournisseurs" icon="i-lucide-ship">
    <template #actions>
      <UButton
        to="/achats/fournisseurs"
        color="neutral"
        variant="outline"
        icon="i-lucide-factory"
        label="Fournisseurs"
      />
      <UButton to="/achats/nouvelle" icon="i-lucide-plus" label="Nouvelle commande" />
    </template>

    <template #toolbar>
      <div class="flex w-full flex-wrap items-center gap-2 py-1">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Référence, fournisseur, notes…"
          class="w-full sm:w-72"
        />
        <USelect v-model="status" :items="statusItems" class="w-44" />
        <USelectMenu
          v-model="supplierId"
          :items="supplierItems"
          value-key="value"
          placeholder="Tous les fournisseurs"
          :search-input="{ placeholder: 'Rechercher…' }"
          clear
          class="w-56"
        />
      </div>
    </template>

    <div class="space-y-3">
      <p class="text-muted text-sm">
        {{ totals.count }} commande{{ totals.count > 1 ? "s" : "" }} · prix de revient total
        <strong class="text-highlighted">{{ formatFcfa(totals.value) }}</strong>
        <span class="text-dimmed ms-1">(hors commandes annulées)</span>
      </p>

      <UTable
        :data="orders.data.value ?? []"
        :columns="columns"
        :loading="orders.isFetching.value"
        class="border-default rounded-lg border"
      >
        <template #reference-cell="{ row }">
          <NuxtLink :to="`/achats/${row.original.id}`" class="group block">
            <span class="text-highlighted font-mono text-sm font-medium group-hover:underline">
              {{ row.original.reference }}
            </span>
            <p class="text-dimmed text-xs">
              {{ row.original.itemCount }} ligne{{ row.original.itemCount > 1 ? "s" : "" }}
            </p>
          </NuxtLink>
        </template>

        <template #orderDate-cell="{ row }">
          {{ formatDate(row.original.orderDate) }}
          <p v-if="row.original.receivedAt" class="text-dimmed text-xs">
            reçue le {{ formatDate(row.original.receivedAt) }}
          </p>
        </template>

        <template #supplierName-cell="{ row }">
          <span :class="row.original.supplierName ? '' : 'text-dimmed'">
            {{ row.original.supplierName ?? "—" }}
          </span>
        </template>

        <template #status-cell="{ row }">
          <PurchaseStatusBadge :status="row.original.status" />
        </template>

        <template #goodsRmb-cell="{ row }">
          <span class="tabular-nums">{{ formatRmb(row.original.goodsRmb) }}</span>
          <p class="text-dimmed text-xs tabular-nums">
            {{ formatFcfa(row.original.goodsFcfa) }}
            <template v-if="row.original.totalWeightTons > 0">
              · {{ formatQty(row.original.totalWeightTons, "T") }}
            </template>
          </p>
        </template>

        <template #feesFcfa-cell="{ row }">
          <span class="text-muted tabular-nums">{{ formatFcfa(row.original.feesFcfa) }}</span>
        </template>

        <template #totalFcfa-cell="{ row }">
          <span class="text-highlighted font-semibold tabular-nums">{{
            formatFcfa(row.original.totalFcfa)
          }}</span>
        </template>

        <template #empty>
          <div class="flex flex-col items-center gap-3 py-10 text-center">
            <UIcon name="i-lucide-ship" class="text-dimmed size-10" />
            <p class="text-muted">Aucune commande ne correspond à ces critères.</p>
            <UButton
              to="/achats/nouvelle"
              variant="soft"
              icon="i-lucide-plus"
              label="Créer une commande"
            />
          </div>
        </template>
      </UTable>
    </div>
  </PagePanel>
</template>
