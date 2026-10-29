<script setup lang="ts">
/**
 * Capture de l'application. Sur grand écran, la capture entière (ou sa partie haute avec
 * `height`) ; sur téléphone, une fenêtre lisible centrée sur `focus` plutôt que tout l'écran
 * réduit au point d'être illisible.
 */
const {
  alt,
  focus = [0.5, 0.4],
  height = 1,
  src,
} = defineProps<{
  src: string;
  alt: string;
  /** Point à garder visible sur téléphone, en fraction de la capture (x, y). */
  focus?: [number, number];
  /** Part de la hauteur montrée sur grand écran (1 : la capture entière). */
  height?: number;
}>();

const style = computed(() => ({
  "--desktop-ratio": `1280 / ${800 * height}`,
  "--part": height,
  "--fx": focus[0],
  "--fy": focus[1],
}));
</script>

<template>
  <div class="capture ring-default bg-default relative overflow-hidden rounded-xl ring" :style>
    <img :src :alt width="1280" height="800" loading="lazy" class="block w-full" />
  </div>
</template>

<style scoped>
.capture {
  aspect-ratio: var(--desktop-ratio);
}

/* Téléphone : la capture à 75 % de sa taille d'écran d'origine, cadrée sur le point choisi. */
@media (max-width: 639px) {
  .capture {
    --w: 60rem;
    --h: calc(var(--w) * 0.625);
    aspect-ratio: auto;
    /* Jamais plus que la partie montrée sur grand écran. */
    height: min(22rem, calc(var(--h) * var(--part)));
  }
  .capture img {
    position: absolute;
    width: var(--w);
    max-width: none;
    left: clamp(calc(100% - var(--w)), calc(50% - var(--fx) * var(--w)), 0px);
    top: clamp(calc(100% - var(--h)), calc(50% - var(--fy) * var(--h)), 0px);
  }
}
</style>
