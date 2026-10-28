<script setup lang="ts">
/**
 * Fenêtre qui s'adapte à l'écran. Sur PC, `variant` choisit la forme :
 * - `slideover` (par défaut) : panneau latéral pour les formulaires de plusieurs champs ; la page
 *   reste visible à côté et le pied du panneau garde les boutons à portée.
 * - `modal` : petite fenêtre centrée pour une confirmation ou une saisie courte (1 à 3 champs).
 * Sur téléphone, les deux deviennent un tiroir qui monte du bas (plus facile à atteindre au pouce,
 * et le clavier ne cache pas les boutons).
 * Même usage que UModal : `v-model:open`, `title`, `description`, slots `body` et `footer`.
 */
const {
  description,
  dismissible = true,
  title,
  ui,
  variant = "slideover",
} = defineProps<{
  title?: string;
  description?: string;
  variant?: "slideover" | "modal";
  /** `false` : ni Échap, ni un clic à côté ne ferment la fenêtre (confirmation destructive). */
  dismissible?: boolean;
  /** Classes de la fenêtre sur PC, ex. `{ content: 'sm:max-w-2xl' }` ; le tiroir prend toute la largeur. */
  ui?: Record<string, string>;
}>();
const open = defineModel<boolean>("open", { required: true });

defineSlots<{ body?: () => unknown; footer?: () => unknown }>();

// Même seuil que le passage de la barre latérale en menu (md).
const isDesktop = useMediaQuery("(min-width: 768px)");

// Assez large pour les formulaires sur deux colonnes.
const slideoverUi = computed(() => ({ content: "sm:max-w-xl", ...ui }));
</script>

<template>
  <USlideover
    v-if="isDesktop && variant === 'slideover'"
    v-model:open="open"
    :title="title"
    :description="description"
    :dismissible="dismissible"
    :ui="slideoverUi"
  >
    <template v-if="$slots.body" #body>
      <slot name="body" />
    </template>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </USlideover>
  <UModal
    v-else-if="isDesktop"
    v-model:open="open"
    :title="title"
    :description="description"
    :dismissible="dismissible"
    :ui="ui"
  >
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
    :dismissible="dismissible"
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
