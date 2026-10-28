<script setup lang="ts">
// Date et heure du jour dans la barre du haut, rafraîchies toutes les 30 secondes.
const REFRESH_MS = 30_000;

const now = useNow({ scheduler: (callback) => useIntervalFn(callback, REFRESH_MS) });

const dayFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  weekday: "short",
});
const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

// « mar. 28 oct. » devient « MAR 28 OCT » (majuscules en CSS).
const label = computed(
  () => `${dayFormat.format(now.value).replaceAll(".", "")} · ${timeFormat.format(now.value)}`,
);
</script>

<template>
  <span
    class="bg-muted ring-default text-toned inline-flex h-7 items-center gap-2 rounded-full px-2.5 font-mono text-[11px] font-medium tracking-[0.06em] whitespace-nowrap uppercase tabular-nums ring"
  >
    <span class="bg-success size-1.5 rounded-full" />
    <ClientOnly>{{ label }}</ClientOnly>
  </span>
</template>
