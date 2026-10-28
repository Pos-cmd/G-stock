<script setup lang="ts">
import { formatDate, formatFcfa, formatRmb } from "@G-stock/core/format";
import type { DropdownMenuItem, TableColumn } from "@nuxt/ui";
import { useMutation, useQuery } from "@tanstack/vue-query";

import ConfirmDialog from "~/components/common/ConfirmDialog.vue";
import PagePanel from "~/components/layout/PagePanel.vue";
import SupplierFormModal from "~/components/purchases/SupplierFormModal.vue";
import type { SupplierRow } from "~/types/api";

const icons = useIcons();

useHead({ title: "Fournisseurs" });

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidatePurchases = useInvalidatePurchases();

const suppliers = useQuery($orpc.suppliers.list.queryOptions());

const formOpen = ref(false);
const editedSupplier = ref<SupplierRow | null>(null);
const deleteOpen = ref(false);
const deletedSupplier = ref<SupplierRow | null>(null);

const openCreate = () => {
  editedSupplier.value = null;
  formOpen.value = true;
};

const removeMutation = useMutation($orpc.suppliers.remove.mutationOptions());

const confirmDelete = async () => {
  if (!deletedSupplier.value) {
    return;
  }
  try {
    await removeMutation.mutateAsync({ id: deletedSupplier.value.id });
    notify.success("Fournisseur supprimé", deletedSupplier.value.name);
    deleteOpen.value = false;
    await invalidatePurchases();
  } catch (error) {
    notify.error("Suppression impossible", error);
  }
};

const rowActions = (supplier: SupplierRow): DropdownMenuItem[][] => [
  [
    {
      icon: icons.edit,
      label: "Modifier",
      onSelect: () => {
        editedSupplier.value = supplier;
        formOpen.value = true;
      },
    },
  ],
  ...(supplier.orderCount === 0
    ? [
        [
          {
            color: "error" as const,
            icon: icons.trash,
            label: "Supprimer",
            onSelect: () => {
              deletedSupplier.value = supplier;
              deleteOpen.value = true;
            },
          },
        ],
      ]
    : []),
];

const rightAligned = { class: { td: "text-right", th: "text-right" } };
const columns: TableColumn<SupplierRow>[] = [
  { accessorKey: "name", header: "Fournisseur" },
  { accessorKey: "country", header: "Pays" },
  { accessorKey: "phone", header: "Téléphone" },
  { accessorKey: "orderCount", header: "Commandes", meta: rightAligned },
  { accessorKey: "lastOrderDate", header: "Dernière commande" },
  { accessorKey: "remainingRmb", header: "Reste à payer", meta: rightAligned },
  { header: "", id: "actions", meta: rightAligned },
];
</script>

<template>
  <PagePanel id="suppliers" title="Fournisseurs" :icon="icons.suppliers">
    <template #actions>
      <UButton
        to="/achats"
        color="neutral"
        variant="ghost"
        :icon="icons.arrowLeft"
        label="Commandes"
      />
      <UButton :icon="icons.plus" label="Nouveau fournisseur" @click="openCreate" />
    </template>

    <UTable
      :data="suppliers.data.value ?? []"
      :columns="columns"
      :loading="suppliers.isFetching.value"
      class="border-default rounded-lg border"
    >
      <template #name-cell="{ row }">
        <span class="text-highlighted font-medium">{{ row.original.name }}</span>
        <p v-if="row.original.contact" class="text-dimmed text-xs">{{ row.original.contact }}</p>
      </template>
      <template #phone-cell="{ row }">
        <span :class="row.original.phone ? '' : 'text-dimmed'">{{
          row.original.phone ?? "—"
        }}</span>
      </template>
      <template #orderCount-cell="{ row }">
        <ULink
          v-if="row.original.orderCount > 0"
          :to="{ path: '/achats', query: { fournisseur: row.original.id } }"
          class="tabular-nums"
        >
          {{ row.original.orderCount }}
        </ULink>
        <span v-else class="text-dimmed">0</span>
      </template>
      <template #remainingRmb-cell="{ row }">
        <template v-if="row.original.unpaidOrderCount > 0">
          <span class="text-warning font-medium tabular-nums">
            {{ formatRmb(row.original.remainingRmb) }}
          </span>
          <p class="text-dimmed text-xs tabular-nums">
            ≈ {{ formatFcfa(row.original.remainingFcfa) }} ·
            {{ row.original.unpaidOrderCount }} commande{{
              row.original.unpaidOrderCount > 1 ? "s" : ""
            }}
          </p>
        </template>
        <span v-else class="text-dimmed">—</span>
      </template>

      <template #lastOrderDate-cell="{ row }">
        <span :class="row.original.lastOrderDate ? '' : 'text-dimmed'">
          {{ row.original.lastOrderDate ? formatDate(row.original.lastOrderDate) : "—" }}
        </span>
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
          <UIcon :name="icons.suppliers" class="text-dimmed size-10" />
          <p class="text-muted">Aucun fournisseur enregistré.</p>
          <UButton
            variant="soft"
            :icon="icons.plus"
            label="Ajouter un fournisseur"
            @click="openCreate"
          />
        </div>
      </template>
    </UTable>

    <SupplierFormModal v-model:open="formOpen" :supplier="editedSupplier" />
    <ConfirmDialog
      v-model:open="deleteOpen"
      title="Supprimer le fournisseur ?"
      :description="`« ${deletedSupplier?.name} » sera définitivement supprimé.`"
      confirm-label="Supprimer"
      :loading="removeMutation.isPending.value"
      @confirm="confirmDelete"
    />
  </PagePanel>
</template>
