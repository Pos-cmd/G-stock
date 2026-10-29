<script setup lang="ts">
/**
 * Petite courbe pour une cellule de tableau : la période (couleur des graphiques, aire légère) et,
 * en option, la période précédente (gris) sur la même échelle.
 */
const {
  compare = [],
  height = 32,
  values,
} = defineProps<{
  values: number[];
  compare?: number[];
  height?: number;
}>();

const WIDTH = 100;
const PADDING = 3;
const gradientId = `sparkline-${useId()}`;

const scaleMax = computed(() => Math.max(1, ...values, ...compare));
const points = (series: number[]) => {
  if (series.length < 2) {
    return "";
  }
  const step = WIDTH / (series.length - 1);
  return series
    .map((value, index) => {
      const y = height - PADDING - (value / scaleMax.value) * (height - 2 * PADDING);
      return `${(index * step).toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
};
const line = computed(() => points(values));
const previous = computed(() => points(compare));
const area = computed(() => (line.value ? `0,${height} ${line.value} ${WIDTH},${height}` : ""));
</script>

<template>
  <svg
    :viewBox="`0 0 ${WIDTH} ${height}`"
    preserveAspectRatio="none"
    class="block w-full overflow-visible"
    :style="{ height: `${height}px` }"
    aria-hidden="true"
  >
    <defs>
      <linearGradient :id="gradientId" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="var(--ui-chart-1)" stop-opacity="0.22" />
        <stop offset="100%" stop-color="var(--ui-chart-1)" stop-opacity="0" />
      </linearGradient>
    </defs>
    <polyline
      v-if="previous"
      :points="previous"
      fill="none"
      stroke="var(--ui-chart-2)"
      stroke-width="1.25"
      vector-effect="non-scaling-stroke"
      stroke-linejoin="round"
    />
    <polygon v-if="area" :points="area" :fill="`url(#${gradientId})`" />
    <polyline
      v-if="line"
      :points="line"
      fill="none"
      stroke="var(--ui-chart-1)"
      stroke-width="1.75"
      vector-effect="non-scaling-stroke"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  </svg>
</template>
