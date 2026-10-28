<script setup lang="ts">
// Bascule clair / sombre dans la barre du haut.
const icons = useIcons();
const colorMode = useColorMode();

const isDark = computed(() => colorMode.value === "dark");
const label = computed(() => (isDark.value ? "Passer au thème clair" : "Passer au thème sombre"));

const toggle = () => {
  colorMode.preference = isDark.value ? "light" : "dark";
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
