<script setup lang="ts">
defineProps<{
  id: string;
  title: string;
  icon?: string;
}>();

// Sur téléphone, les actions ne tiennent pas à côté du titre : elles passent sur leur propre ligne.
const isDesktop = useMediaQuery("(min-width: 768px)");
</script>

<template>
  <UDashboardPanel :id="id">
    <template #header>
      <UDashboardNavbar :title="title" :icon="icon">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template v-if="$slots.actions && isDesktop" #right>
          <slot name="actions" />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar v-if="$slots.actions && !isDesktop">
        <div class="flex w-full flex-wrap items-center gap-2 py-2">
          <slot name="actions" />
        </div>
      </UDashboardToolbar>
      <UDashboardToolbar v-if="$slots.toolbar">
        <slot name="toolbar" />
      </UDashboardToolbar>
    </template>

    <template #body>
      <slot />
    </template>
  </UDashboardPanel>
</template>
