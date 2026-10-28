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
  error: "bg-error/10 text-error ring-error/20",
  neutral: "bg-muted text-muted ring-default",
  primary: "bg-muted text-highlighted ring-default",
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/10 text-warning ring-warning/25",
} as const;
</script>

<template>
  <UPageCard
    :to="to || undefined"
    variant="subtle"
    :class="upcoming ? 'opacity-60' : undefined"
    :ui="{ container: 'gap-y-3', wrapper: 'items-start' }"
  >
    <div class="flex items-center gap-2.5">
      <span
        class="flex size-7 shrink-0 items-center justify-center rounded-md ring ring-inset"
        :class="iconColors[color]"
      >
        <UIcon :name="icon" class="size-4" />
      </span>
      <span class="text-toned text-sm font-medium">{{ label }}</span>
    </div>
    <USkeleton v-if="loading" class="h-8 w-32" />
    <div v-else class="flex items-baseline gap-2">
      <span class="text-highlighted text-[1.625rem]/8 font-semibold tracking-tight tabular-nums">{{
        value
      }}</span>
      <UBadge v-if="upcoming" color="neutral" variant="subtle" size="sm">À venir</UBadge>
    </div>
    <p v-if="hint" class="text-dimmed text-xs">{{ hint }}</p>
  </UPageCard>
</template>
