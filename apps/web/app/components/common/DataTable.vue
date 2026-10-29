<script setup lang="ts" generic="T extends TableData">
import type { TableColumn, TableData } from "@nuxt/ui";
import { getPaginationRowModel } from "@tanstack/vue-table";
import type {
  PaginationState,
  Row,
  SortingState,
  Table,
  VisibilityState,
} from "@tanstack/vue-table";

/**
 * Tableau de données complet, dans son propre cadre : titre et actions, recherche (touche « / »),
 * filtres, tri au clic sur les en-têtes, choix des colonnes, pagination et défilement interne
 * (environ dix lignes visibles, en-tête figé).
 *
 * Colonnes : celles de UTable. Un en-tête texte devient triable (sauf `enableSorting: false`) et
 * sert de libellé dans le choix des colonnes. Les slots de cellule (`<colonne>-cell`) sont transmis.
 * Mode serveur (`total` renseigné) : la page et sa taille passent par `v-model:page` et
 * `v-model:page-size`, la recherche par `v-model:search`.
 */
defineOptions({ inheritAttrs: false });

const {
  columns,
  data,
  description = "",
  initialSorting = [],
  itemLabel = ["ligne", "lignes"],
  loading = false,
  maxRows = 10,
  searchPlaceholder = "Rechercher…",
  searchText,
  searchable = true,
  storageKey = "",
  title = "",
  total,
} = defineProps<{
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  title?: string;
  description?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Texte cherché pour une ligne ; par défaut, toutes ses valeurs simples. */
  searchText?: (row: T) => string;
  initialSorting?: SortingState;
  /** Libellé des lignes au singulier et au pluriel (« 1–10 sur 29 produits »). */
  itemLabel?: [string, string];
  /** Lignes visibles avant que le tableau ne défile. */
  maxRows?: number;
  /** Garde les colonnes affichées et la taille de page dans le navigateur. */
  storageKey?: string;
  /** Mode serveur : nombre total de lignes. */
  total?: number;
}>();

const search = defineModel<string>("search", { default: "" });
const page = defineModel<number>("page", { default: 1 });
const pageSize = defineModel<number>("pageSize", { default: 10 });

const slots = useSlots();
const attrs = useAttrs();
const tableAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs;
  return rest;
});
const icons = useIcons();
const UButton = resolveComponent("UButton");

const PAGE_SIZES = [10, 25, 50, 100];
const OWN_SLOTS = new Set(["actions", "filters", "toolbar", "footer"]);
const isServer = computed(() => total !== undefined);

// Préférences gardées dans le navigateur (colonnes, taille de page).
const storageName = computed(() => (storageKey ? `gstock-table-${storageKey}` : ""));
const readPreferences = (): {
  pageSize?: number;
  visibility?: VisibilityState;
} => {
  if (!storageName.value) {
    return {};
  }
  try {
    return JSON.parse(localStorage.getItem(storageName.value) ?? "{}");
  } catch {
    return {};
  }
};
const stored = readPreferences();
const columnVisibility = ref<VisibilityState>(stored.visibility ?? {});
if (stored.pageSize && PAGE_SIZES.includes(stored.pageSize)) {
  pageSize.value = stored.pageSize;
}
watch([columnVisibility, pageSize], () => {
  if (!storageName.value) {
    return;
  }
  try {
    localStorage.setItem(
      storageName.value,
      JSON.stringify({
        pageSize: pageSize.value,
        visibility: columnVisibility.value,
      }),
    );
  } catch {
    // Préférences non gardées : le tableau marche quand même.
  }
});

const sorting = ref<SortingState>(initialSorting);
const pagination = computed<PaginationState>({
  get: () => ({ pageIndex: page.value - 1, pageSize: pageSize.value }),
  set: (value) => {
    page.value = value.pageIndex + 1;
    pageSize.value = value.pageSize;
  },
});
// Nouvelle recherche ou nouveau tri : retour à la première page.
watch([search, sorting], () => {
  page.value = 1;
});

// Recherche sans tenir compte des accents ni de la casse.
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase();
const defaultSearchText = (row: T) =>
  Object.values(row as Record<string, unknown>)
    .filter((value) => typeof value === "string" || typeof value === "number")
    .join(" ");
const globalFilterFn = (row: Row<T>, _columnId: string, value: string) =>
  normalize((searchText ?? defaultSearchText)(row.original)).includes(normalize(value));

// En-têtes texte : bouton de tri, libellé gardé pour le choix des colonnes.
const sortIcon = (direction: false | "asc" | "desc") => {
  if (direction === "asc") {
    return icons.arrowUp;
  }
  return direction === "desc" ? icons.arrowDown : icons.selector;
};
const tableColumns = computed<TableColumn<T>[]>(() =>
  columns.map((column) => {
    if (typeof column.header !== "string") {
      return column;
    }
    const label = column.header;
    const sortable =
      !isServer.value &&
      column.enableSorting !== false &&
      ("accessorKey" in column || "accessorFn" in column);
    if (!sortable) {
      return column;
    }
    const alignRight = JSON.stringify(column.meta?.class ?? "").includes("text-right");
    return {
      ...column,
      header: ({ column: tableColumn }) =>
        h(UButton, {
          "aria-label": `Trier par ${label}`,
          class: [
            "-mx-2 gap-1 px-2 font-mono text-[11px] font-medium tracking-[0.06em] uppercase hover:text-highlighted",
            tableColumn.getIsSorted() ? "text-highlighted" : "text-muted",
            alignRight ? "flex-row-reverse" : "",
          ],
          color: "neutral",
          label,
          onClick: () => tableColumn.toggleSorting(),
          size: "xs",
          trailingIcon: sortIcon(tableColumn.getIsSorted()),
          ui: {
            trailingIcon: tableColumn.getIsSorted() ? "size-3.5" : "size-3.5 opacity-40",
          },
          variant: "ghost",
        }),
    } as TableColumn<T>;
  }),
);

const table = useTemplateRef<{ tableApi?: Table<T> }>("table");

// Choix des colonnes : le libellé vient de l'en-tête texte d'origine.
const columnLabels = computed(
  () =>
    new Map(
      columns.flatMap((column) => {
        const id = column.id ?? ("accessorKey" in column ? String(column.accessorKey) : "");
        return typeof column.header === "string" && id ? [[id, column.header] as const] : [];
      }),
    ),
);
const columnLabel = (id: string) => columnLabels.value.get(id) ?? "";
const columnItems = computed(() =>
  (table.value?.tableApi?.getAllLeafColumns() ?? [])
    .filter((column) => column.getCanHide() && columnLabel(column.id))
    .map((column) => ({
      checked: columnVisibility.value[column.id] !== false,
      label: columnLabel(column.id),
      onSelect: (event: Event) => event.preventDefault(),
      onUpdateChecked: (checked: boolean) => {
        columnVisibility.value = {
          ...columnVisibility.value,
          [column.id]: checked,
        };
      },
      type: "checkbox" as const,
    })),
);
const hiddenCount = computed(
  () => Object.values(columnVisibility.value).filter((visible) => visible === false).length,
);

// Pied : « 1–10 sur 29 produits »
const rowCount = computed(() => {
  if (isServer.value) {
    return total ?? 0;
  }
  const query = normalize(search.value);
  if (!query) {
    return data.length;
  }
  const text = searchText ?? defaultSearchText;
  return data.filter((row) => normalize(text(row)).includes(query)).length;
});
const range = computed(() => {
  if (rowCount.value === 0) {
    return `0 ${itemLabel[1]}`;
  }
  const first = (page.value - 1) * pageSize.value + 1;
  const last = Math.min(page.value * pageSize.value, rowCount.value);
  return `${first}–${last} sur ${rowCount.value} ${rowCount.value > 1 ? itemLabel[1] : itemLabel[0]}`;
});

// « / » place le curseur dans la recherche.
const searchInput = useTemplateRef("searchInput");
defineShortcuts({
  "/": () => searchInput.value?.inputRef?.focus(),
});

// Défilement interne : environ `maxRows` lignes, l'en-tête reste visible.
const maxHeight = computed(() => `calc(2.5rem + ${maxRows} * 3.4rem)`);
// Premier chargement : des lignes fantômes plutôt que « aucun résultat ».
const showSkeleton = computed(() => loading && data.length === 0);
const forwardedSlots = computed(() =>
  Object.keys(slots).filter(
    (name) => !OWN_SLOTS.has(name) && !(showSkeleton.value && name === "empty"),
  ),
);
</script>

<template>
  <section class="bg-elevated min-w-0 rounded-xl p-1" :class="attrs.class" :style="attrs.style">
    <header
      v-if="title || $slots.actions"
      class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 pt-2 pb-2.5"
    >
      <p class="min-w-0 text-sm">
        <span class="text-highlighted font-semibold">{{ title }}</span>
        <template v-if="description">
          <span class="text-dimmed mx-1.5">·</span>
          <span class="text-muted">{{ description }}</span>
        </template>
      </p>
      <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </header>

    <div
      class="bg-default ring-default shadow-card overflow-hidden rounded-[calc(var(--radius-xl)-0.25rem)] ring"
    >
      <div
        v-if="searchable || $slots.filters || $slots.toolbar || columnItems.length > 0"
        class="border-default flex flex-wrap items-center gap-2 border-b px-3 py-2.5"
      >
        <UInput
          v-if="searchable"
          ref="searchInput"
          v-model="search"
          :icon="icons.search"
          :placeholder="searchPlaceholder"
          class="w-full sm:w-72"
          :ui="{ trailing: 'pe-1.5' }"
        >
          <template #trailing>
            <UButton
              v-if="search"
              color="neutral"
              variant="ghost"
              size="xs"
              :icon="icons.close"
              aria-label="Effacer la recherche"
              @click="search = ''"
            />
            <UKbd v-else value="/" />
          </template>
        </UInput>
        <slot name="filters" />
        <div class="ms-auto flex flex-wrap items-center gap-2">
          <slot name="toolbar" />
          <UDropdownMenu
            v-if="columnItems.length > 0"
            :items="columnItems"
            :content="{ align: 'end' }"
          >
            <UTooltip text="Colonnes affichées">
              <UChip :show="hiddenCount > 0" size="sm" inset>
                <UButton
                  color="neutral"
                  variant="outline"
                  :icon="icons.columns"
                  aria-label="Colonnes affichées"
                />
              </UChip>
            </UTooltip>
          </UDropdownMenu>
        </div>
      </div>

      <UTable
        ref="table"
        v-bind="tableAttrs"
        v-model:sorting="sorting"
        v-model:column-visibility="columnVisibility"
        v-model:pagination="pagination"
        v-model:global-filter="search"
        :data="data"
        :columns="tableColumns"
        :loading="loading"
        sticky
        :pagination-options="
          isServer
            ? { manualPagination: true, rowCount: total }
            : { getPaginationRowModel: getPaginationRowModel() }
        "
        :global-filter-options="{
          globalFilterFn: isServer ? () => true : globalFilterFn,
        }"
        class="overflow-auto"
        :style="{ maxHeight }"
        :ui="{ root: 'rounded-none bg-transparent shadow-none ring-0' }"
      >
        <template v-if="showSkeleton" #empty>
          <div class="space-y-3 px-1 py-2">
            <USkeleton v-for="line in 6" :key="line" class="h-9 w-full" />
          </div>
        </template>
        <template v-for="name in forwardedSlots" #[name]="slotProps" :key="name">
          <slot :name="name" v-bind="slotProps ?? {}" />
        </template>
      </UTable>
    </div>

    <footer
      class="text-muted flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 pt-2.5 pb-1.5 text-xs"
    >
      <div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
        <slot name="footer" />
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <span class="flex items-center gap-2">
          Lignes
          <USelect
            v-model="pageSize"
            :items="PAGE_SIZES"
            size="xs"
            class="w-16"
            aria-label="Lignes par page"
          />
        </span>
        <span class="tabular-nums">{{ range }}</span>
        <UPagination
          v-if="rowCount > pageSize"
          v-model:page="page"
          :items-per-page="pageSize"
          :total="rowCount"
          size="xs"
          :sibling-count="1"
          show-edges
        />
      </div>
    </footer>
  </section>
</template>
