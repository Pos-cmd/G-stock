<script setup lang="ts">
import { formatDate, formatFcfa, formatQty } from "@G-stock/core/format";
import type { TableColumn } from "@nuxt/ui";
import { useQuery } from "@tanstack/vue-query";

import DataTable from "~/components/common/DataTable.vue";
import KpiCard from "~/components/common/KpiCard.vue";
import PagePanel from "~/components/layout/PagePanel.vue";
import PurchaseStatusBadge from "~/components/purchases/PurchaseStatusBadge.vue";
import SupplierFormModal from "~/components/purchases/SupplierFormModal.vue";
import type { SupplierDetail } from "~/types/api";

const icons = useIcons();
const route = useRoute();
const { $orpc } = useNuxtApp();
const create = useCreateDialogs();

const supplierId = computed(() => String(route.params.id));
const supplier = useQuery(
  computed(() => $orpc.suppliers.get.queryOptions({ input: { id: supplierId.value } })),
);
const data = computed(() => supplier.data.value);

useHead({ title: computed(() => data.value?.name ?? "Fournisseur") });

const formOpen = ref(false);

const subtitle = computed(() =>
  data.value
    ? [data.value.country, data.value.contact, data.value.phone].filter(Boolean).join(" · ")
    : undefined,
);

// Achats mois par mois : barres et courbe de la carte « Total acheté ».
const monthly = computed(() =>
  (data.value?.monthly ?? []).map((month) => ({
    label: formatMonthLabel(month.month),
    orders: month.orderCount,
    total: month.totalFcfa,
  })),
);
const last12Total = computed(() => sumOf(monthly.value, (month) => month.total));

// Répartition des achats par produit : les cinq premiers, le reste regroupé.
const TOP_PRODUCTS = 5;
const productShare = computed(() => {
  const rows = data.value?.products ?? [];
  const top = rows.slice(0, TOP_PRODUCTS).map((product) => ({
    name: product.productName,
    total: product.totalCostFcfa,
  }));
  const others = sumOf(rows.slice(TOP_PRODUCTS), (product) => product.totalCostFcfa);
  return others > 0 ? [...top, { name: "Autres produits", total: others }] : top;
});

const plural = (value: number, word: string) => `${value} ${word}${value > 1 ? "s" : ""}`;

type ProductRow = SupplierDetail["products"][number];
type OrderRow = SupplierDetail["orders"][number];
const rightAligned = { class: { td: "text-right", th: "text-right" } };
const productColumns: TableColumn<ProductRow>[] = [
  { accessorKey: "productName", header: "Produit" },
  { accessorKey: "qty", header: "Quantité achetée", meta: rightAligned },
  { accessorKey: "orderCount", header: "Commandes", meta: rightAligned },
  {
    accessorKey: "lastUnitCostFcfa",
    header: "Dernier coût",
    meta: rightAligned,
  },
  {
    accessorKey: "averageUnitCostFcfa",
    header: "Coût moyen",
    meta: rightAligned,
  },
  { accessorKey: "totalCostFcfa", header: "Total", meta: rightAligned },
  { accessorKey: "lastOrderDate", header: "Dernier achat" },
];
const orderColumns: TableColumn<OrderRow>[] = [
  { accessorKey: "reference", header: "Commande" },
  { accessorKey: "orderDate", header: "Date" },
  { accessorKey: "status", header: "Statut" },
  { accessorKey: "itemCount", header: "Lignes", meta: rightAligned },
  { accessorKey: "totalFcfa", header: "Prix de revient", meta: rightAligned },
  { header: "Reste à payer", id: "remaining", meta: rightAligned },
];
</script>

<template>
  <PagePanel
    id="supplier-detail"
    :title="data?.name ?? 'Fournisseur'"
    :description="subtitle"
    :parents="[{ label: 'Fournisseurs', to: '/achats/fournisseurs' }]"
  >
    <template #leading>
      <UAvatar :alt="data?.name ?? 'Fournisseur'" size="xl" class="ring-default ring" />
    </template>
    <template v-if="data && data.stats.unpaidOrderCount > 0" #badges>
      <UBadge color="warning" variant="subtle" size="sm" :icon="icons.pending">
        {{ plural(data.stats.unpaidOrderCount, "commande") }} à solder
      </UBadge>
    </template>
    <template #actions>
      <UButton
        color="neutral"
        variant="outline"
        :icon="icons.edit"
        label="Modifier"
        :disabled="!data"
        @click="formOpen = true"
      />
      <UButton
        :icon="icons.plus"
        label="Nouvelle commande"
        @click="create.openPurchase(supplierId)"
      />
    </template>

    <UAlert
      v-if="supplier.isError.value"
      color="error"
      variant="subtle"
      :icon="icons.error"
      title="Fournisseur introuvable"
      :description="supplier.error.value?.message"
    />

    <div v-else class="space-y-6">
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Acheté sur 12 mois"
          :loading="supplier.isPending.value"
          :value="formatFcfa(last12Total)"
          :series="monthly.map((month) => ({ label: month.label, value: month.total }))"
          :format="formatFcfa"
          :hint="`Depuis le début : ${formatFcfa(data?.stats.totalFcfa ?? 0)}`"
        />
        <KpiCard
          label="Reste à payer"
          :icon="icons.supplierPayment"
          :color="(data?.stats.remainingFcfa ?? 0) > 0 ? 'warning' : 'success'"
          :loading="supplier.isPending.value"
          :value="formatFcfa(data?.stats.remainingFcfa ?? 0)"
          :hint="`Déjà versé : ${formatFcfa(data?.stats.paidFcfa ?? 0)}`"
        />
        <KpiCard
          label="Commandes"
          :icon="icons.purchases"
          color="neutral"
          :loading="supplier.isPending.value"
          :value="String(data?.stats.committedCount ?? 0)"
          :hint="
            data?.stats.firstOrderDate
              ? `Depuis le ${formatDate(data.stats.firstOrderDate)}`
              : 'Aucune commande passée'
          "
        />
        <KpiCard
          label="Délai de livraison moyen"
          :icon="icons.reception"
          color="neutral"
          :loading="supplier.isPending.value"
          :value="
            data?.stats.averageLeadDays === null || data?.stats.averageLeadDays === undefined
              ? '—'
              : plural(data.stats.averageLeadDays, 'jour')
          "
          hint="De la commande à la réception"
        />
      </div>

      <div class="grid gap-6 lg:grid-cols-3">
        <UPageCard
          title="Achats par mois"
          description="Prix de revient des commandes engagées, sur les 12 derniers mois."
          variant="subtle"
          class="lg:col-span-2"
        >
          <UChart
            type="bar"
            :data="monthly"
            index="label"
            :categories="[{ key: 'total', label: 'Achats' }]"
            :height="240"
            :format="formatCompact"
            aria-label="Achats auprès du fournisseur, mois par mois"
          />
        </UPageCard>
        <UPageCard
          title="Répartition par produit"
          description="Part de chaque produit dans le total acheté."
          variant="subtle"
        >
          <p v-if="productShare.length === 0" class="text-muted text-sm">
            Aucun produit acheté pour l'instant.
          </p>
          <UChart
            v-else
            type="donut"
            :data="productShare"
            index="name"
            :categories="['total']"
            :height="240"
            :thickness="22"
            :format="formatFcfa"
            aria-label="Répartition des achats par produit"
          >
            <template #center>
              <span class="text-highlighted text-lg font-semibold tabular-nums">
                {{ formatCompact(data?.stats.totalFcfa ?? 0) }}
              </span>
              <span class="text-muted text-xs">FCFA au total</span>
            </template>
          </UChart>
        </UPageCard>
      </div>

      <DataTable
        title="Produits achetés"
        description="Quantités reçues (ou commandées) et coût de revient unitaire, frais compris."
        search-placeholder="Produit…"
        :initial-sorting="[{ desc: true, id: 'totalCostFcfa' }]"
        :item-label="['produit', 'produits']"
        storage-key="supplier-products"
        :data="data?.products ?? []"
        :columns="productColumns"
        :loading="supplier.isFetching.value"
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
          <span class="tabular-nums">{{ formatQty(row.original.qty, row.original.unit) }}</span>
        </template>
        <template #lastUnitCostFcfa-cell="{ row }">
          <span class="tabular-nums">{{ formatFcfa(row.original.lastUnitCostFcfa) }}</span>
        </template>
        <template #averageUnitCostFcfa-cell="{ row }">
          <span class="text-muted tabular-nums">{{
            formatFcfa(row.original.averageUnitCostFcfa)
          }}</span>
        </template>
        <template #totalCostFcfa-cell="{ row }">
          <span class="text-highlighted font-medium tabular-nums">{{
            formatFcfa(row.original.totalCostFcfa)
          }}</span>
        </template>
        <template #lastOrderDate-cell="{ row }">
          <span class="text-muted">{{ formatDate(row.original.lastOrderDate) }}</span>
        </template>
        <template #empty>
          <p class="text-muted py-6 text-center">Aucun produit acheté chez ce fournisseur.</p>
        </template>
      </DataTable>

      <DataTable
        title="Commandes"
        search-placeholder="Référence…"
        :item-label="['commande', 'commandes']"
        storage-key="supplier-orders"
        :data="data?.orders ?? []"
        :columns="orderColumns"
        :loading="supplier.isFetching.value"
      >
        <template #reference-cell="{ row }">
          <NuxtLink
            :to="`/achats/${row.original.id}`"
            class="text-highlighted font-mono text-[13px] font-medium hover:underline"
          >
            {{ row.original.reference }}
          </NuxtLink>
        </template>
        <template #orderDate-cell="{ row }">
          <span class="text-muted">{{ formatDate(row.original.orderDate) }}</span>
        </template>
        <template #status-cell="{ row }">
          <PurchaseStatusBadge :status="row.original.status" />
        </template>
        <template #totalFcfa-cell="{ row }">
          <span class="tabular-nums">{{ formatFcfa(row.original.totalFcfa) }}</span>
        </template>
        <template #remaining-cell="{ row }">
          <span
            v-if="
              !['cancelled', 'draft'].includes(row.original.status) && !row.original.payment.isPaid
            "
            class="text-warning font-medium tabular-nums"
          >
            ≈ {{ formatFcfa(row.original.payment.remainingFcfa) }}
          </span>
          <span v-else class="text-dimmed">—</span>
        </template>
        <template #empty>
          <div class="flex flex-col items-center gap-3 py-8 text-center">
            <p class="text-muted">Aucune commande chez ce fournisseur.</p>
            <UButton
              variant="soft"
              :icon="icons.plus"
              label="Créer une commande"
              @click="create.openPurchase(supplierId)"
            />
          </div>
        </template>
      </DataTable>
    </div>

    <SupplierFormModal v-model:open="formOpen" :supplier="data" />
  </PagePanel>
</template>
