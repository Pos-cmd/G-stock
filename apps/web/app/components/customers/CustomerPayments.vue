<script setup lang="ts">
import { PAYMENT_METHODS } from "@G-stock/core/enums";
import type { PaymentMethod } from "@G-stock/core/enums";
import { formatFcfa } from "@G-stock/core/format";
import { PAYMENT_METHOD_LABELS } from "@G-stock/core/labels";
import type { DropdownMenuItem, TableColumn } from "@nuxt/ui";
import { useMutation, useQuery } from "@tanstack/vue-query";

import ActivityHeatmap from "~/components/charts/ActivityHeatmap.vue";
import DataTable from "~/components/common/DataTable.vue";
import DateRangeField from "~/components/common/DateRangeField.vue";
import ReasonDialog from "~/components/common/ReasonDialog.vue";
import type { PaymentLedgerDay } from "~/types/api";

/**
 * Paiements d'un client, jour par jour : combien il a encaissé, par quels moyens, et quelles
 * ventes cela a soldées. L'agrégation est faite par le serveur (un client de passage peut avoir
 * des milliers de paiements) ; les filtres de période et de moyen agissent sur ce relevé.
 */
const { customerId, dueFcfa = 0 } = defineProps<{
  customerId: string;
  /** Reste dû du client, rappelé parmi les chiffres. */
  dueFcfa?: number;
}>();

const icons = useIcons();
const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidateSales = useInvalidateSales();

const ALL = "all";
/** Fenêtre demandée au serveur : elle borne le calendrier et le relevé. */
const windowMonths = ref(12);
const windowItems = [6, 12, 24].map((months) => ({
  label: `${months} mois`,
  value: months,
}));

const ledger = useQuery(
  computed(() =>
    $orpc.payments.ledger.queryOptions({
      input: { customerId, months: windowMonths.value },
    })
  )
);
const data = computed(() => ledger.data.value);

// Filtres, appliqués au relevé déjà agrégé
const method = ref<PaymentMethod | typeof ALL>(ALL);
const showCancelled = ref(false);
const from = ref("");
const to = ref("");

const methodItems = [
  { label: "Tous les moyens", value: ALL },
  ...PAYMENT_METHODS.map((value) => ({
    label: PAYMENT_METHOD_LABELS[value],
    value,
  })),
];

const methodLabel = (value: string): string =>
  PAYMENT_METHOD_LABELS[value as PaymentMethod];

const days = computed<PaymentLedgerDay[]>(() =>
  (data.value?.days ?? []).filter((day) => {
    if (!showCancelled.value && day.paidFcfa === 0) {
      return false;
    }
    if (method.value !== ALL && !day.methods.includes(method.value)) {
      return false;
    }
    return (
      (!from.value || day.date >= from.value) &&
      (!to.value || day.date <= to.value)
    );
  })
);

const totals = computed(() => ({
  cancelledFcfa: sumOf(days.value, (day) => day.cancelledFcfa),
  count: sumOf(
    days.value,
    (day) => day.payments.filter((payment) => !payment.cancelledAt).length
  ),
  paidFcfa: sumOf(days.value, (day) => day.paidFcfa),
}));

const today = toDateInputValue();
const currentYear = String(new Date().getFullYear());

const heatmapDays = computed(() =>
  (data.value?.heatmap ?? []).map((day) => ({
    date: day.date,
    value: day.value,
  }))
);
const paidByDay = computed(
  () => new Map((data.value?.heatmap ?? []).map((day) => [day.date, day]))
);
const describeDay = (date: string) => {
  const entry = paidByDay.value.get(date);
  if (!entry || entry.count === 0) {
    return "aucun paiement";
  }
  return `${entry.count} paiement${entry.count > 1 ? "s" : ""} · ${formatFcfa(entry.value)}`;
};
const heatmapSummary = computed(() => {
  const entries = data.value?.heatmap ?? [];
  const count = sumOf(entries, (day) => day.count);
  return count === 0
    ? "Aucun paiement sur la période."
    : `${count} paiement${count > 1 ? "s" : ""} · ${formatFcfa(
        sumOf(entries, (day) => day.value)
      )}`;
});

const table = useTemplateRef("table");
const openPaymentDay = (date: string) => {
  from.value = date;
  to.value = date;
  table.value?.scrollIntoView({ behavior: "smooth", block: "start" });
};

const hasFilters = computed(
  () =>
    method.value !== ALL ||
    from.value !== "" ||
    to.value !== "" ||
    showCancelled.value
);
const activeFilters = computed(
  () =>
    [from.value || to.value, method.value !== ALL, showCancelled.value].filter(
      Boolean
    ).length
);
const resetFilters = () => {
  method.value = ALL;
  from.value = "";
  to.value = "";
  showCancelled.value = false;
};

// Annulation : le menu d'un jour liste ses paiements
const cancelledPaymentId = ref<string | null>(null);
const cancelOpen = computed({
  get: () => cancelledPaymentId.value !== null,
  set: (isOpen: boolean) => {
    if (!isOpen) {
      cancelledPaymentId.value = null;
    }
  },
});
const cancelMutation = useMutation($orpc.payments.cancel.mutationOptions());
const confirmCancel = async (reason: string) => {
  if (cancelledPaymentId.value === null) {
    return;
  }
  try {
    await cancelMutation.mutateAsync({ id: cancelledPaymentId.value, reason });
    await invalidateSales();
    cancelledPaymentId.value = null;
    notify.success("Paiement annulé");
  } catch (error) {
    notify.error("Annulation impossible", error);
  }
};

const dayActions = (day: PaymentLedgerDay): DropdownMenuItem[][] => [
  day.payments
    .filter((payment) => !payment.cancelledAt)
    .map((payment) => ({
      icon: icons.undo,
      label: `${formatFcfa(payment.amountFcfa)} · ${methodLabel(payment.method)}${
        payment.notes ? ` (${payment.notes})` : ""
      }`,
      onSelect: () => {
        cancelledPaymentId.value = payment.id;
      },
    })),
];

const rightAligned = { class: { td: "text-right", th: "text-right" } };
const columns = computed<TableColumn<PaymentLedgerDay>[]>(() => [
  { accessorKey: "date", enableHiding: false, header: "Jour" },
  { accessorKey: "paidFcfa", header: "Payé ce jour", meta: rightAligned },
  { header: "Paiements", id: "payments", meta: rightAligned },
  { accessorKey: "sales", header: "Ventes concernées" },
  { header: "", id: "actions", meta: rightAligned },
]);

const searchText = (day: PaymentLedgerDay) =>
  [
    day.date,
    ...day.methods.map(methodLabel),
    ...day.sales.map((sale) => sale.reference ?? ""),
    ...day.payments.map(
      (payment) => `${payment.notes ?? ""} ${payment.createdByName ?? ""}`
    ),
  ].join(" ");
</script>

<template>
  <div class="space-y-4">
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div
        class="bg-elevated ring-default rounded-lg px-3 py-2.5 ring ring-inset"
      >
        <p class="text-muted text-xs">Encaissé aujourd'hui</p>
        <p class="text-highlighted mt-0.5 text-lg font-semibold tabular-nums">
          {{ formatFcfa(data?.summary.todayFcfa ?? 0) }}
        </p>
        <p class="text-dimmed text-xs">
          {{ data?.summary.todayCount ?? 0 }} paiement(s)
        </p>
      </div>
      <div
        class="bg-elevated ring-default rounded-lg px-3 py-2.5 ring ring-inset"
      >
        <p class="text-muted text-xs">Ce mois-ci</p>
        <p class="text-highlighted mt-0.5 text-lg font-semibold tabular-nums">
          {{ formatFcfa(data?.summary.monthFcfa ?? 0) }}
        </p>
      </div>
      <div
        class="bg-elevated ring-default rounded-lg px-3 py-2.5 ring ring-inset"
      >
        <p class="text-muted text-xs">Dernier paiement</p>
        <p class="text-highlighted mt-0.5 text-sm font-medium">
          <template v-if="data?.summary.lastPaymentDate">
            {{ formatFcfa(data.summary.lastPaymentFcfa ?? 0) }} ·
            {{ formatDaysAgo(data.summary.lastPaymentDate) }}
          </template>
          <template v-else>—</template>
        </p>
      </div>
      <div
        class="bg-elevated ring-default rounded-lg px-3 py-2.5 ring ring-inset"
      >
        <p class="text-muted text-xs">Reste dû</p>
        <p
          class="mt-0.5 text-lg font-semibold tabular-nums"
          :class="dueFcfa > 0 ? 'text-warning' : 'text-success'"
        >
          {{ formatFcfa(dueFcfa) }}
        </p>
      </div>
    </div>

    <UPageCard variant="subtle" title="Rythme de paiement">
      <template #description>
        Les {{ windowMonths }} derniers mois, jour par jour. Cliquez sur un jour
        pour n'afficher que celui-là.
      </template>
      <USkeleton v-if="ledger.isPending.value" class="h-32 w-full" />
      <ActivityHeatmap
        v-else
        :days="heatmapDays"
        :describe="describeDay"
        :summary="heatmapSummary"
        @select="openPaymentDay"
      />
    </UPageCard>

    <span ref="table" class="block" aria-hidden="true" />
    <DataTable
      :data="days"
      :columns="columns"
      :loading="ledger.isPending.value"
      :search-text="searchText"
      filters-menu
      :active-filters="activeFilters"
      search-placeholder="Vente, moyen, note, auteur…"
      :item-label="['jour', 'jours']"
      :max-rows="12"
      storage-key="customer-payments"
    >
      <template #filters="{ stacked }">
        <USelect
          v-model="windowMonths"
          :items="windowItems"
          aria-label="Profondeur de l'historique"
          :class="stacked ? 'w-full' : 'w-32'"
        />
        <DateRangeField
          v-model:from="from"
          v-model:to="to"
          :class="stacked ? 'w-full' : 'w-full sm:w-72'"
        />
        <USelect
          v-model="method"
          :items="methodItems"
          aria-label="Moyen de paiement"
          :class="stacked ? 'w-full' : 'w-44'"
        />
        <USwitch v-model="showCancelled" label="Annulés" />
        <UButton
          v-if="hasFilters"
          color="neutral"
          variant="ghost"
          :icon="icons.close"
          label="Réinitialiser"
          @click="resetFilters"
        />
      </template>

      <template #date-cell="{ row }">
        <span class="text-highlighted font-medium whitespace-nowrap">
          {{ formatDayLabel(row.original.date) }}
          <span
            v-if="!row.original.date.startsWith(currentYear)"
            class="text-dimmed"
          >
            {{ row.original.date.slice(0, 4) }}
          </span>
        </span>
        <p class="text-dimmed text-xs">
          <span
            v-if="row.original.date === today"
            class="text-primary font-medium"
          >
            aujourd'hui
          </span>
          <template v-else>{{ formatDaysAgo(row.original.date) }}</template>
        </p>
      </template>

      <template #paidFcfa-cell="{ row }">
        <span class="text-highlighted font-semibold tabular-nums">
          {{ formatFcfa(row.original.paidFcfa) }}
        </span>
        <p
          v-if="row.original.cancelledFcfa > 0"
          class="text-dimmed text-xs tabular-nums"
        >
          + {{ formatFcfa(row.original.cancelledFcfa) }} annulé
        </p>
      </template>

      <template #payments-cell="{ row }">
        <span class="tabular-nums">
          {{
            row.original.payments.filter((payment) => !payment.cancelledAt)
              .length
          }}
        </span>
        <p class="text-dimmed text-xs">
          {{ row.original.methods.map(methodLabel).join(", ") }}
        </p>
      </template>

      <template #sales-cell="{ row }">
        <p v-if="row.original.sales.length === 0" class="text-dimmed text-xs">
          Avoir (aucune vente à solder)
        </p>
        <div v-else class="flex flex-wrap gap-1.5">
          <NuxtLink
            v-for="sale in row.original.sales"
            :key="sale.saleId"
            :to="`/ventes/${sale.saleId}`"
            class="bg-elevated ring-default rounded-md px-1.5 py-0.5 font-mono text-xs ring ring-inset hover:underline"
            :title="`${formatFcfa(sale.amountFcfa)} sur cette vente`"
          >
            {{ sale.reference ?? "Vente" }}
            <span class="text-dimmed">{{
              formatCompact(sale.amountFcfa)
            }}</span>
          </NuxtLink>
        </div>
      </template>

      <template #actions-cell="{ row }">
        <UDropdownMenu
          v-if="row.original.payments.some((payment) => !payment.cancelledAt)"
          :items="dayActions(row.original)"
          :content="{ align: 'end' }"
        >
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            :icon="icons.undo"
            :aria-label="`Annuler un paiement du ${formatDayLabel(row.original.date)}`"
          />
        </UDropdownMenu>
        <span v-else class="text-dimmed text-xs">—</span>
      </template>

      <template #empty>
        <div class="flex flex-col items-center gap-2 py-10 text-center">
          <UIcon :name="icons.payment" class="text-dimmed size-10" />
          <p class="text-muted">
            {{
              (data?.days ?? []).length === 0
                ? "Aucun paiement sur cette période."
                : "Aucun paiement ne correspond à ces critères."
            }}
          </p>
        </div>
      </template>

      <template #footer>
        <span class="tabular-nums">
          {{ totals.count }} paiement{{ totals.count > 1 ? "s" : "" }} sur
          {{ days.length }} jour{{ days.length > 1 ? "s" : "" }}
        </span>
        <span class="text-highlighted font-medium tabular-nums">
          Total {{ formatFcfa(totals.paidFcfa) }}
        </span>
        <span v-if="totals.cancelledFcfa > 0" class="tabular-nums">
          dont {{ formatFcfa(totals.cancelledFcfa) }} annulé
        </span>
      </template>
    </DataTable>

    <ReasonDialog
      v-model:open="cancelOpen"
      title="Annuler ce paiement ?"
      description="Il ne comptera plus dans le solde du client, mais restera visible, barré, avec son motif."
      confirm-label="Annuler le paiement"
      :loading="cancelMutation.isPending.value"
      @confirm="confirmCancel"
    />
  </div>
</template>
