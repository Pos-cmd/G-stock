<script setup lang="ts">
const icons = useIcons();

defineProps<{
  icon: string;
  description: string;
  features: string[];
}>();
</script>

<template>
  <div class="mx-auto flex max-w-xl flex-col items-center gap-6 py-16 text-center">
    <span class="bg-primary/10 text-primary flex size-16 items-center justify-center rounded-2xl">
      <UIcon :name="icon" class="size-8" />
    </span>
    <div class="space-y-2">
      <UBadge color="neutral" variant="subtle">Bientôt disponible</UBadge>
      <p class="text-muted">{{ description }}</p>
    </div>
    <ul class="w-full space-y-2 text-left">
      <li
        v-for="feature in features"
        :key="feature"
        class="border-default flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
      >
        <UIcon :name="icons.comingSoon" class="text-dimmed mt-0.5 size-4 shrink-0" />
        <span>{{ feature }}</span>
      </li>
    </ul>
  </div>
</template>
