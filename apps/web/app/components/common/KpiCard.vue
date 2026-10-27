<script setup lang="ts">
const {
  color = "primary",
  hint = "",
  icon,
  label,
  loading = false,
  to = "",
  upcoming = false,
  value,
} = defineProps<{
  label: string;
  value: string;
  icon: string;
  hint?: string;
  color?: "primary" | "success" | "warning" | "error" | "neutral";
  loading?: boolean;
  to?: string;
  upcoming?: boolean;
}>();

const iconColors = {
  error: "bg-error/10 text-error",
  neutral: "bg-elevated text-muted",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
} as const;
</script>

<template>
  <UPageCard
    :to="to || undefined"
    variant="subtle"
    :class="upcoming ? 'opacity-60' : undefined"
    :ui="{ container: 'gap-y-3', wrapper: 'items-start' }"
  >
    <div class="flex items-center justify-between gap-3">
      <span class="text-muted text-sm font-medium">{{ label }}</span>
      <span class="flex size-9 items-center justify-center rounded-lg" :class="iconColors[color]">
        <UIcon :name="icon" class="size-5" />
      </span>
    </div>
    <USkeleton v-if="loading" class="h-8 w-32" />
    <div v-else class="flex items-baseline gap-2">
      <span class="text-highlighted text-2xl font-semibold tabular-nums">{{ value }}</span>
      <UBadge v-if="upcoming" color="neutral" variant="subtle" size="sm">À venir</UBadge>
    </div>
    <p v-if="hint" class="text-dimmed text-xs">{{ hint }}</p>
  </UPageCard>
</template>
