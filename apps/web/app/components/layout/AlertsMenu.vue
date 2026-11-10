<script setup lang="ts">
// Cloche de la barre du haut : ce qui demande une action (stock, créances, sauvegarde).
const icons = useIcons();
const alerts = useAlerts();

const open = ref(false);
const tileColors = {
  error: "bg-error/10 text-error ring-error/20",
  warning: "bg-warning/10 text-warning ring-warning/20",
} as const;
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'end', sideOffset: 8 }">
    <UChip :show="alerts.length > 0" color="error" size="sm" inset>
      <UButton
        color="neutral"
        variant="outline"
        :icon="icons.notifications"
        :aria-label="alerts.length > 0 ? `Alertes (${alerts.length})` : 'Alertes'"
      />
    </UChip>

    <template #content>
      <div class="w-80">
        <p
          class="text-muted border-default border-b px-3 py-2.5 font-mono text-[11px] font-medium tracking-[0.08em] uppercase"
        >
          À traiter
        </p>
        <ul v-if="alerts.length > 0" class="p-1">
          <li v-for="alert in alerts" :key="alert.id">
            <NuxtLink
              :to="alert.to"
              class="hover:bg-muted flex gap-3 rounded-md p-2 transition-colors"
              @click="open = false"
            >
              <span
                class="flex size-7 shrink-0 items-center justify-center rounded-md ring ring-inset"
                :class="tileColors[alert.color]"
              >
                <UIcon :name="alert.icon" class="size-4" />
              </span>
              <span class="min-w-0">
                <span class="text-highlighted block text-sm font-medium">{{ alert.title }}</span>
                <span class="text-muted block text-xs">{{ alert.description }}</span>
              </span>
            </NuxtLink>
          </li>
        </ul>
        <div v-else class="flex flex-col items-center gap-1.5 px-3 py-6 text-center">
          <UIcon :name="icons.success" class="text-success size-5" />
          <p class="text-highlighted text-sm font-medium">Rien à signaler</p>
          <p class="text-muted text-xs">Stock, créances et sauvegarde sont en ordre.</p>
        </div>
      </div>
    </template>
  </UPopover>
</template>
