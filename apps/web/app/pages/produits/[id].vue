<script setup lang="ts">
import { rmbToFcfa } from "@G-stock/core/currency";
import { formatDate, formatFcfa, formatQty, formatRmb } from "@G-stock/core/format";
import { LOT_SOURCE_LABELS } from "@G-stock/core/labels";
import type { TableColumn, TabsItem } from "@nuxt/ui";
import { useMutation, useQuery } from "@tanstack/vue-query";

import SalesInsights from "~/components/charts/SalesInsights.vue";
import KpiCard from "~/components/common/KpiCard.vue";
import PagePanel from "~/components/layout/PagePanel.vue";
import ProductFormModal from "~/components/products/ProductFormModal.vue";
import StockStatusBadge from "~/components/products/StockStatusBadge.vue";
import LotAdjustModal from "~/components/stock/LotAdjustModal.vue";
import LotEntryModal from "~/components/stock/LotEntryModal.vue";
import MovementsTable from "~/components/stock/MovementsTable.vue";
import UnpackModal from "~/components/stock/UnpackModal.vue";
import { useSettingsStore } from "~/stores/settings";
import type { StockLot } from "~/types/api";

const icons = useIcons();

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

// Coût de revient de chaque lot reçu (lots épuisés compris), face au prix de vente conseillé.
const allLots = useQuery(
  computed(() =>
    $orpc.stock.lots.list.queryOptions({
      input: { includeEmpty: true, productId: productId.value },
    }),
  ),
);
const costHistory = computed(() =>
  (allLots.data.value ?? [])
    .toSorted((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime())
    .map((lot) => ({
      cout: lot.unitCostFcfa,
      label: formatDate(lot.receivedAt),
      prix: product.data.value?.suggestedSalePriceFcfa ?? 0,
    })),
);

// Un jour du calendrier d'activité : les ventes de ce produit ce jour-là.
const openSalesDay = (date: string) =>
  navigateTo({ path: "/ventes", query: { au: date, du: date, produit: productId.value } });

const STOCK_COLORS = { low: "warning", ok: "success", out: "error" } as const;
const stockColor = computed(() => STOCK_COLORS[product.data.value?.status ?? "ok"]);

const isArchived = computed(() => Boolean(product.data.value?.archivedAt));
const subtitle = computed(() => {
  const data = product.data.value;
  return data
    ? [data.reference, data.category, `vendu à l'${data.unit}`].filter(Boolean).join(" · ")
    : undefined;
});

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
const unpackOpen = ref(false);
const canUnpack = computed(() => {
  const data = product.data.value;
  return Boolean(data?.piecesPerUnit && data.stockQty >= 1 && !data.archivedAt);
});
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
  { label: "Lots", slot: "lots" },
  { label: "Mouvements", slot: "movements" },
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
    :description="subtitle"
    :icon="icons.product"
    :parents="[{ label: 'Produits', to: '/produits' }]"
  >
    <template v-if="product.data.value" #badges>
      <StockStatusBadge :status="product.data.value.status" />
      <UBadge v-if="isArchived" color="neutral" variant="outline" size="sm" label="Archivé" />
    </template>
    <template #actions>
      <UFieldGroup>
        <UButton
          color="neutral"
          variant="outline"
          :icon="isArchived ? icons.unarchive : icons.archive"
          :label="isArchived ? 'Restaurer' : 'Archiver'"
          :disabled="!product.data.value"
          @click="toggleArchive"
        />
        <UButton
          color="neutral"
          variant="outline"
          :icon="icons.edit"
          label="Modifier"
          :disabled="!product.data.value"
          @click="formOpen = true"
        />
        <UButton
          v-if="product.data.value?.piecesPerUnit"
          color="neutral"
          variant="outline"
          :icon="icons.unpack"
          :label="`Ouvrir des ${product.data.value.unit}s`"
          :disabled="!canUnpack"
          @click="unpackOpen = true"
        />
      </UFieldGroup>
      <UButton
        :icon="icons.stockEntry"
        label="Entrée de stock"
        :disabled="!product.data.value || isArchived"
        @click="entryOpen = true"
      />
    </template>

    <UAlert
      v-if="product.isError.value"
      color="error"
      variant="subtle"
      :icon="icons.error"
      title="Produit introuvable"
      :description="product.error.value?.message"
    />

    <div v-else class="space-y-6">
      <UAlert
        v-if="isArchived"
        color="neutral"
        variant="subtle"
        :icon="icons.archive"
        title="Produit archivé"
        description="Il n'apparaît plus dans les listes et son stock ne peut plus être mouvementé."
      />

      <div
        v-if="product.data.value?.pieceProduct || product.data.value?.packProducts.length"
        class="bg-elevated/50 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-3 py-2 text-sm"
      >
        <UIcon :name="icons.unpack" class="text-muted size-4" />
        <template v-if="product.data.value.pieceProduct">
          <span class="text-muted">
            {{ product.data.value.piecesPerUnit }} pièces par {{ product.data.value.unit }}, vendues
            au détail sous
          </span>
          <ULink
            :to="`/produits/${product.data.value.pieceProduct.id}`"
            class="text-highlighted font-medium"
          >
            {{ product.data.value.pieceProduct.name }}
          </ULink>
        </template>
        <template v-for="pack in product.data.value.packProducts" :key="pack.id">
          <span class="text-muted">Pièces issues de l'ouverture de</span>
          <ULink :to="`/produits/${pack.id}`" class="text-highlighted font-medium">
            {{ pack.name }}
          </ULink>
          <span class="text-dimmed">({{ pack.piecesPerUnit }} par {{ pack.unit }})</span>
        </template>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Stock disponible"
          :icon="icons.stock"
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
          :icon="icons.stockValue"
          :loading="product.isPending.value"
          :value="formatFcfa(product.data.value?.stockValueFcfa ?? 0)"
          hint="Au coût de revient des lots"
        />
        <KpiCard
          label="Coût moyen pondéré"
          :icon="icons.averageCost"
          color="neutral"
          :loading="product.isPending.value"
          :value="
            product.data.value?.stockQty ? formatFcfa(product.data.value.averageCostFcfa) : '—'
          "
          :hint="product.data.value ? `par ${product.data.value.unit}` : ''"
        />
        <KpiCard
          label="Prix de vente conseillé"
          :icon="icons.price"
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

      <SalesInsights
        :product-id="productId"
        :unit="product.data.value?.unit ?? ''"
        :stock-qty="product.data.value?.stockQty ?? null"
        @select="openSalesDay"
      />

      <UPageCard
        v-if="costHistory.length > 1"
        title="Coût de revient des lots"
        description="Coût unitaire de chaque lot reçu (marchandise et frais d'approche), face au prix de vente conseillé."
        variant="subtle"
      >
        <UChart
          type="line"
          :data="costHistory"
          index="label"
          :categories="[
            { key: 'cout', label: 'Coût de revient', color: 'var(--ui-chart-1)' },
            { key: 'prix', label: 'Prix de vente conseillé', color: 'var(--ui-chart-2)' },
          ]"
          curve="monotone"
          :points="true"
          :height="220"
          :format="formatFcfa"
          aria-label="Évolution du coût de revient des lots"
        />
      </UPageCard>

      <UTabs :items="tabs">
        <template #lots>
          <div class="space-y-3 pt-2">
            <USwitch v-model="showEmptyLots" label="Afficher les lots épuisés" />
            <UTable
              :data="lots.data.value ?? []"
              :columns="lotColumns"
              :loading="lots.isFetching.value"
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
                  :icon="icons.stockAdjust"
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
                    :icon="icons.stockEntry"
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

    <UnpackModal
      v-if="product.data.value"
      v-model:open="unpackOpen"
      :product="product.data.value"
    />
    <ProductFormModal v-model:open="formOpen" :product="product.data.value ?? null" />
    <LotEntryModal v-model:open="entryOpen" :product="product.data.value ?? null" />
    <LotAdjustModal
      v-model:open="adjustOpen"
      :lot="adjustedLot"
      :unit="product.data.value?.unit ?? ''"
    />
  </PagePanel>
</template>
