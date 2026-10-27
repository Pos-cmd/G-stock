<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";
import { useQuery } from "@tanstack/vue-query";

import UserMenu from "~/components/layout/UserMenu.vue";

const { $orpc } = useNuxtApp();
const open = ref(false);

const summary = useQuery($orpc.stock.summary.queryOptions());
const sales = useQuery($orpc.sales.summary.queryOptions());
const criticalDebtors = computed(() => sales.data.value?.criticalDebtorCount ?? 0);
const alertCount = computed(() => {
  const data = summary.data.value;
  return data ? data.lowCount + data.outCount : 0;
});

const closeOnMobile = () => {
  open.value = false;
};

const mainLinks = computed<NavigationMenuItem[]>(() => [
  {
    icon: "i-lucide-layout-dashboard",
    label: "Tableau de bord",
    onSelect: closeOnMobile,
    to: "/",
  },
  {
    badge: alertCount.value > 0 ? { color: "error", label: String(alertCount.value) } : undefined,
    children: [
      { label: "Produits", onSelect: closeOnMobile, to: "/produits" },
      { label: "Mouvements", onSelect: closeOnMobile, to: "/stock/mouvements" },
    ],
    defaultOpen: true,
    icon: "i-lucide-boxes",
    label: "Stock & Produits",
    type: "trigger",
  },
  {
    children: [
      { label: "Nouvelle vente", onSelect: closeOnMobile, to: "/ventes/nouvelle" },
      { exact: true, label: "Historique", onSelect: closeOnMobile, to: "/ventes" },
    ],
    defaultOpen: true,
    icon: "i-lucide-shopping-cart",
    label: "Ventes",
    type: "trigger",
  },
  {
    badge:
      criticalDebtors.value > 0
        ? { color: "error", label: String(criticalDebtors.value) }
        : undefined,
    icon: "i-lucide-users",
    label: "Clients",
    onSelect: closeOnMobile,
    to: "/clients",
  },
  {
    children: [
      { label: "Commandes", onSelect: closeOnMobile, to: "/achats", exact: true },
      { label: "Fournisseurs", onSelect: closeOnMobile, to: "/achats/fournisseurs" },
    ],
    defaultOpen: true,
    icon: "i-lucide-ship",
    label: "Achats",
    type: "trigger",
  },
  {
    children: [
      { exact: true, label: "Simulations", onSelect: closeOnMobile, to: "/simulateur" },
      { label: "Comparer", onSelect: closeOnMobile, to: "/simulateur/comparer" },
    ],
    defaultOpen: true,
    icon: "i-lucide-calculator",
    label: "Simulateur",
    type: "trigger",
  },
  {
    icon: "i-lucide-file-text",
    label: "Documents",
    onSelect: closeOnMobile,
    to: "/documents",
  },
]);

const secondaryLinks: NavigationMenuItem[] = [
  {
    icon: "i-lucide-settings",
    label: "Paramètres",
    onSelect: closeOnMobile,
    to: "/parametres",
  },
];
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="main"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="text-highlighted flex items-center gap-2 px-1">
          <UIcon name="i-lucide-boxes" class="text-primary size-6 shrink-0" />
          <span v-if="!collapsed" class="text-lg font-semibold tracking-tight">G-stock</span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="mainLinks"
          orientation="vertical"
          tooltip
          popover
        />
        <UNavigationMenu
          :collapsed="collapsed"
          :items="secondaryLinks"
          orientation="vertical"
          tooltip
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <slot />
  </UDashboardGroup>
</template>
