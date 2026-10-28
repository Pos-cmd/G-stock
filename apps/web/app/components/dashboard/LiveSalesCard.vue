<script setup lang="ts">
import { formatFcfa } from "@G-stock/core/format";
import { useQuery } from "@tanstack/vue-query";

// Chiffre d'affaires de la journée, cumulé heure par heure et comparé à hier à la même heure.
// Rafraîchi toutes les 30 secondes, et dès qu'une vente est enregistrée.
const REFRESH_MS = 30_000;

const icons = useIcons();
const { $orpc } = useNuxtApp();

const hourly = useQuery({
  ...$orpc.sales.byHour.queryOptions(),
  refetchInterval: REFRESH_MS,
});

const cumulate = (values: readonly number[]) => {
  let total = 0;
  return values.map((value) => {
    total += value;
    return total;
  });
};

const today = computed(() => cumulate(hourly.data.value?.today ?? []));
const yesterday = computed(() => cumulate(hourly.data.value?.yesterday ?? []));
const currentHour = computed(() => hourly.data.value?.currentHour ?? 0);

const totalToday = computed(() => today.value[currentHour.value] ?? 0);
const yesterdaySameHour = computed(() => yesterday.value[currentHour.value] ?? 0);
const trend = computed(() => trendRatio(totalToday.value, yesterdaySameHour.value));

// La courbe du jour s'arrête à l'heure en cours.
const rows = computed(() =>
  yesterday.value.map((value, hour) => ({
    hier: value,
    hour: `${hour} h`,
    ...(hour <= currentHour.value ? { today: today.value[hour] ?? 0 } : {}),
  })),
);

const saleCount = computed(() => hourly.data.value?.todayCount ?? 0);
</script>

<template>
  <UPageCard variant="subtle" title="Ventes du jour" :ui="{ container: 'gap-y-4' }">
    <template #title>
      <span class="flex w-full items-center justify-between gap-3">
        Ventes du jour
        <span
          class="bg-muted ring-default text-toned inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-sans text-xs font-medium tracking-normal normal-case ring"
        >
          <span class="relative flex size-2">
            <span
              class="bg-success absolute inline-flex size-full animate-ping rounded-full opacity-60"
            />
            <span class="bg-success relative inline-flex size-2 rounded-full" />
          </span>
          En direct
        </span>
      </span>
    </template>

    <div>
      <USkeleton v-if="hourly.isPending.value" class="h-9 w-48" />
      <p v-else class="flex flex-wrap items-baseline gap-x-2">
        <span class="text-highlighted text-[2rem]/10 font-semibold tracking-tight tabular-nums">
          {{ formatFcfa(totalToday) }}
        </span>
        <span class="text-muted text-sm">
          {{ saleCount }} vente{{ saleCount > 1 ? "s" : "" }}
        </span>
      </p>
      <p v-if="trend !== null" class="mt-1 flex items-center gap-1 text-sm">
        <UIcon
          :name="trend >= 0 ? icons.arrowUp : icons.arrowDown"
          class="size-4"
          :class="trend >= 0 ? 'text-success' : 'text-error'"
        />
        <span :class="trend >= 0 ? 'text-success' : 'text-error'" class="font-medium tabular-nums">
          {{ formatTrend(trend) }}
        </span>
        <span class="text-muted">par rapport à hier à {{ currentHour }} h</span>
      </p>
      <p v-else class="text-muted mt-1 text-sm">
        Hier à {{ currentHour }} h : {{ formatFcfa(yesterdaySameHour) }}
      </p>
    </div>

    <UChart
      type="area"
      :data="rows"
      index="hour"
      :categories="[
        { key: 'today', label: 'Aujourd\'hui' },
        { key: 'hier', label: 'Hier' },
      ]"
      curve="monotone"
      :height="200"
      :format="formatCompact"
      :legend="true"
      aria-label="Chiffre d'affaires cumulé, aujourd'hui et hier, heure par heure"
    />
  </UPageCard>
</template>
