<script setup lang="ts">
import { formatFcfa, formatQty, formatRmb, formatUsd } from "@G-stock/core/format";
import type { LandedCostFees, LandedCostResult } from "@G-stock/core/purchasing";

const { costs, fees } = defineProps<{
  costs: Omit<LandedCostResult, "lines">;
  fees: LandedCostFees;
}>();

const percentFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  style: "percent",
});

const feesRate = computed(() =>
  costs.goodsFcfa > 0 ? percentFormatter.format(costs.feesFcfa / costs.goodsFcfa) : null,
);
</script>

<template>
  <UPageCard variant="subtle" title="Prix de revient" icon="i-lucide-calculator">
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

      <div class="flex justify-between gap-4">
        <dt class="text-muted">
          Fret maritime
          <p class="text-dimmed text-xs">
            {{ formatQty(fees.freightCbm, "CBM") }} ×
            {{ formatFcfa(fees.freightRatePerCbmFcfa) }}
          </p>
        </dt>
        <dd class="whitespace-nowrap tabular-nums">{{ formatFcfa(costs.freightFcfa) }}</dd>
      </div>
      <div class="flex justify-between gap-4">
        <dt class="text-muted">Transport local</dt>
        <dd class="whitespace-nowrap tabular-nums">{{ formatFcfa(fees.localTransportFcfa) }}</dd>
      </div>
      <div class="flex justify-between gap-4">
        <dt class="text-muted">Autres frais</dt>
        <dd class="whitespace-nowrap tabular-nums">{{ formatFcfa(fees.otherFeesFcfa) }}</dd>
      </div>
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
        <dd class="text-primary text-lg font-semibold tabular-nums">
          {{ formatFcfa(costs.totalFcfa) }}
        </dd>
      </div>
    </dl>
  </UPageCard>
</template>
