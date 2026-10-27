<script setup lang="ts">
import type { ComparedValue, Preference } from "@G-stock/core/comparison";

/** Valeur comparée : écart à la référence, la meilleure en vert, la moins bonne en rouge. */
const {
  compared,
  format,
  preference = null,
  hint = "",
} = defineProps<{
  compared: ComparedValue | undefined;
  format: (value: number) => string;
  /** Sans préférence (poids, volume…), aucune couleur. */
  preference?: Preference | null;
  hint?: string;
}>();

const percent = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
  style: "percent",
});

const deltaColor = computed(() => {
  const delta = compared?.deltaRatio;
  if (!preference || !delta) {
    return "text-muted";
  }
  const better = preference === "lower" ? delta < 0 : delta > 0;
  return better ? "text-success" : "text-error";
});

const valueClass = computed(() => {
  if (!preference) {
    return "text-highlighted";
  }
  if (compared?.isBest) {
    return "text-success font-semibold";
  }
  if (compared?.isWorst) {
    return "text-error font-semibold";
  }
  return "text-highlighted";
});
</script>

<template>
  <div class="text-right tabular-nums">
    <span v-if="compared?.value === null || compared === undefined" class="text-dimmed">—</span>
    <template v-else>
      <span :class="valueClass">{{ format(compared.value ?? 0) }}</span>
      <p v-if="compared.deltaRatio !== null" class="text-xs" :class="deltaColor">
        {{ compared.deltaRatio === 0 ? "=" : percent.format(compared.deltaRatio) }}
      </p>
      <p v-if="hint" class="text-dimmed text-xs">{{ hint }}</p>
    </template>
  </div>
</template>
