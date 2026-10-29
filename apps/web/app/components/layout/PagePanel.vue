<script setup lang="ts">
import type { BreadcrumbItem } from "@nuxt/ui";

import AlertsMenu from "~/components/layout/AlertsMenu.vue";
import NowPill from "~/components/layout/NowPill.vue";
import ThemeMenu from "~/components/layout/ThemeMenu.vue";
import ThemeToggle from "~/components/layout/ThemeToggle.vue";
import UserMenu from "~/components/layout/UserMenu.vue";

/**
 * Cadre d'une page. En haut, la barre : panneau latéral, fil d'Ariane, date, thème, alertes et
 * profil. Dans le contenu, l'en-tête : icône (pages de détail), titre, badges et résumé à gauche ;
 * onglets en pilule (`tabs`) et actions à droite. `toolbar` accueille les filtres, sous l'en-tête.
 */
const { parents = [], title } = defineProps<{
  id: string;
  title: string;
  /** Résumé sous le titre ; le slot `description` le remplace. */
  description?: string;
  /** Tuile d'icône devant le titre, pour les pages de détail. */
  icon?: string;
  /** Pages parentes du fil d'Ariane ; la page en cours (`title`) s'ajoute à la fin. */
  parents?: BreadcrumbItem[];
}>();

defineSlots<{
  default?: () => unknown;
  actions?: () => unknown;
  badges?: () => unknown;
  description?: () => unknown;
  leading?: () => unknown;
  tabs?: () => unknown;
  toolbar?: () => unknown;
}>();

const breadcrumb = computed<BreadcrumbItem[]>(() => [...parents, { label: title }]);
</script>

<template>
  <UDashboardPanel :id="id">
    <template #header>
      <UDashboardNavbar>
        <template #leading>
          <UDashboardSidebarCollapse />
          <USeparator orientation="vertical" class="mx-1.5 hidden h-4 lg:flex" />
        </template>
        <template #title>
          <UBreadcrumb :items="breadcrumb" />
        </template>
        <template #right>
          <NowPill class="max-sm:hidden" />
          <div data-tour="theme" class="flex">
            <ThemeMenu />
          </div>
          <ThemeToggle />
          <div data-tour="alerts" class="flex">
            <AlertsMenu />
          </div>
          <USeparator orientation="vertical" class="mx-0.5 h-5" />
          <div data-tour="user" class="flex">
            <UserMenu />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <header class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div class="flex min-w-0 items-center gap-3">
          <slot name="leading">
            <span
              v-if="icon"
              class="bg-muted ring-default flex size-10 shrink-0 items-center justify-center rounded-xl ring"
            >
              <UIcon :name="icon" class="text-toned size-5" />
            </span>
          </slot>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 class="text-highlighted text-xl/7 font-semibold tracking-tight">{{ title }}</h1>
              <slot name="badges" />
            </div>
            <p
              v-if="description || $slots.description"
              class="text-muted mt-0.5 text-[13px] text-pretty"
            >
              <slot name="description">{{ description }}</slot>
            </p>
          </div>
        </div>
        <div
          v-if="$slots.tabs || $slots.actions"
          class="flex w-full flex-wrap items-center gap-2 sm:w-auto"
          data-tour="page-actions"
        >
          <slot name="tabs" />
          <slot name="actions" />
        </div>
      </header>

      <div v-if="$slots.toolbar" class="flex flex-wrap items-center gap-2">
        <slot name="toolbar" />
      </div>

      <slot />
    </template>
  </UDashboardPanel>
</template>
