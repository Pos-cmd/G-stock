<script setup lang="ts">
import type { GeneratedDocumentType } from "@G-stock/api/schemas/documents";
import { formatDateTime } from "@G-stock/core/format";
import type { TableColumn } from "@nuxt/ui";
import { keepPreviousData, useQuery } from "@tanstack/vue-query";

import PagePanel from "~/components/layout/PagePanel.vue";
import { useSettingsStore } from "~/stores/settings";
import type { DocumentRow } from "~/types/api";

const icons = useIcons();

useHead({ title: "Documents" });

const SEARCH_DEBOUNCE_MS = 300;

const { $orpc } = useNuxtApp();
const settingsStore = useSettingsStore();
const notify = useNotify();

onMounted(async () => {
  await settingsStore.load();
});

const TYPE_LABELS: Record<GeneratedDocumentType, { label: string; icon: string }> = {
  cost_sheet: { icon: icons.purchases, label: "Fiche de commande" },
  receipt: { icon: icons.sale, label: "Reçu de vente" },
  receipt_mobile: { icon: icons.receiptMobile, label: "Reçu téléphone" },
  simulation: { icon: icons.simulations, label: "Simulation" },
};

const search = ref("");
const debouncedSearch = refDebounced(search, SEARCH_DEBOUNCE_MS);
const type = ref<GeneratedDocumentType | typeof ALL>(ALL);

const documents = useQuery(
  computed(() => ({
    ...$orpc.documents.list.queryOptions({
      input: {
        search: debouncedSearch.value || null,
        type: type.value === ALL ? null : type.value,
      },
    }),
    placeholderData: keepPreviousData,
  })),
);

const typeItems = [
  { label: "Tous les documents", value: ALL },
  ...Object.entries(TYPE_LABELS).map(([value, { label }]) => ({
    label,
    value,
  })),
];

/** Lien vers la vente, la commande ou la simulation d'origine. */
const sourceLink = (document: DocumentRow) => {
  const routes: Record<string, string> = {
    purchase_order: "/achats",
    sale: "/ventes",
    simulation: "/simulateur",
  };
  const base = document.referenceType ? routes[document.referenceType] : undefined;
  return base && document.referenceId ? `${base}/${document.referenceId}` : null;
};

const copyPath = async (filePath: string) => {
  try {
    await navigator.clipboard.writeText(filePath);
    notify.success("Chemin copié", filePath);
  } catch (error) {
    notify.error("Copie impossible", error);
  }
};

const columns: TableColumn<DocumentRow>[] = [
  { accessorKey: "title", header: "Document" },
  { accessorKey: "type", header: "Type" },
  { accessorKey: "createdAt", header: "Généré le" },
  { accessorKey: "filePath", header: "Emplacement" },
  {
    header: "",
    id: "actions",
    meta: { class: { td: "text-right", th: "text-right" } },
  },
];
</script>

<template>
  <PagePanel
    id="documents"
    title="Documents"
    description="Reçus, fiches de coût et simulations générés en PDF."
  >
    <template #toolbar>
      <div class="flex w-full flex-wrap items-center gap-2 py-1">
        <UInput
          v-model="search"
          :icon="icons.search"
          placeholder="Référence, client, simulation…"
          class="w-full sm:w-72"
        />
        <USelect v-model="type" :items="typeItems" class="w-48" />
        <span v-if="settingsStore.settings" class="text-muted ms-auto truncate text-xs">
          <UIcon :name="icons.folder" class="me-1 align-middle" />
          {{ settingsStore.settings.documentsFolder }}
        </span>
      </div>
    </template>

    <UTable
      :data="documents.data.value ?? []"
      :columns="columns"
      :loading="documents.isFetching.value"
    >
      <template #title-cell="{ row }">
        <a
          v-if="row.original.exists"
          :href="`/api/documents/${row.original.id}`"
          target="_blank"
          rel="noopener"
          class="text-highlighted font-medium hover:underline"
        >
          {{ row.original.title }}
        </a>
        <span v-else class="text-dimmed line-through">{{ row.original.title }}</span>
        <p v-if="sourceLink(row.original)" class="text-xs">
          <NuxtLink :to="sourceLink(row.original) ?? '/'" class="text-primary hover:underline">
            Voir l'origine
          </NuxtLink>
        </p>
      </template>
      <template #type-cell="{ row }">
        <UBadge
          color="neutral"
          variant="subtle"
          size="sm"
          :icon="TYPE_LABELS[row.original.type as GeneratedDocumentType]?.icon"
        >
          {{ TYPE_LABELS[row.original.type as GeneratedDocumentType]?.label ?? row.original.type }}
        </UBadge>
      </template>
      <template #createdAt-cell="{ row }">
        <span class="text-muted">{{ formatDateTime(row.original.createdAt) }}</span>
      </template>
      <template #filePath-cell="{ row }">
        <button
          type="button"
          class="text-muted hover:text-highlighted block max-w-80 truncate text-left font-mono text-xs"
          :title="`Copier : ${row.original.filePath}`"
          @click="copyPath(row.original.filePath)"
        >
          {{ row.original.filePath }}
        </button>
        <p v-if="!row.original.exists" class="text-error text-xs">
          Fichier déplacé ou supprimé : regénérez-le depuis son origine.
        </p>
      </template>
      <template #actions-cell="{ row }">
        <div v-if="row.original.exists" class="flex justify-end gap-1">
          <UButton
            :href="`/api/documents/${row.original.id}`"
            target="_blank"
            external
            color="neutral"
            variant="ghost"
            :icon="icons.external"
            :aria-label="`Ouvrir ${row.original.title}`"
          />
          <UButton
            :href="`/api/documents/${row.original.id}?telecharger`"
            external
            color="neutral"
            variant="ghost"
            :icon="icons.download"
            :aria-label="`Télécharger ${row.original.title}`"
          />
        </div>
      </template>
      <template #empty>
        <div class="flex flex-col items-center gap-2 py-10 text-center">
          <UIcon :name="icons.documents" class="text-dimmed size-10" />
          <p class="text-muted">
            Aucun document. Les boutons « PDF » des ventes, commandes et simulations en créent.
          </p>
        </div>
      </template>
    </UTable>
  </PagePanel>
</template>
