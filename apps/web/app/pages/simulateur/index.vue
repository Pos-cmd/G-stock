<script setup lang="ts">
import { formatDateTime, formatFcfa } from "@G-stock/core/format";
import type { DropdownMenuItem, TableColumn } from "@nuxt/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";

import ConfirmDialog from "~/components/common/ConfirmDialog.vue";
import PagePanel from "~/components/layout/PagePanel.vue";
import type { SimulationRow } from "~/types/api";

useHead({ title: "Simulateur" });

const { $orpc } = useNuxtApp();
const notify = useNotify();
const queryClient = useQueryClient();

const simulations = useQuery($orpc.simulations.list.queryOptions());

// Simulations cochées pour être comparées.
const selected = ref<string[]>([]);
const toggleSelected = (id: string, checked: boolean | "indeterminate") => {
  selected.value =
    checked === true
      ? [...selected.value, id]
      : selected.value.filter((selectedId) => selectedId !== id);
};
const compareSelected = computed(() =>
  comparisonLink(selected.value.map((id) => ({ id, type: "simulation" as const }))),
);

const deleteOpen = ref(false);
const deleted = ref<SimulationRow | null>(null);

const refresh = () => queryClient.invalidateQueries({ queryKey: $orpc.simulations.key() });

const duplicateMutation = useMutation($orpc.simulations.duplicate.mutationOptions());
const removeMutation = useMutation($orpc.simulations.remove.mutationOptions());

const duplicate = async (simulation: SimulationRow) => {
  try {
    const copy = await duplicateMutation.mutateAsync({ id: simulation.id });
    await refresh();
    notify.success("Simulation dupliquée", copy.name);
    await navigateTo(`/simulateur/${copy.id}`);
  } catch (error) {
    notify.error("Duplication impossible", error);
  }
};

const confirmDelete = async () => {
  if (!deleted.value) {
    return;
  }
  try {
    await removeMutation.mutateAsync({ id: deleted.value.id });
    await refresh();
    notify.success("Simulation supprimée", deleted.value.name);
    deleteOpen.value = false;
  } catch (error) {
    notify.error("Suppression impossible", error);
  }
};

const rowActions = (simulation: SimulationRow): DropdownMenuItem[][] => [
  [
    { icon: "i-lucide-pencil", label: "Ouvrir", to: `/simulateur/${simulation.id}` },
    {
      icon: "i-lucide-copy",
      label: "Dupliquer",
      onSelect: () => duplicate(simulation),
    },
    {
      icon: "i-lucide-git-compare",
      label: "Comparer avec…",
      to: comparisonLink([{ id: simulation.id, type: "simulation" }]),
    },
  ],
  [
    {
      color: "error",
      icon: "i-lucide-trash-2",
      label: "Supprimer",
      onSelect: () => {
        deleted.value = simulation;
        deleteOpen.value = true;
      },
    },
  ],
];

const percent = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, style: "percent" });

const rightAligned = { class: { td: "text-right", th: "text-right" } };
const columns: TableColumn<SimulationRow>[] = [
  { header: "", id: "select" },
  { accessorKey: "name", header: "Simulation" },
  { accessorKey: "updatedAt", header: "Modifiée" },
  { accessorKey: "totalCostFcfa", header: "Prix de revient", meta: rightAligned },
  { accessorKey: "revenueFcfa", header: "CA prévu", meta: rightAligned },
  { accessorKey: "marginFcfa", header: "Marge", meta: rightAligned },
  { accessorKey: "orderReference", header: "Commande" },
  { header: "", id: "actions", meta: rightAligned },
];
</script>

<template>
  <PagePanel id="simulator" title="Simulateur" icon="i-lucide-calculator">
    <template #actions>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-git-compare"
        :label="selected.length > 0 ? `Comparer (${selected.length})` : 'Comparer'"
        :to="compareSelected"
      />
      <UButton to="/simulateur/nouvelle" icon="i-lucide-plus" label="Nouvelle simulation" />
    </template>

    <UTable
      :data="simulations.data.value ?? []"
      :columns="columns"
      :loading="simulations.isFetching.value"
      class="border-default rounded-lg border"
    >
      <template #select-cell="{ row }">
        <UCheckbox
          :model-value="selected.includes(row.original.id)"
          :disabled="!selected.includes(row.original.id) && selected.length >= 4"
          :aria-label="`Comparer ${row.original.name}`"
          @update:model-value="toggleSelected(row.original.id, $event)"
        />
      </template>
      <template #name-cell="{ row }">
        <NuxtLink :to="`/simulateur/${row.original.id}`" class="group block">
          <span class="text-highlighted font-medium group-hover:underline">
            {{ row.original.name }}
          </span>
          <p class="text-dimmed text-xs">{{ row.original.lineCount }} ligne(s)</p>
        </NuxtLink>
      </template>
      <template #updatedAt-cell="{ row }">
        <span class="text-muted">{{ formatDateTime(row.original.updatedAt) }}</span>
      </template>
      <template #totalCostFcfa-cell="{ row }">
        <span class="tabular-nums">{{ formatFcfa(row.original.totalCostFcfa) }}</span>
      </template>
      <template #revenueFcfa-cell="{ row }">
        <span class="text-highlighted font-medium tabular-nums">
          {{ formatFcfa(row.original.revenueFcfa) }}
        </span>
      </template>
      <template #marginFcfa-cell="{ row }">
        <span
          class="tabular-nums"
          :class="row.original.marginFcfa < 0 ? 'text-error' : 'text-success'"
        >
          {{ formatFcfa(row.original.marginFcfa) }}
        </span>
        <p v-if="row.original.marginRate !== null" class="text-dimmed text-xs">
          {{ percent.format(row.original.marginRate) }} du CA
        </p>
      </template>
      <template #orderReference-cell="{ row }">
        <ULink
          v-if="row.original.purchaseOrderId && row.original.orderReference"
          :to="`/achats/${row.original.purchaseOrderId}`"
          class="font-mono text-xs"
        >
          {{ row.original.orderReference }}
        </ULink>
        <span v-else class="text-dimmed">—</span>
      </template>
      <template #actions-cell="{ row }">
        <UDropdownMenu :items="rowActions(row.original)" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            :aria-label="`Actions pour ${row.original.name}`"
          />
        </UDropdownMenu>
      </template>
      <template #empty>
        <div class="flex flex-col items-center gap-3 py-10 text-center">
          <UIcon name="i-lucide-calculator" class="text-dimmed size-10" />
          <p class="text-muted">
            Aucune simulation. Calcule le prix de revient d'un import et fixe tes prix de vente
            avant de commander.
          </p>
          <UButton
            to="/simulateur/nouvelle"
            variant="soft"
            icon="i-lucide-plus"
            label="Nouvelle simulation"
          />
        </div>
      </template>
    </UTable>

    <ConfirmDialog
      v-model:open="deleteOpen"
      title="Supprimer la simulation ?"
      :description="`« ${deleted?.name} » sera définitivement supprimée.`"
      confirm-label="Supprimer"
      :loading="removeMutation.isPending.value"
      @confirm="confirmDelete"
    />
  </PagePanel>
</template>
