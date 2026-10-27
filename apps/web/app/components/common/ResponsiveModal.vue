<script setup lang="ts">
/**
 * Fenêtre qui s'adapte à l'écran : une modale centrée sur PC, un tiroir qui monte du bas sur
 * téléphone (plus facile à atteindre au pouce, et le clavier ne cache pas les boutons).
 * Même usage que UModal : `v-model:open`, `title`, `description`, slots `body` et `footer`.
 */
const { description, title, ui } = defineProps<{
  title?: string;
  description?: string;
  /** Classes de la modale (PC), ex. `{ content: 'sm:max-w-xl' }` ; le tiroir prend toute la largeur. */
  ui?: Record<string, string>;
}>();
const open = defineModel<boolean>("open", { required: true });

defineSlots<{ body?: () => unknown; footer?: () => unknown }>();

// Même seuil que le passage de la barre latérale en menu (md).
const isDesktop = useMediaQuery("(min-width: 768px)");
</script>

<template>
  <UModal v-if="isDesktop" v-model:open="open" :title="title" :description="description" :ui="ui">
    <template v-if="$slots.body" #body>
      <slot name="body" />
    </template>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </UModal>
  <UDrawer
    v-else
    v-model:open="open"
    :title="title"
    :description="description"
    :ui="{ body: 'overflow-y-auto', container: 'max-h-[90dvh]' }"
  >
    <template v-if="$slots.body" #body>
      <slot name="body" />
    </template>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </UDrawer>
</template>
