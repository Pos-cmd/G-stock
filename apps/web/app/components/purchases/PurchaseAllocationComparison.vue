<script setup lang="ts">
import type { ExchangeRates } from "@G-stock/core/currency";
import { ALLOCATION_METHODS } from "@G-stock/core/enums";
import type {
  AllocationMethod,
  PricingBasis,
  PurchaseCurrency,
} from "@G-stock/core/enums";
import { formatFcfa } from "@G-stock/core/format";
import { ALLOCATION_METHOD_LABELS } from "@G-stock/core/labels";
import { computeLandedCostsFromFees } from "@G-stock/core/purchasing";

export interface ComparisonLine {
  /** Nom du produit, tel qu'affiché. */
  label: string;
  pricingBasis: PricingBasis;
  qty: number;
  trips: number;
  unitPrice: number;
  weightTons: number | null;
}

/**
 * Coût de revient de chaque produit selon les quatre méthodes de répartition, à frais constants :
 * le total ne bouge pas, seule la part de frais de chaque ligne change.
 * Le calcul utilise la même fonction que le serveur et que la fiche de la commande.
 */
const {
  currency,
  feesFcfa,
  goodsFcfa = null,
  lines,
  rates,
  selected,
} = defineProps<{
  currency: PurchaseCurrency;
  /** Total des frais d'approche, en FCFA. */
  feesFcfa: number;
  /** Coût réel de la marchandise (versements) ; sinon conversion aux taux de la commande. */
  goodsFcfa?: number | null;
  lines: readonly ComparisonLine[];
  rates: ExchangeRates;
  selected: AllocationMethod;
}>();

const percentFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  style: "percent",
});

const activeLines = computed(() =>
  lines.filter((line) => line.qty > 0 && line.unitPrice > 0)
);
// Répartition au poids impossible tant qu'une ligne n'a pas son tonnage : mieux vaut l'annoncer
// que de laisser le calcul retomber silencieusement sur des parts égales.
const missingWeight = computed(() =>
  activeLines.value.some((line) => !line.weightTons)
);

interface MethodColumn {
  blocked: boolean;
  /** Coût unitaire de chaque produit, dans l'ordre des lignes. */
  unitCosts: number[] | null;
  method: AllocationMethod;
}

const columns = computed<MethodColumn[]>(() => {
  const items = lines.map((line) => ({
    pricingBasis: line.pricingBasis,
    qty: line.qty || 0,
    trips: line.trips || 0,
    unitPrice: line.unitPrice || 0,
    weightTons: line.weightTons || null,
  }));
  return ALLOCATION_METHODS.map((method) => {
    if (method === "weight" && missingWeight.value) {
      return { blocked: true, method, unitCosts: null };
    }
    const result = computeLandedCostsFromFees({
      currency,
      fees: [{ allocationMethod: method, amountFcfa: feesFcfa }],
      goodsFcfa: goodsFcfa ?? undefined,
      items,
      rates,
    });
    return {
      blocked: false,
      method,
      unitCosts: result.lines.map((line) => line.unitCostFcfa),
    };
  });
});

const selectedUnits = computed(
  () =>
    columns.value.find((column) => column.method === selected)?.unitCosts ??
    null
);

/** Écart du coût unitaire face à la méthode choisie, en FCFA. */
const deltaOf = (method: MethodColumn, index: number): number | null => {
  const reference = selectedUnits.value?.[index];
  const value = method.unitCosts?.[index];
  if (reference === undefined || value === undefined) {
    return null;
  }
  return value - reference;
};

const deltaPercent = (delta: number, index: number): string | null => {
  const reference = selectedUnits.value?.[index];
  if (!reference || reference <= 0 || delta === 0) {
    return null;
  }
  return percentFormatter.format(delta / reference);
};

const signedFcfa = (amount: number): string =>
  `${amount > 0 ? "+" : "−"}${formatFcfa(Math.abs(amount))}`;

/** La méthode change-t-elle réellement quelque chose, sur cette commande ? */
const changesSomething = computed(() => {
  const first = columns.value.find((column) => column.unitCosts)?.unitCosts;
  return columns.value.some(
    (column) =>
      column.unitCosts &&
      column.unitCosts.some((cost, index) => cost !== first?.[index])
  );
});
</script>

<template>
  <div class="space-y-3">
    <p v-if="activeLines.length === 0" class="text-dimmed text-sm">
      Renseignez les produits et leurs prix pour comparer les répartitions.
    </p>
    <p v-else-if="feesFcfa === 0" class="text-dimmed text-sm">
      Sans frais d'approche, le coût de revient est le même avec toutes les
      méthodes.
    </p>

    <div v-else class="border-default overflow-x-auto rounded-lg border">
      <table class="w-full min-w-200 text-sm">
        <thead
          class="bg-muted text-muted text-left font-mono text-[11px] tracking-[0.06em] uppercase"
        >
          <tr>
            <th class="px-3 py-2 font-medium">Produit</th>
            <th
              v-for="column in columns"
              :key="column.method"
              class="px-3 py-2 text-right font-medium whitespace-nowrap"
              :class="
                column.method === selected
                  ? 'text-highlighted bg-primary/5'
                  : undefined
              "
            >
              {{ ALLOCATION_METHOD_LABELS[column.method] }}
              <span
                v-if="column.method === selected"
                class="text-primary ms-1 text-[10px] normal-case"
              >
                choisie
              </span>
            </th>
          </tr>
        </thead>
        <tbody class="divide-default divide-y">
          <tr v-for="(line, index) in lines" :key="index" class="align-top">
            <td class="text-highlighted px-3 py-3 font-medium">
              {{ line.label }}
            </td>
            <td
              v-for="column in columns"
              :key="column.method"
              class="px-3 py-3 text-right tabular-nums"
              :class="column.method === selected ? 'bg-primary/5' : undefined"
            >
              <span v-if="column.blocked" class="text-dimmed text-xs">—</span>
              <template v-else>
                <span
                  class="whitespace-nowrap"
                  :class="
                    column.method === selected
                      ? 'text-highlighted font-semibold'
                      : 'text-muted'
                  "
                >
                  {{ formatFcfa(column.unitCosts?.[index] ?? 0) }}
                </span>
                <p
                  v-if="deltaOf(column, index)"
                  class="text-xs whitespace-nowrap"
                  :class="
                    (deltaOf(column, index) ?? 0) > 0
                      ? 'text-warning'
                      : 'text-success'
                  "
                  :title="
                    deltaPercent(deltaOf(column, index) ?? 0, index)
                      ? `${deltaPercent(deltaOf(column, index) ?? 0, index)} face à la méthode choisie`
                      : undefined
                  "
                >
                  {{ signedFcfa(deltaOf(column, index) ?? 0) }}
                </p>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p
      v-if="activeLines.length > 0 && feesFcfa > 0"
      class="text-dimmed text-xs"
    >
      Total des frais identique dans les quatre cas :
      {{ formatFcfa(feesFcfa) }}.
      <template v-if="missingWeight">
        La répartition au poids demande le tonnage de chaque ligne.
      </template>
      <template v-else-if="!changesSomething">
        Avec ces quantités, les quatre méthodes donnent le même coût.
      </template>
    </p>
  </div>
</template>
