<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";
import { useQuery } from "@tanstack/vue-query";

import UserMenu from "~/components/layout/UserMenu.vue";

const { $orpc } = useNuxtApp();
const open = ref(false);

const summary = useQuery($orpc.stock.summary.queryOptions());
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
    icon: "i-lucide-shopping-cart",
    label: "Ventes",
    onSelect: closeOnMobile,
    to: "/ventes",
  },
  {
    icon: "i-lucide-users",
    label: "Clients débiteurs",
    onSelect: closeOnMobile,
    to: "/clients",
  },
  {
    icon: "i-lucide-ship",
    label: "Achats",
    onSelect: closeOnMobile,
    to: "/achats",
  },
  {
    icon: "i-lucide-calculator",
    label: "Simulateur",
    onSelect: closeOnMobile,
    to: "/simulateur",
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
