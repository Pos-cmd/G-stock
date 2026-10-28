<script setup lang="ts">
const icons = useIcons();
</script>

<template>
  <div class="bg-elevated/40 flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-10">
    <div class="text-highlighted flex items-center gap-2">
      <UIcon :name="icons.logo" class="text-primary size-8" />
      <span class="text-2xl font-semibold tracking-tight">G-stock</span>
    </div>
    <slot />
  </div>
</template>
