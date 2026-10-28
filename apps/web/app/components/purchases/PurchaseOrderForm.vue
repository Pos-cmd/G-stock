<script setup lang="ts">
import { uuidv7 } from "@G-stock/core/ids";
import { idSchema } from "@G-stock/api/schemas/common";
import {
  checkWeights,
  purchaseItemSchema,
  purchaseOrderFieldsSchema,
} from "@G-stock/api/schemas/purchases";
import type { AllocationMethod, PricingBasis } from "@G-stock/core/enums";
import { formatFcfa, formatQty, formatRmb } from "@G-stock/core/format";
import { ALLOCATION_METHOD_LABELS, PRICING_BASIS_LABELS } from "@G-stock/core/labels";
import { computeLandedCosts, stockQtyFromWeight, totalGoodsRmb } from "@G-stock/core/purchasing";
import { paidGoodsFcfa } from "@G-stock/core/supplier-payments";
import type { FormSubmitEvent, RadioGroupItem } from "@nuxt/ui";
import { useMutation, useQuery } from "@tanstack/vue-query";
import { z } from "zod";

import ProductFormModal from "~/components/products/ProductFormModal.vue";
import PurchaseCostSummary from "~/components/purchases/PurchaseCostSummary.vue";
import SupplierFormModal from "~/components/purchases/SupplierFormModal.vue";
import { useSettingsStore } from "~/stores/settings";
import type { PurchaseOrderDetail } from "~/types/api";

const icons = useIcons();

const { formId = "purchase-form", order = null } = defineProps<{
  order?: PurchaseOrderDetail | null;
  formId?: string;
}>();
const emit = defineEmits<{ saved: [id: string] }>();
const dirty = defineModel<boolean>("dirty", { default: false });

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidatePurchases = useInvalidatePurchases();
const settingsStore = useSettingsStore();

const formSchema = purchaseOrderFieldsSchema
  .extend({
    items: z
      .array(purchaseItemSchema.extend({ productId: idSchema.optional() }))
      .min(1, "Ajoutez au moins un produit")
      .refine((items) => items.every((item) => item.productId !== undefined), {
        message: "Choisissez un produit sur chaque ligne",
      }),
    notes: z.string().max(1000, "1000 caractères maximum"),
    orderDate: z.iso.date("Date invalide"),
    supplierId: idSchema.optional(),
  })
  .superRefine(checkWeights);
type FormOutput = z.output<typeof formSchema>;

interface LineState {
  key: string;
  productId: string | undefined;
  qty: number;
  trips: number;
  unitPriceRmb: number;
  pricingBasis: PricingBasis;
  weightTons: number | null;
}

const newLine = (line: Partial<Omit<LineState, "key">> = {}): LineState => {
  return {
    key: uuidv7(),
    pricingBasis: "unit",
    productId: undefined,
    qty: 1,
    trips: 1,
    unitPriceRmb: 0,
    weightTons: null,
    ...line,
  };
};

interface FormState {
  allocationMethod: AllocationMethod;
  fcfaPerUsd: number;
  freightCbm: number;
  freightRatePerCbmFcfa: number;
  items: LineState[];
  localTransportFcfa: number;
  notes: string;
  orderDate: string;
  otherFeesFcfa: number;
  rmbPerUsd: number;
  supplierId: string | undefined;
}

const emptyState = (): FormState => ({
  allocationMethod: "proportional",
  fcfaPerUsd: settingsStore.rates.fcfaPerUsd,
  freightCbm: 0,
  freightRatePerCbmFcfa: 0,
  items: [newLine()],
  localTransportFcfa: 0,
  notes: "",
  orderDate: toDateInputValue(),
  otherFeesFcfa: 0,
  rmbPerUsd: settingsStore.rates.rmbPerUsd,
  supplierId: undefined,
});

const stateFromOrder = (source: PurchaseOrderDetail): FormState => ({
  allocationMethod: source.allocationMethod,
  fcfaPerUsd: source.fcfaPerUsd,
  freightCbm: source.freightCbm,
  freightRatePerCbmFcfa: source.freightRatePerCbmFcfa,
  items: source.items.map((item) =>
    newLine({
      pricingBasis: item.pricingBasis,
      productId: item.productId,
      qty: item.qty,
      trips: item.trips,
      unitPriceRmb: item.unitPriceRmb,
      weightTons: item.weightTons,
    }),
  ),
  localTransportFcfa: source.localTransportFcfa,
  notes: source.notes ?? "",
  orderDate: toDateInputValue(new Date(source.orderDate)),
  otherFeesFcfa: source.otherFeesFcfa,
  rmbPerUsd: source.rmbPerUsd,
  supplierId: source.supplierId ?? undefined,
});

const buildState = (): FormState => (order ? stateFromOrder(order) : emptyState());

const state = reactive<FormState>(buildState());
const snapshot = ref("");

const serialize = () =>
  JSON.stringify({
    ...state,
    items: state.items.map(({ key: _key, ...line }) => line),
  });

const reset = () => {
  Object.assign(state, buildState());
  snapshot.value = serialize();
};

onMounted(async () => {
  if (!order) {
    // Une nouvelle commande part des taux du moment ; ils sont ensuite figés sur la commande.
    await settingsStore.load();
  }
  reset();
});
// Un rafraîchissement (changement de statut…) ne doit pas écraser une saisie en cours.
watch(
  () => order,
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

// Listes de choix
const products = useQuery($orpc.products.list.queryOptions({ input: {} }));
const suppliers = useQuery($orpc.suppliers.list.queryOptions());

const productsById = computed(() => new Map((products.data.value ?? []).map((p) => [p.id, p])));
const productItems = computed(() =>
  (products.data.value ?? []).map((product) => ({
    label: product.name,
    suffix: product.reference ?? undefined,
    value: product.id,
  })),
);
const supplierItems = computed(() =>
  (suppliers.data.value ?? []).map((supplier) => ({
    label: supplier.name,
    suffix: supplier.country,
    value: supplier.id,
  })),
);

const allocationItems: RadioGroupItem[] = [
  {
    description: "Chaque ligne paie selon son nombre de voyages.",
    label: ALLOCATION_METHOD_LABELS.proportional,
    value: "proportional",
  },
  {
    description: "Les frais sont divisés également entre les lignes.",
    label: ALLOCATION_METHOD_LABELS.equal,
    value: "equal",
  },
  {
    description: "Chaque ligne paie selon son tonnage. Le poids de chaque ligne est requis.",
    label: ALLOCATION_METHOD_LABELS.weight,
    value: "weight",
  },
  {
    description: "Chaque ligne paie selon la valeur de sa marchandise.",
    label: ALLOCATION_METHOD_LABELS.value,
    value: "value",
  },
];

const pricingBasisItems = Object.entries(PRICING_BASIS_LABELS).map(([value, label]) => ({
  label,
  value,
}));

// La colonne Poids n'apparaît que si la commande utilise des tonnages.
const showWeight = computed(
  () =>
    state.allocationMethod === "weight" ||
    state.items.some((line) => line.pricingBasis === "weight" || line.weightTons),
);
const totalWeightTons = computed(() =>
  state.items.reduce((sum, line) => sum + (line.weightTons || 0), 0),
);

// Lignes
const addLine = (productId?: string) => {
  const price = productId ? (productsById.value.get(productId)?.referencePriceRmb ?? 0) : 0;
  state.items.push(newLine({ productId, unitPriceRmb: price }));
};

const removeLine = (key: string) => {
  state.items = state.items.filter((line) => line.key !== key);
};

const onProductChange = (line: LineState) => {
  const reference = line.productId
    ? productsById.value.get(line.productId)?.referencePriceRmb
    : null;
  if (reference && !line.unitPriceRmb) {
    line.unitPriceRmb = reference;
  }
};

/** Produit géré en tonnes ou en kg : la quantité de stock découle du poids. */
const onWeightChange = (line: LineState) => {
  const unit = line.productId ? productsById.value.get(line.productId)?.unit : undefined;
  const qty = unit && line.weightTons ? stockQtyFromWeight(unit, line.weightTons) : null;
  if (qty !== null) {
    line.qty = qty;
  }
};

// Versements déjà faits au fournisseur : la marchandise est comptée à leur taux.
const activePayments = computed(() =>
  (order?.payments ?? []).filter((payment) => !payment.cancelledAt),
);

// Calcul en direct, avec la même fonction que le serveur.
const costs = computed(() => {
  const items = state.items.map((line) => ({
    pricingBasis: line.pricingBasis,
    qty: line.qty || 0,
    trips: line.trips || 0,
    unitPriceRmb: line.unitPriceRmb || 0,
    weightTons: line.weightTons || null,
  }));
  const rates = {
    fcfaPerUsd: state.fcfaPerUsd > 0 ? state.fcfaPerUsd : 1,
    rmbPerUsd: state.rmbPerUsd > 0 ? state.rmbPerUsd : 1,
  };
  return computeLandedCosts({
    allocationMethod: state.allocationMethod,
    freightCbm: state.freightCbm || 0,
    freightRatePerCbmFcfa: state.freightRatePerCbmFcfa || 0,
    goodsFcfa: paidGoodsFcfa({
      goodsRmb: totalGoodsRmb(items),
      payments: activePayments.value,
      rates,
    }),
    items,
    localTransportFcfa: state.localTransportFcfa || 0,
    otherFeesFcfa: state.otherFeesFcfa || 0,
    rates,
  });
});

const fees = computed(() => ({
  freightCbm: state.freightCbm || 0,
  freightRatePerCbmFcfa: state.freightRatePerCbmFcfa || 0,
  localTransportFcfa: state.localTransportFcfa || 0,
  otherFeesFcfa: state.otherFeesFcfa || 0,
}));

const useCurrentRates = () => {
  state.rmbPerUsd = settingsStore.rates.rmbPerUsd;
  state.fcfaPerUsd = settingsStore.rates.fcfaPerUsd;
};
const ratesDiffer = computed(
  () =>
    state.rmbPerUsd !== settingsStore.rates.rmbPerUsd ||
    state.fcfaPerUsd !== settingsStore.rates.fcfaPerUsd,
);

// Création rapide depuis le formulaire
const productModalOpen = ref(false);
const supplierModalOpen = ref(false);
const onProductCreated = async (id: string) => {
  await products.refetch();
  const emptyLine = state.items.find((line) => line.productId === undefined);
  if (emptyLine) {
    emptyLine.productId = id;
    onProductChange(emptyLine);
  } else {
    addLine(id);
  }
};
const onSupplierCreated = async (id: string) => {
  await suppliers.refetch();
  state.supplierId = id;
};

// Enregistrement
const createMutation = useMutation($orpc.purchases.create.mutationOptions());
const updateMutation = useMutation($orpc.purchases.update.mutationOptions());
const saving = computed(() => createMutation.isPending.value || updateMutation.isPending.value);

const onSubmit = async (event: FormSubmitEvent<FormOutput>) => {
  const input = {
    ...event.data,
    items: event.data.items.flatMap(({ productId, ...line }) =>
      productId === undefined ? [] : [{ ...line, productId }],
    ),
    notes: event.data.notes,
    orderDate: fromDateInputValue(event.data.orderDate),
    supplierId: event.data.supplierId ?? null,
  };
  try {
    const saved = order
      ? await updateMutation.mutateAsync({ ...input, id: order.id })
      : await createMutation.mutateAsync(input);
    await invalidatePurchases();
    snapshot.value = serialize();
    dirty.value = false;
    notify.success(order ? "Commande enregistrée" : "Commande créée", saved?.reference);
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
    <UPageCard variant="subtle" title="Commande">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <UFormField label="Fournisseur" name="supplierId" class="sm:col-span-2">
          <div class="flex gap-2">
            <USelectMenu
              v-model="state.supplierId"
              :items="supplierItems"
              value-key="value"
              placeholder="Choisir un fournisseur"
              :search-input="{ placeholder: 'Rechercher…' }"
              clear
              class="min-w-0 flex-1"
            />
            <UButton
              color="neutral"
              variant="outline"
              :icon="icons.plus"
              aria-label="Nouveau fournisseur"
              @click="supplierModalOpen = true"
            />
          </div>
        </UFormField>
        <UFormField label="Date de commande" name="orderDate" required>
          <UInput v-model="state.orderDate" type="date" class="w-full" />
        </UFormField>
        <div />

        <UFormField label="Taux RMB pour 1 $" name="rmbPerUsd" required>
          <UInputNumber
            v-model="state.rmbPerUsd"
            :min="0"
            :step="0.01"
            :format-options="{ maximumFractionDigits: 4 }"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Taux FCFA pour 1 $" name="fcfaPerUsd" required>
          <UInputNumber
            v-model="state.fcfaPerUsd"
            :min="0"
            :step="1"
            :format-options="{ maximumFractionDigits: 2 }"
            class="w-full"
          />
        </UFormField>
        <div class="text-muted flex items-end pb-2 text-xs sm:col-span-2">
          <p>
            Taux figés sur cette commande.
            <ULink
              v-if="ratesDiffer"
              as="button"
              type="button"
              class="text-primary font-medium"
              @click="useCurrentRates"
            >
              Reprendre les taux des paramètres ({{ settingsStore.rates.rmbPerUsd }} /
              {{ settingsStore.rates.fcfaPerUsd }})
            </ULink>
          </p>
        </div>
      </div>
    </UPageCard>

    <UPageCard
      variant="subtle"
      title="Produits commandés"
      :ui="{ container: 'lg:grid-cols-[minmax(0,1fr)]', wrapper: 'min-w-0' }"
    >
      <template #description>
        Prix fournisseur en RMB, à l'unité ou à la tonne. La quantité est celle qui entre en stock
        (cartons, rouleaux…) ; le coût de revient unitaire inclut la part des frais d'approche.
      </template>

      <UFormField name="items">
        <div class="border-default overflow-x-auto rounded-lg border">
          <table class="w-full min-w-240 text-sm">
            <thead class="bg-elevated/50 text-muted text-left text-xs">
              <tr>
                <th class="px-3 py-2 font-medium">Produit</th>
                <th class="w-32 px-3 py-2 font-medium">Qté en stock</th>
                <th v-if="showWeight" class="w-28 px-3 py-2 font-medium">Poids (T)</th>
                <th class="w-56 px-3 py-2 font-medium">Prix (RMB)</th>
                <th
                  v-if="state.allocationMethod === 'proportional'"
                  class="w-24 px-3 py-2 font-medium"
                >
                  Voyages
                </th>
                <th class="px-3 py-2 text-right font-medium">Total</th>
                <th class="px-3 py-2 text-right font-medium">Part des frais</th>
                <th class="px-3 py-2 text-right font-medium">Coût unitaire</th>
                <th class="w-10" />
              </tr>
            </thead>
            <tbody class="divide-default divide-y">
              <tr v-for="(line, index) in state.items" :key="line.key" class="align-top">
                <td class="px-3 py-2">
                  <UFormField :name="`items.${index}.productId`">
                    <USelectMenu
                      v-model="line.productId"
                      :items="productItems"
                      value-key="value"
                      placeholder="Choisir un produit"
                      :search-input="{ placeholder: 'Rechercher…' }"
                      class="w-full min-w-48"
                      @update:model-value="onProductChange(line)"
                    />
                  </UFormField>
                </td>
                <td class="px-3 py-2">
                  <UFormField :name="`items.${index}.qty`">
                    <UInputNumber
                      v-model="line.qty"
                      :min="0"
                      :step="1"
                      :format-options="{ maximumFractionDigits: 3 }"
                      class="w-full"
                    />
                  </UFormField>
                  <p v-if="line.productId" class="text-dimmed mt-1 text-xs">
                    {{ productsById.get(line.productId)?.unit }}
                  </p>
                </td>
                <td v-if="showWeight" class="px-3 py-2">
                  <UFormField :name="`items.${index}.weightTons`">
                    <UInputNumber
                      v-model="line.weightTons"
                      :min="0"
                      :step="0.5"
                      :format-options="{ maximumFractionDigits: 3 }"
                      placeholder="—"
                      class="w-full"
                      @update:model-value="onWeightChange(line)"
                    />
                  </UFormField>
                </td>
                <td class="px-3 py-2">
                  <UFormField :name="`items.${index}.unitPriceRmb`">
                    <div class="flex gap-1">
                      <UInputNumber
                        v-model="line.unitPriceRmb"
                        :min="0"
                        :step="0.5"
                        :format-options="{ maximumFractionDigits: 2 }"
                        :increment="false"
                        :decrement="false"
                        class="min-w-0 flex-1"
                      />
                      <USelect
                        v-model="line.pricingBasis"
                        :items="pricingBasisItems"
                        :aria-label="`Base du prix, ligne ${index + 1}`"
                        class="w-24 shrink-0"
                      />
                    </div>
                  </UFormField>
                </td>
                <td v-if="state.allocationMethod === 'proportional'" class="px-3 py-2">
                  <UFormField :name="`items.${index}.trips`">
                    <UInputNumber
                      v-model="line.trips"
                      :min="0"
                      :step="1"
                      :format-options="{ maximumFractionDigits: 2 }"
                      class="w-full"
                    />
                  </UFormField>
                </td>
                <td class="px-3 py-3 text-right tabular-nums">
                  {{ formatFcfa(costs.lines[index]?.goodsFcfa ?? 0) }}
                  <p class="text-dimmed text-xs">
                    {{ formatRmb(costs.lines[index]?.goodsRmb ?? 0) }}
                  </p>
                </td>
                <td class="text-muted px-3 py-3 text-right tabular-nums">
                  {{ formatFcfa(costs.lines[index]?.transportShareFcfa ?? 0) }}
                </td>
                <td class="px-3 py-3 text-right tabular-nums">
                  <span class="text-highlighted font-semibold">
                    {{ formatFcfa(costs.lines[index]?.unitCostFcfa ?? 0) }}
                  </span>
                  <p v-if="costs.lines[index]?.costPerTonFcfa" class="text-dimmed text-xs">
                    {{ formatFcfa(costs.lines[index]?.costPerTonFcfa ?? 0) }} / T
                  </p>
                </td>
                <td class="px-1 py-2">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    :icon="icons.trash"
                    :aria-label="`Retirer la ligne ${index + 1}`"
                    :disabled="state.items.length === 1"
                    @click="removeLine(line.key)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UFormField>

      <div class="flex flex-wrap items-center gap-2">
        <UButton variant="soft" :icon="icons.plus" label="Ajouter une ligne" @click="addLine()" />
        <UButton
          color="neutral"
          variant="ghost"
          :icon="icons.productAdd"
          label="Créer un produit"
          @click="productModalOpen = true"
        />
        <span class="text-muted ms-auto text-xs">
          {{ state.items.length }} ligne{{ state.items.length > 1 ? "s" : "" }}
          ·
          {{ formatQty(state.items.reduce((sum, line) => sum + (line.qty || 0), 0)) }}
          unités
          <template v-if="totalWeightTons > 0"> · {{ formatQty(totalWeightTons, "T") }}</template>
        </span>
      </div>
    </UPageCard>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <UPageCard variant="subtle" title="Frais d'approche">
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Volume (CBM)" name="freightCbm">
            <UInputNumber
              v-model="state.freightCbm"
              :min="0"
              :step="0.1"
              :format-options="{ maximumFractionDigits: 3 }"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Coût par CBM (FCFA)" name="freightRatePerCbmFcfa">
            <UInputNumber
              v-model="state.freightRatePerCbmFcfa"
              :min="0"
              :step="5000"
              :format-options="{ maximumFractionDigits: 0 }"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Transport local (FCFA)" name="localTransportFcfa">
            <UInputNumber
              v-model="state.localTransportFcfa"
              :min="0"
              :step="5000"
              :format-options="{ maximumFractionDigits: 0 }"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Autres frais (FCFA)"
            name="otherFeesFcfa"
            help="Dédouanement, manutention…"
          >
            <UInputNumber
              v-model="state.otherFeesFcfa"
              :min="0"
              :step="5000"
              :format-options="{ maximumFractionDigits: 0 }"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Répartition des frais entre les produits"
            name="allocationMethod"
            class="sm:col-span-2"
          >
            <URadioGroup
              v-model="state.allocationMethod"
              :items="allocationItems"
              variant="card"
              :ui="{ fieldset: 'grid gap-2 sm:grid-cols-2' }"
            />
          </UFormField>
        </div>
      </UPageCard>

      <PurchaseCostSummary
        title="Prix de revient estimé"
        :costs="costs"
        :fee-lines="estimateFeeLines(fees)"
        :goods-hint="activePayments.length > 0 ? PAID_GOODS_HINT : null"
        class="lg:self-start"
      />
    </div>

    <UFormField label="Notes" name="notes">
      <UTextarea
        v-model="state.notes"
        :rows="2"
        autoresize
        placeholder="N° de facture fournisseur, conteneur, conditions…"
        class="w-full"
      />
    </UFormField>

    <ProductFormModal v-model:open="productModalOpen" @saved="onProductCreated" />
    <SupplierFormModal v-model:open="supplierModalOpen" @saved="onSupplierCreated" />
  </UForm>
</template>
