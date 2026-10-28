<script setup lang="ts">
import { formatDate, formatFcfa } from "@G-stock/core/format";
import type { DropdownMenuItem, TableColumn } from "@nuxt/ui";
import { keepPreviousData, useQuery } from "@tanstack/vue-query";

import KpiCard from "~/components/common/KpiCard.vue";
import CustomerFormModal from "~/components/customers/CustomerFormModal.vue";
import ReceivableBadge from "~/components/customers/ReceivableBadge.vue";
import PagePanel from "~/components/layout/PagePanel.vue";
import PaymentModal from "~/components/sales/PaymentModal.vue";
import type { CustomerRow } from "~/types/api";

const icons = useIcons();

useHead({ title: "Clients" });

const SEARCH_DEBOUNCE_MS = 300;

const route = useRoute();
const { $orpc } = useNuxtApp();

const search = ref("");
const debouncedSearch = refDebounced(search, SEARCH_DEBOUNCE_MS);
// Lien « débiteurs » depuis le tableau de bord.
const withDebtOnly = ref(route.query.debiteurs !== undefined);

const customers = useQuery(
  computed(() => ({
    ...$orpc.customers.list.queryOptions({
      input: {
        search: debouncedSearch.value || null,
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
      to: { path: "/ventes/nouvelle", query: { client: customer.id } },
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

const rightAligned = { class: { td: "text-right", th: "text-right" } };
const columns: TableColumn<CustomerRow>[] = [
  { accessorKey: "name", header: "Client" },
  { accessorKey: "purchasedFcfa", header: "Achats", meta: rightAligned },
  { accessorKey: "lastSaleDate", header: "Dernier achat" },
  { accessorKey: "dueFcfa", header: "Solde", meta: rightAligned },
  { accessorKey: "receivableLevel", header: "Ancienneté" },
  { header: "", id: "actions", meta: rightAligned },
];
</script>

<template>
  <PagePanel id="customers" title="Clients" :icon="icons.customers">
    <template #actions>
      <UButton :icon="icons.customerAdd" label="Nouveau client" @click="openCreate" />
    </template>

    <template #toolbar>
      <div class="flex w-full flex-wrap items-center gap-2 py-1">
        <UInput
          v-model="search"
          :icon="icons.search"
          placeholder="Nom, téléphone, quartier…"
          class="w-full sm:w-72"
        />
        <USwitch v-model="withDebtOnly" label="Débiteurs uniquement" class="ms-auto" />
      </div>
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

      <UTable
        :data="customers.data.value ?? []"
        :columns="columns"
        :loading="customers.isFetching.value"
        class="border-default rounded-lg border"
      >
        <template #name-cell="{ row }">
          <NuxtLink :to="`/clients/${row.original.id}`" class="group block">
            <span class="text-highlighted font-medium group-hover:underline">{{
              row.original.name
            }}</span>
            <p v-if="row.original.phone || row.original.address" class="text-dimmed text-xs">
              {{ [row.original.phone, row.original.address].filter(Boolean).join(" · ") }}
            </p>
          </NuxtLink>
        </template>
        <template #purchasedFcfa-cell="{ row }">
          <span class="tabular-nums">{{ formatFcfa(row.original.purchasedFcfa) }}</span>
          <p class="text-dimmed text-xs">{{ row.original.saleCount }} vente(s)</p>
        </template>
        <template #lastSaleDate-cell="{ row }">
          <span :class="row.original.lastSaleDate ? '' : 'text-dimmed'">
            {{ row.original.lastSaleDate ? formatDate(row.original.lastSaleDate) : "—" }}
          </span>
        </template>
        <template #dueFcfa-cell="{ row }">
          <span v-if="row.original.dueFcfa > 0" class="text-warning font-semibold tabular-nums">
            {{ formatFcfa(row.original.dueFcfa) }}
          </span>
          <span v-else-if="row.original.creditFcfa > 0" class="text-success tabular-nums">
            Avoir {{ formatFcfa(row.original.creditFcfa) }}
          </span>
          <span v-else class="text-dimmed">—</span>
        </template>
        <template #receivableLevel-cell="{ row }">
          <ReceivableBadge
            v-if="row.original.receivableLevel && row.original.daysOverdue !== null"
            :level="row.original.receivableLevel"
            :days="row.original.daysOverdue"
          />
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
      </UTable>
    </div>

    <CustomerFormModal v-model:open="formOpen" :customer="editedCustomer" />
    <PaymentModal v-if="payingCustomer" v-model:open="paymentOpen" :customer="payingCustomer" />
  </PagePanel>
</template>
