<script setup lang="ts">
// Bascule clair / sombre dans la barre du haut.
const icons = useIcons();
const colorMode = useColorMode();

const isDark = computed(() => colorMode.value === "dark");
const label = computed(() => (isDark.value ? "Passer au thème clair" : "Passer au thème sombre"));

/**
 * La nouvelle apparence se révèle en cercle depuis le bouton (View Transitions). Sans cette API,
 * ou avec « réduire les animations », elle s'applique directement.
 */
const toggle = (event: MouseEvent) => {
  const next = isDark.value ? "light" : "dark";
  const apply = () => {
    colorMode.preference = next;
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.classList.toggle("light", next === "light");
  };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduceMotion) {
    apply();
    return;
  }
  const { clientX: x, clientY: y } = event;
  const root = document.documentElement.style;
  root.setProperty("--reveal-x", `${x}px`);
  root.setProperty("--reveal-y", `${y}px`);
  root.setProperty(
    "--reveal-radius",
    `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`,
  );
  document.startViewTransition(apply);
};
</script>

<template>
  <UTooltip :text="label">
    <UButton
      color="neutral"
      variant="outline"
      :icon="isDark ? icons.light : icons.dark"
      :aria-label="label"
      @click="toggle"
    />
  </UTooltip>
</template>
