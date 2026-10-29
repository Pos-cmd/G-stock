<script setup lang="ts">
import { formatDate, formatFcfa } from "@G-stock/core/format";
import type { DropdownMenuItem, TableColumn, TabsItem } from "@nuxt/ui";
import { keepPreviousData, useQuery } from "@tanstack/vue-query";

import PeriodTabs from "~/components/charts/PeriodTabs.vue";
import Sparkline from "~/components/charts/Sparkline.vue";
import TrendLegend from "~/components/charts/TrendLegend.vue";
import TrendValue from "~/components/charts/TrendValue.vue";
import DataTable from "~/components/common/DataTable.vue";
import KpiCard from "~/components/common/KpiCard.vue";
import CustomerFormModal from "~/components/customers/CustomerFormModal.vue";
import ReceivableBadge from "~/components/customers/ReceivableBadge.vue";
import PagePanel from "~/components/layout/PagePanel.vue";
import PaymentModal from "~/components/sales/PaymentModal.vue";
import type { CustomerRow } from "~/types/api";

const icons = useIcons();
const create = useCreateDialogs();

useHead({ title: "Clients" });

const route = useRoute();
const { $orpc } = useNuxtApp();

// Lien « débiteurs » depuis le tableau de bord et les alertes.
const withDebtOnly = ref(route.query.debiteurs !== undefined);
watch(
  () => route.query.debiteurs,
  (value) => {
    withDebtOnly.value = value !== undefined;
  },
);
const view = computed({
  get: () => (withDebtOnly.value ? "debtors" : "all"),
  set: (value: string) => {
    withDebtOnly.value = value === "debtors";
  },
});
const views: TabsItem[] = [
  { label: "Tous", value: "all" },
  { label: "Débiteurs", value: "debtors" },
];

const customers = useQuery(
  computed(() => ({
    ...$orpc.customers.list.queryOptions({
      input: {
        withDebtOnly: withDebtOnly.value,
      },
    }),
    placeholderData: keepPreviousData,
  })),
);

const totals = computed(() => {
  let dueFcfa = 0;
  let debtors = 0;
  let critical = 0;
  for (const customer of customers.data.value ?? []) {
    if (customer.dueFcfa > 0) {
      dueFcfa += customer.dueFcfa;
      debtors += 1;
    }
    if (customer.receivableLevel === "critical") {
      critical += 1;
    }
  }
  return { critical, debtors, dueFcfa };
});

const formOpen = ref(false);
const editedCustomer = ref<CustomerRow | null>(null);
const paymentOpen = ref(false);
const payingCustomer = ref<CustomerRow | null>(null);

const openCreate = () => {
  editedCustomer.value = null;
  formOpen.value = true;
};

const rowActions = (customer: CustomerRow): DropdownMenuItem[][] => [
  [
    {
      icon: icons.eye,
      label: "Voir la fiche",
      to: `/clients/${customer.id}`,
    },
    {
      icon: icons.sales,
      label: "Nouvelle vente",
      onSelect: () => create.openSale(customer.id),
    },
    {
      disabled: customer.dueFcfa <= 0,
      icon: icons.payment,
      label: "Encaisser",
      onSelect: () => {
        payingCustomer.value = customer;
        paymentOpen.value = true;
      },
    },
    {
      icon: icons.edit,
      label: "Modifier",
      onSelect: () => {
        editedCustomer.value = customer;
        formOpen.value = true;
      },
    },
  ],
];

// Achats de chaque client sur la période choisie, comparés à la précédente.
const weeks = ref<TrendPeriod>(13);
const trends = useQuery(
  computed(() => ({
    ...$orpc.sales.trends.queryOptions({ input: { by: "customer", weeks: weeks.value } }),
    placeholderData: keepPreviousData,
  })),
);
const trendsById = computed(() => new Map((trends.data.value ?? []).map((row) => [row.id, row])));

const rows = computed(() =>
  (customers.data.value ?? []).map((customer) => {
    const trend = trendsById.value.get(customer.id);
    const periodFcfa = sumOf(trend?.current ?? [], (value) => value);
    return {
      ...customer,
      periodCount: trend?.currentQty ?? 0,
      periodFcfa,
      periodTrend: trendRatio(
        periodFcfa,
        sumOf(trend?.previous ?? [], (value) => value),
      ),
      previous: trend?.previous ?? [],
      weekly: trend?.current ?? [],
    };
  }),
);
type Row = (typeof rows.value)[number];
const customerSearchText = (row: Row) =>
  `${row.name} ${row.phone ?? ""} ${row.address ?? ""} ${row.notes ?? ""}`;

const rightAligned = { class: { td: "text-right", th: "text-right" } };
const columns: TableColumn<Row>[] = [
  { accessorKey: "name", enableHiding: false, header: "Client" },
  { accessorKey: "periodFcfa", header: "Achats", meta: rightAligned },
  {
    enableSorting: false,
    header: "Tendance",
    id: "trend",
    meta: { class: { td: "w-36 min-w-28" } },
  },
  { accessorKey: "purchasedFcfa", header: "Depuis le début", meta: rightAligned },
  { accessorKey: "lastSaleDate", header: "Dernier achat", sortUndefined: "last" },
  { accessorKey: "dueFcfa", header: "Solde", meta: rightAligned },
  { enableHiding: false, header: "", id: "actions", meta: rightAligned },
];
</script>

<template>
  <PagePanel
    id="customers"
    title="Clients"
    description="Achats, solde et ancienneté des créances de chaque client."
  >
    <template #tabs>
      <UTabs v-model="view" :items="views" :content="false" />
    </template>
    <template #actions>
      <UButton :icon="icons.customerAdd" label="Nouveau client" @click="openCreate" />
    </template>

    <div class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Créances en cours"
          :icon="icons.pending"
          color="warning"
          :loading="customers.isPending.value"
          :value="formatFcfa(totals.dueFcfa)"
          :hint="`${totals.debtors} client(s) débiteur(s)`"
        />
        <KpiCard
          label="Créances critiques"
          :icon="icons.receivablesCritical"
          color="error"
          :loading="customers.isPending.value"
          :value="String(totals.critical)"
          hint="Seuil réglable dans les Paramètres"
        />
        <KpiCard
          label="Clients"
          :icon="icons.customers"
          color="neutral"
          :loading="customers.isPending.value"
          :value="String(customers.data.value?.length ?? 0)"
        />
      </div>

      <DataTable
        :data="rows"
        :columns="columns"
        :loading="customers.isFetching.value"
        :search-text="customerSearchText"
        search-placeholder="Nom, téléphone, quartier…"
        :initial-sorting="[{ desc: true, id: 'periodFcfa' }]"
        :item-label="['client', 'clients']"
        storage-key="customers"
      >
        <template #toolbar>
          <PeriodTabs v-model="weeks" />
        </template>

        <template #name-cell="{ row }">
          <NuxtLink :to="`/clients/${row.original.id}`" class="group block min-w-44">
            <span class="text-highlighted font-medium group-hover:underline">{{
              row.original.name
            }}</span>
            <p class="text-dimmed text-xs">
              {{ [row.original.phone, row.original.address].filter(Boolean).join(" · ") || "—" }}
            </p>
          </NuxtLink>
        </template>
        <template #periodFcfa-cell="{ row }">
          <template v-if="row.original.periodFcfa > 0">
            <TrendValue
              :value="formatFcfa(row.original.periodFcfa)"
              :ratio="row.original.periodTrend"
            />
            <p class="text-dimmed text-xs tabular-nums">
              {{ row.original.periodCount }} achat{{ row.original.periodCount > 1 ? "s" : "" }}
            </p>
          </template>
          <span v-else class="text-dimmed">Aucun achat</span>
        </template>
        <template #trend-cell="{ row }">
          <Sparkline
            v-if="row.original.weekly.length > 0"
            :values="row.original.weekly"
            :compare="row.original.previous"
          />
          <span v-else class="text-dimmed text-xs">—</span>
        </template>
        <template #purchasedFcfa-cell="{ row }">
          <span class="tabular-nums">{{ formatFcfa(row.original.purchasedFcfa) }}</span>
          <p class="text-dimmed text-xs tabular-nums">
            {{ row.original.saleCount }} vente{{ row.original.saleCount > 1 ? "s" : "" }}
          </p>
        </template>
        <template #lastSaleDate-cell="{ row }">
          <template v-if="row.original.lastSaleDate">
            <span>{{ formatDaysAgo(row.original.lastSaleDate) }}</span>
            <p class="text-dimmed text-xs">{{ formatDate(row.original.lastSaleDate) }}</p>
          </template>
          <span v-else class="text-dimmed">—</span>
        </template>
        <template #dueFcfa-cell="{ row }">
          <div class="flex flex-col items-end gap-1">
            <span v-if="row.original.dueFcfa > 0" class="text-warning font-semibold tabular-nums">
              {{ formatFcfa(row.original.dueFcfa) }}
            </span>
            <span v-else-if="row.original.creditFcfa > 0" class="text-success tabular-nums">
              Avoir {{ formatFcfa(row.original.creditFcfa) }}
            </span>
            <span v-else class="text-dimmed">À jour</span>
            <ReceivableBadge
              v-if="row.original.receivableLevel && row.original.daysOverdue !== null"
              :level="row.original.receivableLevel"
              :days="row.original.daysOverdue"
            />
          </div>
        </template>
        <template #actions-cell="{ row }">
          <UDropdownMenu :items="rowActions(row.original)" :content="{ align: 'end' }">
            <UButton
              :icon="icons.moreActions"
              color="neutral"
              variant="ghost"
              :aria-label="`Actions pour ${row.original.name}`"
            />
          </UDropdownMenu>
        </template>
        <template #empty>
          <div class="flex flex-col items-center gap-3 py-10 text-center">
            <UIcon :name="icons.customers" class="text-dimmed size-10" />
            <p class="text-muted">
              {{ withDebtOnly ? "Aucun client ne doit d'argent." : "Aucun client ne correspond." }}
            </p>
            <UButton
              variant="soft"
              :icon="icons.customerAdd"
              label="Ajouter un client"
              @click="openCreate"
            />
          </div>
        </template>
        <template #footer>
          <TrendLegend :weeks="weeks" />
        </template>
      </DataTable>
    </div>

    <CustomerFormModal v-model:open="formOpen" :customer="editedCustomer" />
    <PaymentModal v-if="payingCustomer" v-model:open="paymentOpen" :customer="payingCustomer" />
  </PagePanel>
</template>
