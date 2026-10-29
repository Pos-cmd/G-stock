<script setup lang="ts">
/**
 * Carte de statistique : libellé, valeur, évolution par rapport à la période précédente et petite
 * courbe de la période (survol : valeur de chaque point). Les textes sont sur la surface blanche ;
 * la courbe est dessous, dans le cadre, d'un bord à l'autre de la carte.
 */
const {
  color = "primary",
  format = (value: number) => String(value),
  hint = "",
  icon = "",
  label,
  loading = false,
  series = [],
  to = "",
  trend = null,
  trendInverted = false,
  trendLabel = "",
  upcoming = false,
  value,
} = defineProps<{
  label: string;
  value: string;
  icon?: string;
  hint?: string;
  color?: "primary" | "success" | "warning" | "error" | "neutral";
  loading?: boolean;
  to?: string;
  upcoming?: boolean;
  /** Évolution (0,08 = +8 %) ; `null` : pas de badge. */
  trend?: number | null;
  /** Une baisse est une bonne nouvelle (créances, ruptures). */
  trendInverted?: boolean;
  /** Ce à quoi l'évolution se compare, lu au survol du badge. */
  trendLabel?: string;
  /** Points de la courbe, du plus ancien au plus récent. */
  series?: { label: string; value: number }[];
  /** Format des valeurs de la courbe au survol. */
  format?: (value: number) => string;
}>();

const icons = useIcons();

const iconColors = {
  error: "bg-error/10 text-error ring-error/20",
  neutral: "bg-muted text-muted ring-default",
  primary: "bg-muted text-highlighted ring-default",
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/10 text-warning ring-warning/25",
} as const;

const NuxtLink = resolveComponent("NuxtLink");

const hasSeries = computed(() => series.length > 1);
const trendIsGood = computed(() => trend !== null && trend >= 0 !== trendInverted);
</script>

<template>
  <component
    :is="to ? NuxtLink : 'div'"
    :to="to || undefined"
    class="bg-elevated relative flex flex-col overflow-hidden rounded-xl p-1"
    :class="[
      upcoming ? 'opacity-60' : '',
      to
        ? 'hover:bg-accented/60 focus-visible:outline-primary/40 transition-[background-color,transform] duration-150 ease-(--ease-snappy) focus-visible:outline-2 active:scale-[0.985]'
        : '',
    ]"
  >
    <div
      class="bg-default shadow-card ring-default flex flex-1 flex-col gap-y-2 rounded-[calc(var(--radius-xl)-0.25rem)] p-4 ring sm:p-5"
    >
      <div class="flex w-full items-center gap-2.5">
        <span
          v-if="icon"
          class="flex size-7 shrink-0 items-center justify-center rounded-md ring ring-inset"
          :class="iconColors[color]"
        >
          <UIcon :name="icon" class="size-4" />
        </span>
        <span class="text-toned min-w-0 flex-1 truncate text-sm font-medium">{{ label }}</span>
        <UTooltip v-if="trend !== null && !loading" :text="trendLabel" :disabled="!trendLabel">
          <UBadge
            :color="trendIsGood ? 'success' : 'error'"
            variant="subtle"
            size="sm"
            :icon="trend >= 0 ? icons.arrowUp : icons.arrowDown"
            class="tabular-nums"
          >
            {{ formatTrend(trend) }}
          </UBadge>
        </UTooltip>
      </div>
      <USkeleton v-if="loading" class="h-8 w-32" />
      <div v-else class="flex items-baseline gap-2">
        <span
          class="text-highlighted text-[clamp(1.25rem,1.6vw,1.75rem)]/9 font-semibold tracking-tight whitespace-nowrap tabular-nums"
          >{{ value }}</span
        >
        <UBadge v-if="upcoming" color="neutral" variant="subtle" size="sm">À venir</UBadge>
      </div>
      <p v-if="hint" class="text-muted text-xs">{{ hint }}</p>
    </div>
    <div v-if="hasSeries" class="-mx-1 -mb-1 pt-1.5">
      <UChart
        type="area"
        :data="series"
        index="label"
        :categories="[{ key: 'value', label }]"
        curve="monotone"
        :height="52"
        :x-axis="false"
        :y-axis="false"
        :grid="false"
        :legend="false"
        :format="format"
        :aria-label="`Évolution : ${label}`"
      />
    </div>
  </component>
</template>
