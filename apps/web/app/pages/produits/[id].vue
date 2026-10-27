<script setup lang="ts">
import { rmbToFcfa } from "@G-stock/core/currency";
import { formatDate, formatFcfa, formatQty, formatRmb } from "@G-stock/core/format";
import { LOT_SOURCE_LABELS } from "@G-stock/core/labels";
import type { TableColumn, TabsItem } from "@nuxt/ui";
import { useMutation, useQuery } from "@tanstack/vue-query";

import KpiCard from "~/components/common/KpiCard.vue";
import PagePanel from "~/components/layout/PagePanel.vue";
import ProductFormModal from "~/components/products/ProductFormModal.vue";
import StockStatusBadge from "~/components/products/StockStatusBadge.vue";
import LotAdjustModal from "~/components/stock/LotAdjustModal.vue";
import LotEntryModal from "~/components/stock/LotEntryModal.vue";
import MovementsTable from "~/components/stock/MovementsTable.vue";
import { useSettingsStore } from "~/stores/settings";
import type { StockLot } from "~/types/api";

const route = useRoute();
const productId = computed(() => String(route.params.id));

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidateStock = useInvalidateStock();
const settingsStore = useSettingsStore();

onMounted(async () => {
  await settingsStore.load();
});

const product = useQuery(
  computed(() => $orpc.products.get.queryOptions({ input: { id: productId.value } })),
);
const showEmptyLots = ref(false);
const lots = useQuery(
  computed(() =>
    $orpc.stock.lots.list.queryOptions({
      input: { includeEmpty: showEmptyLots.value, productId: productId.value },
    }),
  ),
);

useHead({ title: () => product.data.value?.name ?? "Produit" });

const STOCK_COLORS = { low: "warning", ok: "success", out: "error" } as const;
const stockColor = computed(() => STOCK_COLORS[product.data.value?.status ?? "ok"]);

const isArchived = computed(() => Boolean(product.data.value?.archivedAt));

const unitMargin = computed(() => {
  const data = product.data.value;
  if (!data?.suggestedSalePriceFcfa || data.stockQty <= 0) {
    return null;
  }
  const amount = data.suggestedSalePriceFcfa - data.averageCostFcfa;
  return { amount, rate: amount / data.suggestedSalePriceFcfa };
});

const percentFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  style: "percent",
});

const formOpen = ref(false);
const entryOpen = ref(false);
const adjustOpen = ref(false);
const adjustedLot = ref<StockLot | null>(null);

const openAdjust = (lot: StockLot) => {
  adjustedLot.value = lot;
  adjustOpen.value = true;
};

const archiveMutation = useMutation($orpc.products.archive.mutationOptions());
const restoreMutation = useMutation($orpc.products.restore.mutationOptions());

const toggleArchive = async () => {
  try {
    if (isArchived.value) {
      await restoreMutation.mutateAsync({ id: productId.value });
      notify.success("Produit restauré");
    } else {
      await archiveMutation.mutateAsync({ id: productId.value });
      notify.success("Produit archivé");
    }
    await invalidateStock();
  } catch (error) {
    notify.error("Opération impossible", error);
  }
};

const tabs: TabsItem[] = [
  { icon: "i-lucide-layers", label: "Lots", slot: "lots" },
  { icon: "i-lucide-history", label: "Mouvements", slot: "movements" },
];

const rightAligned = { class: { td: "text-right", th: "text-right" } };
const lotColumns: TableColumn<StockLot>[] = [
  { accessorKey: "lotCode", header: "Lot" },
  { accessorKey: "receivedAt", header: "Réception" },
  { accessorKey: "source", header: "Origine" },
  { accessorKey: "qtyInitial", header: "Qté initiale", meta: rightAligned },
  { accessorKey: "qtyRemaining", header: "Qté restante", meta: rightAligned },
  { accessorKey: "unitCostFcfa", header: "Coût unitaire", meta: rightAligned },
  { header: "Valeur", id: "value", meta: rightAligned },
  { header: "", id: "actions", meta: rightAligned },
];
</script>

<template>
  <PagePanel
    id="product-detail"
    :title="product.data.value?.name ?? 'Produit'"
    icon="i-lucide-package"
  >
    <template #actions>
      <UButton
        to="/produits"
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        label="Produits"
      />
      <UButton
        color="neutral"
        variant="outline"
        :icon="isArchived ? 'i-lucide-archive-restore' : 'i-lucide-archive'"
        :label="isArchived ? 'Restaurer' : 'Archiver'"
        :disabled="!product.data.value"
        @click="toggleArchive"
      />
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-pencil"
        label="Modifier"
        :disabled="!product.data.value"
        @click="formOpen = true"
      />
      <UButton
        icon="i-lucide-package-plus"
        label="Entrée de stock"
        :disabled="!product.data.value || isArchived"
        @click="entryOpen = true"
      />
    </template>

    <UAlert
      v-if="product.isError.value"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Produit introuvable"
      :description="product.error.value?.message"
    />

    <div v-else class="space-y-6">
      <UAlert
        v-if="isArchived"
        color="neutral"
        variant="subtle"
        icon="i-lucide-archive"
        title="Produit archivé"
        description="Il n'apparaît plus dans les listes et son stock ne peut plus être mouvementé."
      />

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Stock disponible"
          icon="i-lucide-boxes"
          :loading="product.isPending.value"
          :value="
            product.data.value
              ? formatQty(product.data.value.stockQty, product.data.value.unit)
              : ''
          "
          :hint="
            product.data.value
              ? `Seuil d'alerte : ${formatQty(product.data.value.alertThreshold, product.data.value.unit)}`
              : ''
          "
          :color="stockColor"
        />
        <KpiCard
          label="Valeur du stock"
          icon="i-lucide-wallet"
          :loading="product.isPending.value"
          :value="formatFcfa(product.data.value?.stockValueFcfa ?? 0)"
          hint="Au coût de revient des lots"
        />
        <KpiCard
          label="Coût moyen pondéré"
          icon="i-lucide-scale"
          color="neutral"
          :loading="product.isPending.value"
          :value="
            product.data.value?.stockQty ? formatFcfa(product.data.value.averageCostFcfa) : '—'
          "
          :hint="product.data.value ? `par ${product.data.value.unit}` : ''"
        />
        <KpiCard
          label="Prix de vente conseillé"
          icon="i-lucide-tag"
          color="primary"
          :loading="product.isPending.value"
          :value="
            product.data.value?.suggestedSalePriceFcfa
              ? formatFcfa(product.data.value.suggestedSalePriceFcfa)
              : '—'
          "
          :hint="
            unitMargin
              ? `Marge estimée : ${formatFcfa(unitMargin.amount)} (${percentFormatter.format(unitMargin.rate)})`
              : ''
          "
        />
      </div>

      <UPageCard v-if="product.data.value" variant="subtle" title="Informations">
        <dl class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt class="text-muted">Statut</dt>
            <dd class="mt-1">
              <StockStatusBadge :status="product.data.value.status" />
            </dd>
          </div>
          <div>
            <dt class="text-muted">Catégorie</dt>
            <dd class="text-highlighted mt-1">
              {{ product.data.value.category ?? "—" }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">Référence</dt>
            <dd class="text-highlighted mt-1">
              {{ product.data.value.reference ?? "—" }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">Prix d'achat de référence</dt>
            <dd class="text-highlighted mt-1">
              <template v-if="product.data.value.referencePriceRmb">
                {{ formatRmb(product.data.value.referencePriceRmb) }}
                <span class="text-muted">
                  ≈
                  {{
                    formatFcfa(rmbToFcfa(product.data.value.referencePriceRmb, settingsStore.rates))
                  }}
                </span>
              </template>
              <template v-else>—</template>
            </dd>
          </div>
          <div v-if="product.data.value.notes" class="sm:col-span-2 lg:col-span-4">
            <dt class="text-muted">Notes</dt>
            <dd class="text-highlighted mt-1 whitespace-pre-line">
              {{ product.data.value.notes }}
            </dd>
          </div>
        </dl>
      </UPageCard>

      <UTabs :items="tabs" variant="link" class="w-full">
        <template #lots>
          <div class="space-y-3 pt-2">
            <USwitch v-model="showEmptyLots" label="Afficher les lots épuisés" />
            <UTable
              :data="lots.data.value ?? []"
              :columns="lotColumns"
              :loading="lots.isFetching.value"
              class="border-default rounded-lg border"
            >
              <template #lotCode-cell="{ row }">
                <span class="font-mono text-xs">{{ row.original.lotCode }}</span>
                <p v-if="row.original.notes" class="text-dimmed line-clamp-1 max-w-56 text-xs">
                  {{ row.original.notes }}
                </p>
              </template>
              <template #receivedAt-cell="{ row }">
                {{ formatDate(row.original.receivedAt) }}
              </template>
              <template #source-cell="{ row }">
                <ULink
                  v-if="row.original.orderId"
                  :to="`/achats/${row.original.orderId}`"
                  class="font-mono text-xs"
                >
                  {{ row.original.orderReference }}
                </ULink>
                <span v-else class="text-muted">{{ LOT_SOURCE_LABELS[row.original.source] }}</span>
              </template>
              <template #qtyInitial-cell="{ row }">
                <span class="text-muted tabular-nums">{{
                  formatQty(row.original.qtyInitial)
                }}</span>
              </template>
              <template #qtyRemaining-cell="{ row }">
                <span
                  class="font-medium tabular-nums"
                  :class="row.original.qtyRemaining > 0 ? '' : 'text-dimmed'"
                >
                  {{ formatQty(row.original.qtyRemaining, product.data.value?.unit) }}
                </span>
              </template>
              <template #unitCostFcfa-cell="{ row }">
                <span class="tabular-nums">{{ formatFcfa(row.original.unitCostFcfa) }}</span>
              </template>
              <template #value-cell="{ row }">
                <span class="font-medium tabular-nums">
                  {{ formatFcfa(row.original.qtyRemaining * row.original.unitCostFcfa) }}
                </span>
              </template>
              <template #actions-cell="{ row }">
                <UButton
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-sliders-horizontal"
                  label="Ajuster"
                  :disabled="isArchived"
                  @click="openAdjust(row.original)"
                />
              </template>
              <template #empty>
                <div class="flex flex-col items-center gap-3 py-8 text-center">
                  <p class="text-muted">Aucun lot en stock pour ce produit.</p>
                  <UButton
                    variant="soft"
                    icon="i-lucide-package-plus"
                    label="Enregistrer une entrée"
                    :disabled="isArchived"
                    @click="entryOpen = true"
                  />
                </div>
              </template>
            </UTable>
          </div>
        </template>

        <template #movements>
          <div class="pt-2">
            <MovementsTable :filters="{ productId }" :show-product="false" />
          </div>
        </template>
      </UTabs>
    </div>

    <ProductFormModal v-model:open="formOpen" :product="product.data.value ?? null" />
    <LotEntryModal v-model:open="entryOpen" :product="product.data.value ?? null" />
    <LotAdjustModal
      v-model:open="adjustOpen"
      :lot="adjustedLot"
      :unit="product.data.value?.unit ?? ''"
    />
  </PagePanel>
</template>
