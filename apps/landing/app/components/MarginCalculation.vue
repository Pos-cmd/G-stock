<script setup lang="ts">
/**
 * Ouverture : la vraie marge d'une pièce de wax, construite terme par terme. Chiffres de la base
 * de démonstration (commande CF-2026-0028) ; le prix de vente se modifie et tout se recalcule.
 */
const FACTORY_RMB = 48;
const RMB_PER_USD = 7.12;
const FCFA_PER_USD = 572;
const GOODS = Math.round((FACTORY_RMB / RMB_PER_USD) * FCFA_PER_USD);
const FEES = 940;
const COST = GOODS + FEES;
const DEFAULT_PRICE = 7000;

const price = ref(DEFAULT_PRICE);
const margin = computed(() => price.value - COST);
const marginRate = computed(() => (price.value > 0 ? margin.value / price.value : 0));

const fcfa = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
  style: "percent",
});
const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const money = (value: number) => fcfa.format(value);
const NB = "\u00A0";

// Découpe du prix de vente (ou du revient, quand on vend à perte).
const total = computed(() => Math.max(price.value, COST, 1));
const share = (value: number) => `${(Math.max(value, 0) / total.value) * 100}%`;
const SEGMENTS = computed(() => [
  { color: "bg-sand-700", label: "Marchandise", value: GOODS },
  { color: "bg-sand-400", label: "Frais d'approche", value: FEES },
  {
    color: margin.value >= 0 ? "bg-data" : "bg-error",
    label: margin.value >= 0 ? "Marge" : "Perte",
    value: Math.abs(margin.value),
  },
]);
</script>

<template>
  <section class="mx-auto max-w-[80rem] px-4 pt-10 pb-20 sm:px-8 sm:pt-14">
    <h1
      class="play-in max-w-[62rem] text-[clamp(2.4rem,5.6vw,4.75rem)]/[1.02] font-semibold tracking-[-0.035em] text-balance"
    >
      La vraie marge de chaque produit, frais compris.
    </h1>
    <p class="play-in text-muted mt-5 max-w-[42rem] text-lg text-pretty" style="--at: 80ms">
      G-stock suit vos commandes de Chine, votre stock et vos ventes à crédit, et calcule ce que
      chaque produit vous rapporte vraiment. Exemple : une pièce de wax hollandais 6&nbsp;yards.
    </p>

    <!--
      Grand écran : deux opérations sur une grille de 7 colonnes (terme, opérateur, terme…).
      Téléphone : une colonne de registre, l'opérateur à gauche de chaque terme.
    -->
    <div
      class="mt-12 grid grid-cols-[2rem_minmax(0,1fr)] gap-y-5 lg:grid-cols-[repeat(3,minmax(0,1fr)_2.5rem)_minmax(0,1fr)] lg:gap-y-10"
    >
      <div class="play-in term" style="--at: 200ms">
        <p class="term-label">Prix usine</p>
        <p class="term-value">{{ FACTORY_RMB }} ¥</p>
        <p class="term-note">la pièce, chez le fournisseur</p>
      </div>
      <span class="play-in op" style="--at: 260ms" aria-hidden="true">≈</span>
      <div class="play-in term" style="--at: 320ms">
        <p class="term-label">Marchandise</p>
        <p class="term-value">{{ money(GOODS) }} <small>FCFA</small></p>
        <p class="term-note">
          1&nbsp;$ = {{ decimal.format(RMB_PER_USD) }}&nbsp;¥ = {{ FCFA_PER_USD }}&nbsp;FCFA
        </p>
      </div>
      <span class="play-in op" style="--at: 380ms" aria-hidden="true">+</span>
      <div class="play-in term" style="--at: 440ms">
        <p class="term-label">Frais d'approche</p>
        <p class="term-value">{{ money(FEES) }} <small>FCFA</small></p>
        <p class="term-note">fret, douane, transit, répartis</p>
      </div>
      <span class="play-in op op-total" style="--at: 500ms" aria-hidden="true">=</span>
      <div class="play-in term term-total" style="--at: 560ms">
        <p class="term-label">Prix de revient</p>
        <p class="term-value">{{ money(COST) }} <small>FCFA</small></p>
        <p class="term-note">au magasin, par pièce</p>
      </div>

      <div class="play-in term lg:col-start-3" style="--at: 680ms">
        <label for="sale-price" class="term-label">Prix de vente</label>
        <UInputNumber
          id="sale-price"
          v-model="price"
          :min="0"
          :max="99999"
          :step="100"
          orientation="vertical"
          :format-options="{ maximumFractionDigits: 0 }"
          class="mt-1 w-full max-w-[13rem]"
          :ui="{
            base: 'text-[length:clamp(1.6rem,2.4vw,2.25rem)] md:text-[length:clamp(1.6rem,2.4vw,2.25rem)] font-semibold tracking-tight tabular-nums h-14 ps-3',
          }"
        />
        <p class="term-note">modifiez-le{{ NB }}: tout se recalcule</p>
      </div>
      <span class="play-in op" style="--at: 720ms" aria-hidden="true">−</span>
      <div class="play-in term" style="--at: 760ms">
        <p class="term-label">Prix de revient</p>
        <p class="term-value text-muted">{{ money(COST) }} <small>FCFA</small></p>
        <p class="term-note">calculé ci-dessus</p>
      </div>
      <span class="play-in op op-total" style="--at: 800ms" aria-hidden="true">=</span>
      <div class="play-in term term-total" style="--at: 840ms" aria-live="polite">
        <p class="term-label" :class="margin < 0 ? 'text-error' : 'text-data'">
          {{ margin < 0 ? "Perte" : "Marge" }}
        </p>
        <p class="term-value" :class="margin < 0 ? 'text-error' : 'text-data'">
          {{ money(margin) }} <small>FCFA</small>
        </p>
        <p class="term-note">{{ percent.format(marginRate) }} du prix de vente</p>
      </div>
    </div>

    <figure class="play-in mt-12" style="--at: 900ms">
      <div class="bg-accented flex h-4 overflow-hidden rounded-full" aria-hidden="true">
        <span
          v-for="segment in SEGMENTS"
          :key="segment.label"
          class="h-full transition-[width] duration-500 ease-(--ease-snappy)"
          :class="segment.color"
          :style="{ width: share(segment.value) }"
        />
      </div>
      <figcaption class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span v-for="segment in SEGMENTS" :key="segment.label" class="flex items-center gap-2">
          <span class="size-2.5 rounded-full" :class="segment.color" />
          {{ segment.label }}
          <span class="text-muted tabular-nums">{{ money(segment.value) }} FCFA</span>
        </span>
      </figcaption>
      <p class="text-muted mt-2 text-sm">
        Chiffres réels de la base de démonstration, commande CF-2026-0028.
      </p>
    </figure>

    <div class="play-in mt-10 flex flex-wrap gap-3" style="--at: 980ms">
      <UButton
        to="#contact"
        size="xl"
        color="neutral"
        class="bg-ink rounded-full px-6"
        trailing-icon="i-tabler-arrow-right"
      >
        Demander une démo
      </UButton>
      <UButton
        to="#licence"
        size="xl"
        color="neutral"
        variant="outline"
        class="bg-default rounded-full px-6"
      >
        Voir la licence
      </UButton>
    </div>
  </section>
</template>

<style scoped>
@reference "../assets/css/main.css";

.term {
  @apply flex flex-col max-lg:col-start-2;
}
/* Un total se pose sous un trait fin, comme au bas d'une colonne de registre. */
.term-total {
  @apply max-lg:border-ink max-lg:border-t max-lg:pt-3;
}
.term-label {
  @apply text-muted font-mono text-[11px] tracking-[0.07em] uppercase;
}
.term-value {
  @apply mt-1 text-[clamp(1.6rem,2.4vw,2.25rem)] leading-[1.5] font-semibold tracking-tight whitespace-nowrap tabular-nums;
}
.term-value small {
  @apply text-muted text-[0.5em] font-medium tracking-normal;
}
.term-note {
  @apply text-muted mt-1 text-sm;
}
.op {
  /*
   * Grand écran : l'opérateur prend la ligne du chiffre (sous l'étiquette de 16,5 px et sa marge
   * de 4 px), à la même taille et la même interligne, pour se centrer sur les chiffres.
   */
  @apply text-muted pt-5 text-2xl font-light max-lg:col-start-1 lg:self-start lg:pt-[1.3125rem] lg:text-center lg:text-[length:clamp(1.6rem,2.4vw,2.25rem)] lg:leading-[1.5];
}
.op-total {
  @apply pt-8 lg:pt-[1.3125rem];
}
</style>
