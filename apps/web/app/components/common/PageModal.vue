<script setup lang="ts">
/**
 * Grande fenêtre pour un formulaire qui a aussi sa page (nouvelle vente, commande, simulation) :
 * on saisit sans quitter l'écran en cours. « Ouvrir en pleine page » émet `expand` : le parent
 * transmet la saisie à la page, puis y navigue.
 * Un clic à côté ne ferme pas la fenêtre (la saisie serait perdue) ; Échap et la croix la ferment.
 */
defineProps<{
  title: string;
  icon?: string;
  /** Affiche le bouton « Ouvrir en pleine page ». */
  expandable?: boolean;
}>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ expand: [] }>();

defineSlots<{ body?: () => unknown; footer?: () => unknown }>();

const icons = useIcons();
const isDesktop = useMediaQuery("(min-width: 768px)");

const keepOpenOnOutsideClick = (event: Event) => {
  event.preventDefault();
};
// À l'ouverture, le focus va sur la fenêtre elle-même plutôt que sur son premier bouton
// (l'infobulle « Ouvrir en pleine page » s'afficherait d'emblée).
const focusDialog = (event: Event) => {
  event.preventDefault();
  if (event.target instanceof HTMLElement) {
    event.target.focus();
  }
};
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    :fullscreen="!isDesktop"
    :content="{ onInteractOutside: keepOpenOnOutsideClick, onOpenAutoFocus: focusDialog }"
    :ui="{
      content: 'md:h-[calc(100dvh-3rem)] md:w-[calc(100vw-3rem)] md:max-w-7xl',
      header: 'gap-2 sm:px-5',
      wrapper: 'min-w-0 flex-1',
      close: 'static',
      body: 'sm:px-6 sm:py-5',
      footer: 'justify-end gap-2 sm:px-5',
    }"
  >
    <template #title>
      <span class="flex min-w-0 items-center gap-2.5">
        <span
          v-if="icon"
          class="bg-muted ring-default flex size-7 shrink-0 items-center justify-center rounded-lg ring"
        >
          <UIcon :name="icon" class="text-toned size-4" />
        </span>
        <span class="truncate text-[15px] tracking-tight">{{ title }}</span>
      </span>
    </template>

    <template v-if="expandable" #actions>
      <UTooltip text="Ouvrir en pleine page">
        <UButton
          color="neutral"
          variant="ghost"
          :icon="icons.expand"
          aria-label="Ouvrir en pleine page"
          @click="emit('expand')"
        />
      </UTooltip>
    </template>

    <template v-if="$slots.body" #body>
      <slot name="body" />
    </template>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </UModal>
</template>
