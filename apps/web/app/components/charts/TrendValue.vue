<script setup lang="ts">
// Montant d'une cellule et son évolution par rapport à la période précédente (▲ 15,6 %).
const {
  inverted = false,
  ratio = null,
  value,
} = defineProps<{
  value: string;
  ratio?: number | null;
  /** Une baisse est une bonne nouvelle. */
  inverted?: boolean;
}>();

const icons = useIcons();
const good = computed(() => ratio !== null && ratio >= 0 !== inverted);
</script>

<template>
  <span class="inline-flex items-baseline justify-end gap-1.5 whitespace-nowrap">
    <span class="text-highlighted font-medium tabular-nums">{{ value }}</span>
    <span
      v-if="ratio !== null"
      class="inline-flex items-center gap-0.5 text-xs font-medium tabular-nums"
      :class="good ? 'text-success' : 'text-error'"
    >
      <UIcon :name="ratio >= 0 ? icons.trendUp : icons.trendDown" class="size-3.5 self-center" />
      {{ formatTrend(ratio).replace("+", "").replace("-", "") }}
    </span>
  </span>
</template>
