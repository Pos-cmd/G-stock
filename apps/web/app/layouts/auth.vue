<script setup lang="ts">
const icons = useIcons();
</script>

<template>
  <div class="bg-canvas flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-10">
    <div class="text-highlighted flex items-center gap-2.5">
      <span
        class="bg-inverted text-inverted shadow-primary flex size-9 items-center justify-center rounded-xl"
      >
        <UIcon :name="icons.logo" class="size-5" />
      </span>
      <span class="text-2xl font-semibold tracking-tight">G-stock</span>
    </div>
    <slot />
  </div>
</template>
