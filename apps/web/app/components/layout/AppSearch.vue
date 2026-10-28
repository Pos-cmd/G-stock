<script setup lang="ts">
import { formatFcfa } from "@G-stock/core/format";
import type { CommandPaletteGroup, CommandPaletteItem } from "@nuxt/ui";
import { keepPreviousData, useQuery } from "@tanstack/vue-query";

// Recherche rapide (Ctrl K) : pages, actions de création, produits, clients, commandes et ventes.
const icons = useIcons();
const { $orpc } = useNuxtApp();
const { sections, settingsLink } = useAppNavigation();

const SALES_MIN_CHARS = 2;
const SALES_LIMIT = 6;
const SALES_DEBOUNCE_MS = 250;

const open = ref(false);
const searchTerm = ref("");
const term = computed(() => searchTerm.value.trim());
const debouncedTerm = refDebounced(term, SALES_DEBOUNCE_MS);

// Les listes ne se chargent qu'à l'ouverture.
const products = useQuery(
  computed(() => ({ ...$orpc.products.list.queryOptions({ input: {} }), enabled: open.value })),
);
const customers = useQuery(
  computed(() => ({ ...$orpc.customers.list.queryOptions({ input: {} }), enabled: open.value })),
);
const purchases = useQuery(
  computed(() => ({ ...$orpc.purchases.list.queryOptions({ input: {} }), enabled: open.value })),
);
// Les ventes sont trop nombreuses pour être chargées d'avance : le serveur cherche.
const sales = useQuery(
  computed(() => ({
    ...$orpc.sales.list.queryOptions({
      input: { pageSize: SALES_LIMIT, search: debouncedTerm.value },
    }),
    enabled: open.value && debouncedTerm.value.length >= SALES_MIN_CHARS,
    placeholderData: keepPreviousData,
  })),
);

const createItems = computed<CommandPaletteItem[]>(() =>
  sections.value.flatMap((section) =>
    section.create
      ? [{ icon: icons.plus, label: section.create.label, onSelect: section.create.onSelect }]
      : [],
  ),
);

const pageItems = computed<CommandPaletteItem[]>(() =>
  [...sections.value.flatMap((section) => section.items), settingsLink].map((item) => ({
    icon: item.icon,
    label: item.label,
    to: item.to,
  })),
);

const groups = computed<CommandPaletteGroup[]>(() => {
  const result: CommandPaletteGroup[] = [
    { id: "create", items: createItems.value, label: "Créer" },
    { id: "pages", items: pageItems.value, label: "Aller à" },
  ];
  // Sans texte saisi, on s'en tient aux pages et aux actions.
  if (!term.value) {
    return result;
  }
  result.push(
    {
      id: "products",
      items: (products.data.value ?? []).map((product) => ({
        icon: icons.product,
        label: product.name,
        suffix: product.reference ?? product.category ?? undefined,
        to: `/produits/${product.id}`,
      })),
      label: "Produits",
    },
    {
      id: "customers",
      items: (customers.data.value ?? []).map((customer) => ({
        icon: icons.customer,
        label: customer.name,
        suffix: customer.phone ?? undefined,
        to: `/clients/${customer.id}`,
      })),
      label: "Clients",
    },
    {
      id: "purchases",
      items: (purchases.data.value ?? []).map((order) => ({
        icon: icons.purchases,
        label: order.reference,
        suffix: order.supplierName ?? undefined,
        to: `/achats/${order.id}`,
      })),
      label: "Commandes",
    },
  );
  if (term.value.length >= SALES_MIN_CHARS) {
    result.push({
      id: "sales",
      ignoreFilter: true,
      items: (sales.data.value?.items ?? []).map((sale) => ({
        icon: icons.sale,
        label: sale.reference,
        suffix: `${sale.customerName ?? "Client de passage"} · ${formatFcfa(sale.netFcfa)}`,
        to: `/ventes/${sale.id}`,
      })),
      label: "Ventes",
    });
  }
  return result;
});

const loading = computed(
  () =>
    products.isFetching.value ||
    customers.isFetching.value ||
    purchases.isFetching.value ||
    sales.isFetching.value,
);
</script>

<template>
  <UDashboardSearch
    v-model:open="open"
    v-model:search-term="searchTerm"
    :groups="groups"
    :loading="loading"
    placeholder="Rechercher une page, un produit, un client, une référence…"
    :fuse="{ resultLimit: 8 }"
  />
</template>
