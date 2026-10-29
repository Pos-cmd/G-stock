<script setup lang="ts" generic="T extends TableData">
import type { TableColumn, TableData } from "@nuxt/ui";
import { getPaginationRowModel } from "@tanstack/vue-table";
import type {
  ColumnOrderState,
  PaginationState,
  Row,
  SortingState,
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
  activeFilters = 0,
  filtersMenu = false,
  searchable = true,
  serverSortable = [],
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
  /** Mode serveur : colonnes que le serveur sait trier (`v-model:sorting`). */
  serverSortable?: string[];
  /** Filtres nombreux : rangés dans un bouton « Filtres » plutôt qu'en ligne. */
  filtersMenu?: boolean;
  /** Nombre de filtres actifs, affiché sur le bouton « Filtres ». */
  activeFilters?: number;
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
// Sur un écran étroit, les filtres passent toujours dans le bouton « Filtres ».
const isWide = useMediaQuery("(min-width: 1024px)");
const filtersInMenu = computed(() => filtersMenu || !isWide.value);

// Préférences gardées dans le navigateur (colonnes, taille de page).
const storageName = computed(() => (storageKey ? `gstock-table-${storageKey}` : ""));
const readPreferences = (): {
  order?: ColumnOrderState;
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
// Ordre choisi des colonnes du menu (les autres, sans libellé, gardent leur place).
const columnOrder = ref<ColumnOrderState>(stored.order ?? []);
if (stored.pageSize && PAGE_SIZES.includes(stored.pageSize)) {
  pageSize.value = stored.pageSize;
}
watch([columnVisibility, columnOrder, pageSize], () => {
  if (!storageName.value) {
    return;
  }
  try {
    localStorage.setItem(
      storageName.value,
      JSON.stringify({
        order: columnOrder.value,
        pageSize: pageSize.value,
        visibility: columnVisibility.value,
      }),
    );
  } catch {
    // Préférences non gardées : le tableau marche quand même.
  }
});

const sorting = defineModel<SortingState>("sorting", { default: () => [] });
if (sorting.value.length === 0 && initialSorting.length > 0) {
  sorting.value = initialSorting;
}
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
    const id = column.id ?? ("accessorKey" in column ? String(column.accessorKey) : "");
    const sortable = isServer.value
      ? serverSortable.includes(id)
      : column.enableSorting !== false && ("accessorKey" in column || "accessorFn" in column);
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

// Choix des colonnes : le libellé vient de l'en-tête texte d'origine.
const columnId = (column: TableColumn<T>) =>
  column.id ?? ("accessorKey" in column ? String(column.accessorKey) : "");
const columnLabels = computed(
  () =>
    new Map(
      columns.flatMap((column) => {
        const id = columnId(column);
        return typeof column.header === "string" && id ? [[id, column.header] as const] : [];
      }),
    ),
);
const columnLabel = (id: string) => columnLabels.value.get(id) ?? "";
// Colonnes du menu : celles qui ont un libellé et qu'on peut masquer, dans l'ordre choisi.
const menuIds = computed(() =>
  columns
    .filter((column) => column.enableHiding !== false)
    .map(columnId)
    .filter((id) => columnLabels.value.has(id)),
);
const orderedMenuIds = computed(() => {
  const chosen = columnOrder.value.filter((id) => menuIds.value.includes(id));
  return [...chosen, ...menuIds.value.filter((id) => !chosen.includes(id))];
});
// Ordre complet donné au tableau : les colonnes du menu échangent leurs places entre elles.
const tableColumnOrder = computed<ColumnOrderState>(() => {
  const menu = new Set(menuIds.value);
  let next = 0;
  return columns.map(columnId).map((id) => {
    if (!menu.has(id)) {
      return id;
    }
    const placed = orderedMenuIds.value[next] ?? id;
    next += 1;
    return placed;
  });
});
const isVisible = (id: string) => columnVisibility.value[id] !== false;
const setVisible = (id: string, visible: boolean) => {
  columnVisibility.value = { ...columnVisibility.value, [id]: visible };
};
const moveColumn = (id: string, target: number) => {
  const order = orderedMenuIds.value.filter((other) => other !== id);
  order.splice(Math.max(0, Math.min(target, order.length)), 0, id);
  columnOrder.value = order;
};
const columnsCustomized = computed(
  () =>
    Object.values(columnVisibility.value).includes(false) ||
    orderedMenuIds.value.some((id, index) => id !== menuIds.value[index]),
);
const resetColumns = () => {
  columnVisibility.value = {};
  columnOrder.value = [];
};
const hiddenCount = computed(
  () => Object.values(columnVisibility.value).filter((visible) => visible === false).length,
);

// Glisser-déposer : la colonne tenue prend la place de celle survolée.
const dragged = ref<string | null>(null);
const onDragStart = (event: DragEvent, id: string) => {
  dragged.value = id;
  if (event.dataTransfer) {
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "move";
  }
};
const onDragEnter = (id: string) => {
  if (dragged.value && dragged.value !== id) {
    moveColumn(dragged.value, orderedMenuIds.value.indexOf(id));
  }
};
// Clavier : Alt + ↑ / ↓ déplace la colonne qui a le focus.
const onColumnKeydown = async (event: KeyboardEvent, id: string) => {
  if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) {
    return;
  }
  event.preventDefault();
  const target = event.target as HTMLElement | null;
  moveColumn(id, orderedMenuIds.value.indexOf(id) + (event.key === "ArrowUp" ? -1 : 1));
  await nextTick();
  target?.focus();
};

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
        v-if="searchable || $slots.filters || $slots.toolbar || menuIds.length > 0"
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
        <template v-if="$slots.filters">
          <UPopover
            v-if="filtersInMenu"
            :content="{ align: 'start', sideOffset: 6 }"
            :ui="{ content: 'w-[min(20rem,calc(100vw-2rem))] p-3' }"
          >
            <UChip :show="activeFilters > 0" :text="activeFilters" size="lg" inset>
              <UButton color="neutral" variant="outline" :icon="icons.filter" label="Filtres" />
            </UChip>
            <template #content>
              <div class="flex flex-col gap-2">
                <slot name="filters" :stacked="true" />
              </div>
            </template>
          </UPopover>
          <slot v-else name="filters" :stacked="false" />
        </template>
        <div class="ms-auto flex flex-wrap items-center gap-2">
          <slot name="toolbar" />
          <UPopover
            v-if="menuIds.length > 0"
            :content="{ align: 'end', sideOffset: 6 }"
            :ui="{ content: 'w-60 p-1.5' }"
          >
            <UTooltip text="Colonnes : afficher et réordonner">
              <UChip :show="hiddenCount > 0" size="sm" inset>
                <UButton
                  color="neutral"
                  variant="outline"
                  :icon="icons.columns"
                  aria-label="Colonnes : afficher et réordonner"
                />
              </UChip>
            </UTooltip>
            <template #content>
              <p class="text-dimmed px-2 pt-1 pb-1.5 text-xs">Glissez pour réordonner · Alt ↑↓</p>
              <TransitionGroup tag="ul" move-class="column-move" aria-label="Colonnes">
                <li
                  v-for="id in orderedMenuIds"
                  :key="id"
                  draggable="true"
                  class="hover:bg-elevated flex cursor-grab items-center gap-1.5 rounded-md px-1.5 py-1 active:cursor-grabbing"
                  :class="dragged === id ? 'bg-elevated opacity-60' : ''"
                  @dragstart="onDragStart($event, id)"
                  @dragenter.prevent="onDragEnter(id)"
                  @dragover.prevent
                  @dragend="dragged = null"
                  @drop.prevent="dragged = null"
                >
                  <UIcon :name="icons.drag" class="text-dimmed size-4 shrink-0" />
                  <UCheckbox
                    :model-value="isVisible(id)"
                    :label="columnLabel(id)"
                    aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                    class="min-w-0 flex-1"
                    :ui="{ label: 'truncate font-normal text-default' }"
                    @update:model-value="setVisible(id, $event === true)"
                    @keydown="onColumnKeydown($event, id)"
                  />
                </li>
              </TransitionGroup>
              <div v-if="columnsCustomized" class="border-default mt-1.5 border-t pt-1.5">
                <UButton
                  block
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :icon="icons.undo"
                  label="Rétablir les colonnes"
                  @click="resetColumns"
                />
              </div>
            </template>
          </UPopover>
        </div>
      </div>

      <UTable
        v-bind="tableAttrs"
        v-model:sorting="sorting"
        v-model:column-visibility="columnVisibility"
        :column-order="tableColumnOrder"
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
        :sorting-options="{ manualSorting: isServer }"
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
