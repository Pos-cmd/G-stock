<script setup lang="ts">
import { uuidv7 } from "@G-stock/core/ids";
import { simulationInputSchema } from "@G-stock/api/schemas/simulations";
import type {
  AllocationMethod,
  FeeCurrency,
  PricingBasis,
  SalePricingMode,
} from "@G-stock/core/enums";
import { formatFcfa, formatQty, formatRmb } from "@G-stock/core/format";
import {
  ALLOCATION_METHOD_LABELS,
  FEE_CURRENCY_LABELS,
  PRICING_BASIS_LABELS,
  SALE_PRICING_MODE_LABELS,
  SUGGESTED_FEE_LABELS,
  SUGGESTED_UNITS,
} from "@G-stock/core/labels";
import { computeFeesFcfa } from "@G-stock/core/purchasing";
import { computeSimulation } from "@G-stock/core/simulation";
import type { FormSubmitEvent } from "@nuxt/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { z } from "zod";

import PurchaseCostSummary from "~/components/purchases/PurchaseCostSummary.vue";
import { useSettingsStore } from "~/stores/settings";
import type { SimulationDetail } from "~/types/api";
import type { FeeLineDisplay } from "~/utils/purchases";

const icons = useIcons();

const { formId = "simulation-form", simulation = null } = defineProps<{
  simulation?: SimulationDetail | null;
  formId?: string;
}>();
const emit = defineEmits<{ saved: [id: string] }>();
const dirty = defineModel<boolean>("dirty", { default: false });

const DEFAULT_MARKUP_PERCENT = 30;

const { $orpc } = useNuxtApp();
const notify = useNotify();
const queryClient = useQueryClient();
const settingsStore = useSettingsStore();

const formSchema = simulationInputSchema.extend({
  notes: z.string().max(1000, "1000 caractères maximum"),
});
type FormOutput = z.output<typeof formSchema>;

interface LineState {
  key: string;
  label: string;
  unit: string;
  productId: string | null;
  qty: number;
  unitPriceRmb: number;
  pricingBasis: PricingBasis;
  weightTons: number | null;
  trips: number;
  pricing: { mode: SalePricingMode; value: number };
}

interface FeeState {
  key: string;
  label: string;
  amount: number;
  currency: FeeCurrency;
  allocationMethod: AllocationMethod;
}

interface SimulationState {
  name: string;
  notes: string;
  data: {
    rates: { rmbPerUsd: number; fcfaPerUsd: number };
    freightCbm: number;
    freightRatePerCbmFcfa: number;
    freightAllocation: AllocationMethod;
    fees: FeeState[];
    lines: LineState[];
  };
}

const withKey = <T extends object>(value: T): T & { key: string } => {
  return { ...value, key: uuidv7() };
};
const newLine = (): LineState =>
  withKey({
    label: "",
    pricing: { mode: "markup" as const, value: DEFAULT_MARKUP_PERCENT },
    pricingBasis: "unit" as const,
    productId: null,
    qty: 1,
    trips: 1,
    unit: "unité",
    unitPriceRmb: 0,
    weightTons: null,
  });
const newFee = (label = ""): FeeState =>
  withKey({
    allocationMethod: "value" as const,
    amount: 0,
    currency: "fcfa" as const,
    label,
  });

const emptyState = (): SimulationState => ({
  data: {
    fees: [newFee("Douane")],
    freightAllocation: "proportional",
    freightCbm: 0,
    freightRatePerCbmFcfa: 0,
    lines: [newLine()],
    rates: {
      fcfaPerUsd: settingsStore.rates.fcfaPerUsd,
      rmbPerUsd: settingsStore.rates.rmbPerUsd,
    },
  },
  name: "",
  notes: "",
});

const stateFrom = (source: SimulationDetail): SimulationState => ({
  data: {
    ...source.data,
    fees: source.data.fees.map((fee) => withKey({ ...fee })),
    lines: source.data.lines.map((line) =>
      withKey({
        ...line,
        pricing: { ...line.pricing },
        pricingBasis: line.pricingBasis ?? "unit",
        productId: line.productId ?? null,
        weightTons: line.weightTons ?? null,
      }),
    ),
    rates: { ...source.data.rates },
  },
  name: source.name,
  notes: source.notes ?? "",
});

const state = reactive<SimulationState>(emptyState());
const snapshot = ref("");
const serialize = () =>
  JSON.stringify(state, (key, value: unknown) => (key === "key" ? undefined : value));

const reset = () => {
  Object.assign(state, simulation ? stateFrom(simulation) : emptyState());
  snapshot.value = serialize();
};

onMounted(async () => {
  if (!simulation) {
    await settingsStore.load();
  }
  reset();
});
watch(
  () => simulation,
  () => {
    if (!dirty.value) {
      reset();
    }
  },
);
watch(
  state,
  () => {
    dirty.value = snapshot.value !== "" && serialize() !== snapshot.value;
  },
  { deep: true },
);

// Catalogue : un libellé identique à un produit le rattache (unité et prix de référence repris).
const products = useQuery($orpc.products.list.queryOptions({ input: {} }));
const productNames = computed(() => (products.data.value ?? []).map((product) => product.name));
const unitItems: string[] = [...SUGGESTED_UNITS];
const feeLabelItems: string[] = [...SUGGESTED_FEE_LABELS];

const onLabelChange = (line: LineState) => {
  const product = (products.data.value ?? []).find(
    (item) => item.name.toLowerCase() === line.label.trim().toLowerCase(),
  );
  line.productId = product?.id ?? null;
  if (!product) {
    return;
  }
  line.unit = product.unit;
  if (!line.unitPriceRmb && product.referencePriceRmb) {
    line.unitPriceRmb = product.referencePriceRmb;
  }
};

const options = <T extends string>(labels: Record<T, string>) =>
  Object.entries(labels).map(([value, label]) => ({
    label: label as string,
    value,
  }));
const basisItems = options(PRICING_BASIS_LABELS);
const currencyItems = options(FEE_CURRENCY_LABELS);
const allocationItems = options(ALLOCATION_METHOD_LABELS);
const pricingModeItems = options(SALE_PRICING_MODE_LABELS);

const showWeight = computed(
  () =>
    state.data.freightAllocation === "weight" ||
    state.data.fees.some((fee) => fee.allocationMethod === "weight") ||
    state.data.lines.some((line) => line.pricingBasis === "weight" || line.weightTons),
);
const showTrips = computed(
  () =>
    state.data.freightAllocation === "proportional" ||
    state.data.fees.some((fee) => fee.allocationMethod === "proportional"),
);

// Calcul en direct, avec la même fonction que le serveur et le PDF.
const result = computed(() =>
  computeSimulation({
    ...state.data,
    fees: state.data.fees.map((fee) => ({ ...fee, amount: fee.amount || 0 })),
    freightCbm: state.data.freightCbm || 0,
    freightRatePerCbmFcfa: state.data.freightRatePerCbmFcfa || 0,
    lines: state.data.lines.map((line) => ({
      ...line,
      pricing: { mode: line.pricing.mode, value: line.pricing.value || 0 },
      qty: line.qty || 0,
      trips: line.trips || 0,
      unitPriceRmb: line.unitPriceRmb || 0,
      weightTons: line.weightTons || null,
    })),
    rates: {
      fcfaPerUsd: state.data.rates.fcfaPerUsd > 0 ? state.data.rates.fcfaPerUsd : 1,
      rmbPerUsd: state.data.rates.rmbPerUsd > 0 ? state.data.rates.rmbPerUsd : 1,
    },
  }),
);
const feeLines = computed<FeeLineDisplay[]>(() => [
  {
    amountFcfa: result.value.freightFcfa,
    detail: `${formatQty(state.data.freightCbm || 0, "CBM")} × ${formatFcfa(state.data.freightRatePerCbmFcfa || 0)} · ${ALLOCATION_METHOD_LABELS[state.data.freightAllocation].toLowerCase()}`,
    label: "Fret maritime",
  },
  ...receptionFeeLines(
    state.data.fees.map((fee, index) => ({
      ...fee,
      amountFcfa: result.value.fees[index]?.amountFcfa ?? 0,
    })),
  ),
]);

const percent = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  style: "percent",
});
const formatRate = (rate: number | null) => (rate === null ? "—" : percent.format(rate));

const freightFcfa = computed(
  () =>
    computeFeesFcfa({
      freightCbm: state.data.freightCbm || 0,
      freightRatePerCbmFcfa: state.data.freightRatePerCbmFcfa || 0,
      localTransportFcfa: 0,
      otherFeesFcfa: 0,
    }).freightFcfa,
);

// Enregistrement
const createMutation = useMutation($orpc.simulations.create.mutationOptions());
const updateMutation = useMutation($orpc.simulations.update.mutationOptions());
const saving = computed(() => createMutation.isPending.value || updateMutation.isPending.value);

const onSubmit = async (event: FormSubmitEvent<FormOutput>) => {
  try {
    const saved = simulation
      ? await updateMutation.mutateAsync({ ...event.data, id: simulation.id })
      : await createMutation.mutateAsync(event.data);
    await queryClient.invalidateQueries({ queryKey: $orpc.simulations.key() });
    snapshot.value = serialize();
    dirty.value = false;
    notify.success("Simulation enregistrée", saved?.name);
    if (saved) {
      emit("saved", saved.id);
    }
  } catch (error) {
    notify.error("Enregistrement impossible", error);
  }
};

defineExpose({ saving });
</script>

<template>
  <UForm :id="formId" :schema="formSchema" :state="state" class="space-y-6" @submit="onSubmit">
    <UPageCard variant="subtle" title="Simulation">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <UFormField label="Nom" name="name" required class="sm:col-span-2">
          <UInput v-model="state.name" placeholder="Ex. : Conteneur Yiwu novembre" class="w-full" />
        </UFormField>
        <UFormField label="Taux RMB pour 1 $" name="data.rates.rmbPerUsd" required>
          <UInputNumber
            v-model="state.data.rates.rmbPerUsd"
            :min="0"
            :step="0.01"
            :format-options="{ maximumFractionDigits: 4 }"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Taux FCFA pour 1 $" name="data.rates.fcfaPerUsd" required>
          <UInputNumber
            v-model="state.data.rates.fcfaPerUsd"
            :min="0"
            :format-options="{ maximumFractionDigits: 2 }"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Notes" name="notes" class="sm:col-span-2 lg:col-span-4">
          <UTextarea v-model="state.notes" :rows="1" autoresize class="w-full" />
        </UFormField>
      </div>
    </UPageCard>

    <UPageCard
      variant="subtle"
      title="Achat"
      :ui="{ container: 'lg:grid-cols-[minmax(0,1fr)]', wrapper: 'min-w-0' }"
    >
      <template #description>
        Un libellé identique à un produit du catalogue s'y rattache ; sinon le produit sera créé si
        la simulation devient une commande.
      </template>
      <UFormField name="data.lines">
        <div class="border-default overflow-x-auto rounded-lg border">
          <table class="w-full min-w-[60rem] text-sm">
            <thead class="bg-elevated/50 text-muted text-left text-xs">
              <tr>
                <th class="px-3 py-2 font-medium">Produit</th>
                <th class="w-32 px-3 py-2 font-medium">Unité</th>
                <th class="w-28 px-3 py-2 font-medium">Quantité</th>
                <th v-if="showWeight" class="w-28 px-3 py-2 font-medium">Poids (T)</th>
                <th class="w-52 px-3 py-2 font-medium">Prix (RMB)</th>
                <th v-if="showTrips" class="w-24 px-3 py-2 font-medium">Voyages</th>
                <th class="px-3 py-2 text-right font-medium">Coût unitaire</th>
                <th class="w-10" />
              </tr>
            </thead>
            <tbody class="divide-default divide-y">
              <tr v-for="(line, index) in state.data.lines" :key="line.key" class="align-top">
                <td class="px-3 py-2">
                  <UFormField :name="`data.lines.${index}.label`">
                    <UInputMenu
                      v-model="line.label"
                      mode="autocomplete"
                      :items="productNames"
                      placeholder="Produit"
                      class="w-full min-w-44"
                      @update:model-value="onLabelChange(line)"
                    />
                  </UFormField>
                  <p v-if="line.productId" class="text-success mt-1 text-xs">
                    Produit du catalogue
                  </p>
                </td>
                <td class="px-3 py-2">
                  <UFormField :name="`data.lines.${index}.unit`">
                    <UInputMenu
                      v-model="line.unit"
                      mode="autocomplete"
                      :items="unitItems"
                      :disabled="Boolean(line.productId)"
                      class="w-full"
                    />
                  </UFormField>
                </td>
                <td class="px-3 py-2">
                  <UFormField :name="`data.lines.${index}.qty`">
                    <UInputNumber
                      v-model="line.qty"
                      :min="0"
                      :format-options="{ maximumFractionDigits: 3 }"
                      :increment="false"
                      :decrement="false"
                      class="w-full"
                    />
                  </UFormField>
                </td>
                <td v-if="showWeight" class="px-3 py-2">
                  <UFormField :name="`data.lines.${index}.weightTons`">
                    <UInputNumber
                      v-model="line.weightTons"
                      :min="0"
                      :format-options="{ maximumFractionDigits: 3 }"
                      :increment="false"
                      :decrement="false"
                      placeholder="—"
                      class="w-full"
                    />
                  </UFormField>
                </td>
                <td class="px-3 py-2">
                  <UFormField :name="`data.lines.${index}.unitPriceRmb`">
                    <div class="flex gap-1">
                      <UInputNumber
                        v-model="line.unitPriceRmb"
                        :min="0"
                        :format-options="{ maximumFractionDigits: 2 }"
                        :increment="false"
                        :decrement="false"
                        class="min-w-0 flex-1"
                      />
                      <USelect
                        v-model="line.pricingBasis"
                        :items="basisItems"
                        :aria-label="`Base du prix, ligne ${index + 1}`"
                        class="w-24 shrink-0"
                      />
                    </div>
                  </UFormField>
                </td>
                <td v-if="showTrips" class="px-3 py-2">
                  <UFormField :name="`data.lines.${index}.trips`">
                    <UInputNumber
                      v-model="line.trips"
                      :min="0"
                      :format-options="{ maximumFractionDigits: 2 }"
                      :increment="false"
                      :decrement="false"
                      class="w-full"
                    />
                  </UFormField>
                </td>
                <td class="px-3 py-3 text-right tabular-nums">
                  <span class="text-highlighted font-semibold">
                    {{ formatFcfa(result.lines[index]?.unitCostFcfa ?? 0) }}
                  </span>
                  <p class="text-dimmed text-xs">
                    {{ formatRmb(result.lines[index]?.goodsRmb ?? 0) }}
                  </p>
                </td>
                <td class="px-1 py-2">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    :icon="icons.trash"
                    :aria-label="`Retirer la ligne ${index + 1}`"
                    :disabled="state.data.lines.length === 1"
                    @click="
                      state.data.lines = state.data.lines.filter((item) => item.key !== line.key)
                    "
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UFormField>
      <div>
        <UButton
          variant="soft"
          :icon="icons.plus"
          label="Ajouter une ligne"
          @click="state.data.lines.push(newLine())"
        />
      </div>
    </UPageCard>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <UPageCard
        variant="subtle"
        title="Frais d'approche"
        :ui="{ container: 'lg:grid-cols-[minmax(0,1fr)]', wrapper: 'min-w-0' }"
      >
        <div class="grid gap-4 sm:grid-cols-3">
          <UFormField label="Fret : volume (CBM)" name="data.freightCbm">
            <UInputNumber
              v-model="state.data.freightCbm"
              :min="0"
              :step="0.1"
              :format-options="{ maximumFractionDigits: 3 }"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Coût par CBM (FCFA)" name="data.freightRatePerCbmFcfa">
            <UInputNumber
              v-model="state.data.freightRatePerCbmFcfa"
              :min="0"
              :step="5000"
              :format-options="{ maximumFractionDigits: 0 }"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Répartition du fret"
            name="data.freightAllocation"
            :help="`Fret : ${formatFcfa(freightFcfa)}`"
          >
            <USelect
              v-model="state.data.freightAllocation"
              :items="allocationItems"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField name="data.fees">
          <div class="border-default overflow-x-auto rounded-lg border">
            <table class="w-full min-w-[40rem] text-sm">
              <thead class="bg-elevated/50 text-muted text-left text-xs">
                <tr>
                  <th class="px-3 py-2 font-medium">Autres frais</th>
                  <th class="w-32 px-3 py-2 font-medium">Montant</th>
                  <th class="w-24 px-3 py-2 font-medium">Devise</th>
                  <th class="w-48 px-3 py-2 font-medium">Répartition</th>
                  <th class="w-10" />
                </tr>
              </thead>
              <tbody class="divide-default divide-y">
                <tr v-for="(fee, index) in state.data.fees" :key="fee.key" class="align-top">
                  <td class="px-3 py-2">
                    <UFormField :name="`data.fees.${index}.label`">
                      <UInputMenu
                        v-model="fee.label"
                        mode="autocomplete"
                        :items="feeLabelItems"
                        class="w-full min-w-32"
                      />
                    </UFormField>
                  </td>
                  <td class="px-3 py-2">
                    <UInputNumber
                      v-model="fee.amount"
                      :min="0"
                      :format-options="{ maximumFractionDigits: 2 }"
                      :increment="false"
                      :decrement="false"
                      class="w-full"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <USelect
                      v-model="fee.currency"
                      :items="currencyItems"
                      :aria-label="`Devise du frais ${index + 1}`"
                      class="w-full"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <USelect
                      v-model="fee.allocationMethod"
                      :items="allocationItems"
                      :aria-label="`Répartition du frais ${index + 1}`"
                      class="w-full"
                    />
                  </td>
                  <td class="px-1 py-2">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      :icon="icons.trash"
                      :aria-label="`Retirer le frais ${index + 1}`"
                      @click="
                        state.data.fees = state.data.fees.filter((item) => item.key !== fee.key)
                      "
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UFormField>
        <div>
          <UButton
            variant="soft"
            :icon="icons.plus"
            label="Ajouter un frais"
            @click="state.data.fees.push(newFee())"
          />
        </div>
      </UPageCard>

      <PurchaseCostSummary
        title="Prix de revient"
        :costs="{ ...result, totalFcfa: result.totalCostFcfa }"
        :fee-lines="feeLines"
        class="lg:self-start"
      />
    </div>

    <UPageCard
      variant="subtle"
      title="Vente"
      :ui="{ container: 'lg:grid-cols-[minmax(0,1fr)]', wrapper: 'min-w-0' }"
    >
      <template #description>
        Pour chaque ligne : un % ajouté au prix de revient, un % du prix de vente, ou ton propre
        prix. Les deux taux restent affichés pour comparer.
      </template>
      <div class="border-default overflow-x-auto rounded-lg border">
        <table class="w-full min-w-[60rem] text-sm">
          <thead class="bg-elevated/50 text-muted text-left text-xs">
            <tr>
              <th class="px-3 py-2 font-medium">Produit</th>
              <th class="px-3 py-2 text-right font-medium">Revient</th>
              <th class="w-80 px-3 py-2 font-medium">Prix de vente</th>
              <th class="px-3 py-2 text-right font-medium">Prix</th>
              <th class="px-3 py-2 text-right font-medium">Marge / unité</th>
              <th class="px-3 py-2 text-right font-medium">% revient</th>
              <th class="px-3 py-2 text-right font-medium">% vente</th>
              <th class="px-3 py-2 text-right font-medium">Marge totale</th>
            </tr>
          </thead>
          <tbody class="divide-default divide-y">
            <tr v-for="(line, index) in state.data.lines" :key="line.key" class="align-top">
              <td class="text-highlighted px-3 py-3 font-medium">
                {{ line.label || "—" }}
                <p class="text-dimmed text-xs font-normal">
                  {{ formatQty(line.qty || 0, line.unit) }}
                </p>
              </td>
              <td class="text-muted px-3 py-3 text-right tabular-nums">
                {{ formatFcfa(result.lines[index]?.unitCostFcfa ?? 0) }}
              </td>
              <td class="px-3 py-2">
                <UFormField :name="`data.lines.${index}.pricing.value`">
                  <div class="flex gap-1">
                    <USelect
                      v-model="line.pricing.mode"
                      :items="pricingModeItems"
                      :aria-label="`Mode de prix, ligne ${index + 1}`"
                      class="w-44 shrink-0"
                    />
                    <UInputNumber
                      v-model="line.pricing.value"
                      :min="0"
                      :format-options="{
                        maximumFractionDigits: line.pricing.mode === 'price' ? 0 : 2,
                      }"
                      :increment="false"
                      :decrement="false"
                      class="min-w-0 flex-1"
                    />
                  </div>
                </UFormField>
              </td>
              <td class="text-highlighted px-3 py-3 text-right font-semibold tabular-nums">
                {{ formatFcfa(result.lines[index]?.salePriceFcfa ?? 0) }}
              </td>
              <td
                class="px-3 py-3 text-right tabular-nums"
                :class="(result.lines[index]?.unitMarginFcfa ?? 0) < 0 ? 'text-error' : ''"
              >
                {{ formatFcfa(result.lines[index]?.unitMarginFcfa ?? 0) }}
              </td>
              <td class="text-muted px-3 py-3 text-right tabular-nums">
                {{ formatRate(result.lines[index]?.markupRate ?? null) }}
              </td>
              <td class="text-muted px-3 py-3 text-right tabular-nums">
                {{ formatRate(result.lines[index]?.marginRate ?? null) }}
              </td>
              <td
                class="px-3 py-3 text-right font-medium tabular-nums"
                :class="(result.lines[index]?.marginFcfa ?? 0) < 0 ? 'text-error' : 'text-success'"
              >
                {{ formatFcfa(result.lines[index]?.marginFcfa ?? 0) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="grid gap-4 sm:grid-cols-4">
        <div class="bg-elevated/50 rounded-lg px-4 py-3">
          <p class="text-muted text-xs">Prix de revient total</p>
          <p class="text-highlighted text-lg font-semibold tabular-nums">
            {{ formatFcfa(result.totalCostFcfa) }}
          </p>
        </div>
        <div class="bg-elevated/50 rounded-lg px-4 py-3">
          <p class="text-muted text-xs">Chiffre d'affaires prévu</p>
          <p class="text-highlighted text-lg font-semibold tabular-nums">
            {{ formatFcfa(result.revenueFcfa) }}
          </p>
        </div>
        <div class="bg-elevated/50 rounded-lg px-4 py-3">
          <p class="text-muted text-xs">Marge totale</p>
          <p
            class="text-lg font-semibold tabular-nums"
            :class="result.marginFcfa < 0 ? 'text-error' : 'text-success'"
          >
            {{ formatFcfa(result.marginFcfa) }}
          </p>
        </div>
        <div class="bg-elevated/50 rounded-lg px-4 py-3">
          <p class="text-muted text-xs">Taux de marge</p>
          <p class="text-highlighted text-lg font-semibold tabular-nums">
            {{ formatRate(result.markupRate) }}
            <span class="text-muted text-sm font-normal">sur revient</span>
          </p>
          <p class="text-muted text-xs tabular-nums">{{ formatRate(result.marginRate) }} du CA</p>
        </div>
      </div>
    </UPageCard>
  </UForm>
</template>
