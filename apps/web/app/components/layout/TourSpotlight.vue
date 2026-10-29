<script setup lang="ts">
/**
 * Voile de la visite guidée : la page est assombrie et bloquée, sauf un cadre lumineux autour du
 * repère de l'étape. Le cadre glisse d'un repère à l'autre ; sans repère, toute la page est voilée.
 */
const { target } = defineProps<{ target: string | null }>();

const PADDING = 6;

const element = shallowRef<HTMLElement | null>(null);
const box = ref({ height: 0, left: 0, top: 0, width: 0 });

const measure = () => {
  const rect = element.value?.getBoundingClientRect();
  box.value = rect
    ? {
        height: rect.height + 2 * PADDING,
        left: rect.left - PADDING,
        top: rect.top - PADDING,
        width: rect.width + 2 * PADDING,
      }
    : {
        height: 0,
        left: window.innerWidth / 2,
        top: window.innerHeight / 2,
        width: 0,
      };
};

// Nouvelle étape : le repère défile jusqu'à l'écran (useTour), on mesure pendant et après.
watch(
  () => target,
  async (selector) => {
    element.value = selector ? document.querySelector<HTMLElement>(selector) : null;
    await nextTick();
    measure();
    setTimeout(measure, 400);
  },
  { immediate: true },
);
// Le défilement d'un panneau intérieur ne remonte pas jusqu'à la fenêtre : on écoute en capture.
useEventListener(window, "scroll", measure, { capture: true, passive: true });
useEventListener(window, "resize", measure, { passive: true });

// L'ombre immense du cadre fait le voile ; le cadre lui-même reste clair.
const frameStyle = computed(() => ({
  boxShadow: "0 0 0 200vmax rgb(0 0 0 / 0.45)",
  height: `${box.value.height}px`,
  left: `${box.value.left}px`,
  top: `${box.value.top}px`,
  width: `${box.value.width}px`,
}));
</script>

<template>
  <div class="fixed inset-0 z-40" aria-hidden="true" @click.stop.prevent>
    <div
      class="absolute rounded-xl transition-[top,left,width,height] duration-300 ease-(--ease-in-out-strong) motion-reduce:transition-none"
      :class="target ? 'outline-primary/70 outline-2' : ''"
      :style="frameStyle"
    />
  </div>
</template>
