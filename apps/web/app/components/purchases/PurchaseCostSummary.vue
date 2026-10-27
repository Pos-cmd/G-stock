<script setup lang="ts">
import { formatFcfa, formatQty, formatRmb, formatUsd } from "@G-stock/core/format";

import type { FeeLineDisplay } from "~/utils/purchases";

const {
  costs,
  estimateTotalFcfa = null,
  feeLines,
  title = "Prix de revient",
} = defineProps<{
  costs: {
    goodsRmb: number;
    goodsUsd: number;
    goodsFcfa: number;
    feesFcfa: number;
    totalFcfa: number;
    totalWeightTons: number;
  };
  feeLines: FeeLineDisplay[];
  /** Total estimé à la commande, affiché pour comparaison avec les frais réels. */
  estimateTotalFcfa?: number | null;
  title?: string;
}>();

const percentFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  style: "percent",
});

const feesRate = computed(() =>
  costs.goodsFcfa > 0 ? percentFormatter.format(costs.feesFcfa / costs.goodsFcfa) : null,
);

const estimateGap = computed(() =>
  estimateTotalFcfa === null ? null : costs.totalFcfa - estimateTotalFcfa,
);
</script>

<template>
  <UPageCard variant="subtle" :title="title" icon="i-lucide-calculator">
    <dl class="space-y-2 text-sm">
      <div class="flex justify-between gap-4">
        <dt class="text-muted">Marchandise</dt>
        <dd class="text-right tabular-nums">
          <span class="text-highlighted font-medium">{{ formatFcfa(costs.goodsFcfa) }}</span>
          <p class="text-dimmed text-xs">
            {{ formatRmb(costs.goodsRmb) }} · {{ formatUsd(costs.goodsUsd) }}
            <template v-if="costs.totalWeightTons > 0">
              · {{ formatQty(costs.totalWeightTons, "T") }}
            </template>
          </p>
        </dd>
      </div>

      <USeparator />

      <div v-for="(line, index) in feeLines" :key="index" class="flex justify-between gap-4">
        <dt class="text-muted min-w-0">
          {{ line.label }}
          <p v-if="line.detail" class="text-dimmed text-xs">{{ line.detail }}</p>
        </dt>
        <dd class="whitespace-nowrap tabular-nums">{{ formatFcfa(line.amountFcfa) }}</dd>
      </div>
      <p v-if="feeLines.length === 0" class="text-dimmed text-xs">Aucun frais saisi.</p>
      <div class="flex justify-between gap-4">
        <dt class="text-muted">
          Total des frais
          <p v-if="feesRate" class="text-dimmed text-xs">{{ feesRate }} de la marchandise</p>
        </dt>
        <dd class="text-highlighted font-medium whitespace-nowrap tabular-nums">
          {{ formatFcfa(costs.feesFcfa) }}
        </dd>
      </div>

      <USeparator />

      <div class="flex items-baseline justify-between gap-4 pt-1">
        <dt class="text-highlighted font-medium">Prix de revient total</dt>
        <dd class="text-primary text-lg font-semibold whitespace-nowrap tabular-nums">
          {{ formatFcfa(costs.totalFcfa) }}
        </dd>
      </div>
      <div v-if="estimateTotalFcfa !== null" class="flex justify-between gap-4 text-xs">
        <dt class="text-dimmed">Estimé à la commande : {{ formatFcfa(estimateTotalFcfa) }}</dt>
        <dd
          v-if="estimateGap"
          class="whitespace-nowrap tabular-nums"
          :class="estimateGap > 0 ? 'text-warning' : 'text-success'"
        >
          {{ estimateGap > 0 ? "+" : "" }}{{ formatFcfa(estimateGap) }}
        </dd>
      </div>
    </dl>
  </UPageCard>
</template>
