<script setup lang="ts">
/**
 * Calendrier d'activité : une colonne par semaine (du lundi au dimanche), une case par jour,
 * d'autant plus foncée que la valeur est haute. Survol ou focus : le détail du jour s'affiche
 * sous la grille ; clic ou Entrée : `select` avec le jour (AAAA-MM-JJ).
 */
const {
  days,
  describe,
  summary = "",
} = defineProps<{
  /** Jours consécutifs, du plus ancien au plus récent. */
  days: { date: string; value: number }[];
  /** Détail d'un jour, ex. « 3 ventes · 450 000 FCFA ». */
  describe: (date: string, value: number) => string;
  /** Texte affiché quand aucun jour n'est survolé. */
  summary?: string;
}>();
const emit = defineEmits<{ select: [date: string] }>();

const LEVELS = 4;
const DAYS_PER_WEEK = 7;
const WEEKDAY_LABELS = ["Lun", "", "Mer", "", "Ven", "", ""];

const levelClasses = [
  "bg-accented/60",
  "bg-(--ui-chart-1)/25",
  "bg-(--ui-chart-1)/45",
  "bg-(--ui-chart-1)/70",
  "bg-(--ui-chart-1)",
];

const monthFormat = new Intl.DateTimeFormat("fr-FR", { month: "short" });

interface Cell {
  date: string;
  value: number;
  level: number;
}

const maxValue = computed(() => Math.max(0, ...days.map((day) => day.value)));

// Colonnes de 7 cases ; la première semaine est complétée par des cases vides avant le premier jour.
const weeks = computed(() => {
  const [first] = days;
  if (!first) {
    return [];
  }
  const offset = (fromDateInputValue(first.date).getDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
  const cells: (Cell | null)[] = Array.from({ length: offset }, () => null);
  for (const day of days) {
    const ratio = maxValue.value > 0 ? day.value / maxValue.value : 0;
    cells.push({
      ...day,
      level: day.value > 0 ? Math.max(1, Math.ceil(ratio * LEVELS)) : 0,
    });
  }
  const columns: (Cell | null)[][] = [];
  for (let index = 0; index < cells.length; index += DAYS_PER_WEEK) {
    columns.push(cells.slice(index, index + DAYS_PER_WEEK));
  }
  return columns;
});

// Nom du mois au-dessus de la semaine où il commence.
const monthLabels = computed(() =>
  weeks.value.map((week, index) => {
    const firstOfMonth = week.find((cell) => cell?.date.endsWith("-01"));
    if (firstOfMonth) {
      return monthFormat.format(fromDateInputValue(firstOfMonth.date));
    }
    const firstCell = week.find(Boolean);
    return index === 0 && firstCell ? monthFormat.format(fromDateInputValue(firstCell.date)) : "";
  }),
);

const active = ref<Cell | null>(null);
const caption = computed(() =>
  active.value
    ? `${formatDayLabel(active.value.date)} · ${describe(active.value.date, active.value.value)}`
    : summary,
);

// Les semaines récentes sont à droite : on y défile d'emblée sur les petits écrans.
const scroller = useTemplateRef("scroller");
onMounted(() => {
  if (scroller.value) {
    scroller.value.scrollLeft = scroller.value.scrollWidth;
  }
});
</script>

<template>
  <div class="space-y-3">
    <div ref="scroller" class="overflow-x-auto pb-1">
      <!-- Une seule grille : colonne des jours, puis une colonne par semaine. Les cases sont
           carrées et s'élargissent avec la carte (de 10 px à la largeur disponible). -->
      <div
        class="grid min-w-max grid-flow-col grid-rows-[1rem_repeat(7,auto)] gap-0.75 sm:min-w-0"
        :style="{ gridTemplateColumns: `auto repeat(${weeks.length}, minmax(0.625rem, 1fr))` }"
        @mouseleave="active = null"
      >
        <span />
        <span
          v-for="(weekday, index) in WEEKDAY_LABELS"
          :key="`day-${index}`"
          class="text-dimmed self-center pe-1.5 text-[10px] leading-none"
        >
          {{ weekday }}
        </span>
        <template v-for="(week, column) in weeks" :key="column">
          <span class="text-dimmed text-[10px] leading-4 whitespace-nowrap">
            {{ monthLabels[column] }}
          </span>
          <template v-for="(cell, row) in week" :key="row">
            <button
              v-if="cell"
              type="button"
              class="focus-visible:outline-inverted aspect-square w-full rounded-[3px] transition-transform hover:scale-125 focus-visible:outline-2 focus-visible:outline-offset-1"
              :class="levelClasses[cell.level]"
              :aria-label="`${formatDayLabel(cell.date)} : ${describe(cell.date, cell.value)}`"
              @mouseenter="active = cell"
              @focus="active = cell"
              @blur="active = null"
              @click="emit('select', cell.date)"
            />
            <span v-else class="aspect-square w-full" />
          </template>
        </template>
      </div>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
      <p class="text-toned min-h-4 tabular-nums" aria-live="polite">
        {{ caption }}
      </p>
      <div class="text-dimmed flex items-center gap-1">
        <span class="me-1">Moins</span>
        <span
          v-for="level in levelClasses"
          :key="level"
          class="size-3 rounded-[3px]"
          :class="level"
        />
        <span class="ms-1">Plus</span>
      </div>
    </div>
  </div>
</template>
