<script setup lang="ts">
import AppSearch from "~/components/layout/AppSearch.vue";
import AppTour from "~/components/layout/AppTour.vue";
import CreateDialogs from "~/components/layout/CreateDialogs.vue";
import { useSettingsStore } from "~/stores/settings";

const icons = useIcons();
const settingsStore = useSettingsStore();
const { sections, settingsLink } = useAppNavigation();

// Sur téléphone, la barre latérale est un menu : il se referme une fois la page choisie.
const open = ref(false);
const route = useRoute();
watch(
  () => route.fullPath,
  () => {
    open.value = false;
  },
);

onMounted(() => settingsStore.load());
const companyName = computed(() => settingsStore.settings?.companyName || undefined);
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar id="main" v-model:open="open" collapsible resizable>
      <template #header="{ collapsed }">
        <NuxtLink
          to="/"
          class="text-highlighted flex w-full min-w-0 items-center gap-2.5"
          :class="
            collapsed
              ? 'justify-center'
              : 'bg-default shadow-tactile ring-default rounded-lg p-1.5 ring'
          "
        >
          <span
            class="bg-inverted text-inverted shadow-primary flex size-7 shrink-0 items-center justify-center rounded-md"
          >
            <UIcon :name="icons.logo" class="size-4" />
          </span>
          <span v-if="!collapsed" class="min-w-0 leading-tight">
            <span class="block text-sm font-semibold tracking-tight">G-stock</span>
            <span v-if="companyName" class="text-muted block truncate text-xs">
              {{ companyName }}
            </span>
          </span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton
          :collapsed="collapsed"
          label="Rechercher"
          class="mb-1"
          data-tour="search"
        />

        <nav
          v-for="section in sections"
          :key="section.id"
          :aria-label="section.label"
          :data-tour="`nav-${section.id}`"
        >
          <div v-if="!collapsed" class="flex h-7 items-center justify-between ps-2.5 pe-0.5">
            <span class="text-dimmed font-mono text-[11px] font-medium tracking-[0.08em] uppercase">
              {{ section.label }}
            </span>
            <UTooltip v-if="section.create" :text="section.create.label">
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                :icon="icons.plus"
                :aria-label="section.create.label"
                :data-tour="`create-${section.id}`"
                @click="section.create.onSelect"
              />
            </UTooltip>
          </div>
          <USeparator v-else class="my-1.5" />
          <UNavigationMenu
            :collapsed="collapsed"
            :items="section.items"
            orientation="vertical"
            tooltip
          />
        </nav>

        <UNavigationMenu
          :collapsed="collapsed"
          :items="[settingsLink]"
          orientation="vertical"
          tooltip
          class="mt-auto"
        />
      </template>
    </UDashboardSidebar>

    <slot />

    <AppSearch />
    <CreateDialogs />
    <AppTour />
  </UDashboardGroup>
</template>
