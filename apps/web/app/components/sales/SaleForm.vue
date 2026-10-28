<script setup lang="ts">
import { uuidv7 } from "@G-stock/core/ids";
import { saleInputSchema, saleLineSchema } from "@G-stock/api/schemas/sales";
import type { PaymentMethod, PaymentType } from "@G-stock/core/enums";
import { formatFcfa, formatQty } from "@G-stock/core/format";
import { PAYMENT_METHOD_LABELS } from "@G-stock/core/labels";
import { lineAmountFcfa } from "@G-stock/core/sales";
import type { FormSubmitEvent, RadioGroupItem } from "@nuxt/ui";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/vue-query";
import { z } from "zod";

import CustomerFormModal from "~/components/customers/CustomerFormModal.vue";

const { customerId, formId = "sale-form" } = defineProps<{
  /** Client choisi d'avance (depuis la fiche client). */
  customerId?: string;
  formId?: string;
}>();
const emit = defineEmits<{ saved: [id: string] }>();

const icons = useIcons();

const QUOTE_DEBOUNCE_MS = 300;

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidateSales = useInvalidateSales();
const invalidateStock = useInvalidateStock();

const formSchema = saleInputSchema
  .omit({ customerId: true, lines: true, notes: true, saleDate: true })
  .extend({
    customerId: z.uuid({ error: "Choisissez un client" }),
    lines: z
      .array(
        saleLineSchema.extend({
          productId: z.uuid({ error: "Choisissez un produit" }),
        }),
      )
      .min(1, "Ajoutez au moins un produit"),
    notes: z.string().max(1000, "1000 caractères maximum"),
    saleDate: z.iso.date("Date invalide"),
  })
  .superRefine((sale, ctx) => {
    const total = sale.lines.reduce(
      (sum, line) => sum + lineAmountFcfa(line.qty, line.unitPriceFcfa),
      0,
    );
    if (sale.paymentType === "credit" && sale.paidFcfa > total) {
      ctx.addIssue({
        code: "custom",
        message: "L'acompte dépasse le total",
        path: ["paidFcfa"],
      });
    }
  });
type FormOutput = z.output<typeof formSchema>;

interface SaleLineState {
  key: string;
  productId: string | undefined;
  qty: number;
  unitPriceFcfa: number;
}

const newLine = (): SaleLineState => {
  return { key: uuidv7(), productId: undefined, qty: 1, unitPriceFcfa: 0 };
};

const state = reactive({
  customerId: customerId as string | undefined,
  lines: [newLine()] as SaleLineState[],
  notes: "",
  paidFcfa: 0,
  paymentMethod: "cash" as PaymentMethod,
  paymentType: "cash" as PaymentType,
  saleDate: toDateInputValue(),
});
type SaleFormState = typeof state;

// Saisie commencée dans la grande fenêtre, puis ouverte en pleine page.
const draft = takeFormDraft<SaleFormState>("sale");
if (draft) {
  Object.assign(state, draft);
}

// Listes de choix
const customers = useQuery($orpc.customers.list.queryOptions({ input: {} }));
const products = useQuery($orpc.products.list.queryOptions({ input: {} }));
const productsById = computed(() => new Map((products.data.value ?? []).map((p) => [p.id, p])));

const customerItems = computed(() =>
  (customers.data.value ?? []).map((customer) => ({
    label: customer.name,
    suffix: customer.phone ?? undefined,
    value: customer.id,
  })),
);
const selectedCustomer = computed(() =>
  customers.data.value?.find((customer) => customer.id === state.customerId),
);
const productItems = computed(() =>
  (products.data.value ?? []).map((product) => ({
    disabled: product.stockQty <= 0,
    label: product.name,
    suffix: `${formatQty(product.stockQty, product.unit)} en stock`,
    value: product.id,
  })),
);

const paymentTypeItems: RadioGroupItem[] = [
  {
    description: "Le client paie tout maintenant.",
    label: "Comptant",
    value: "cash",
  },
  {
    description: "Le client paie plus tard, avec ou sans acompte.",
    label: "À crédit",
    value: "credit",
  },
];
const methodItems = Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({
  label,
  value,
}));

// Lignes
const addLine = () => {
  state.lines.push(newLine());
};
const removeLine = (key: string) => {
  state.lines = state.lines.filter((line) => line.key !== key);
};
const onProductChange = (line: SaleLineState) => {
  const product = line.productId ? productsById.value.get(line.productId) : undefined;
  if (product?.suggestedSalePriceFcfa && !line.unitPriceFcfa) {
    line.unitPriceFcfa = product.suggestedSalePriceFcfa;
  }
};

// Coût FIFO prévisionnel, calculé par le serveur sur les lots réels.
const quoteRequest = computed(() =>
  state.lines
    .filter((line) => line.productId && line.qty > 0)
    .map((line) => ({
      key: line.key,
      productId: line.productId as string,
      qty: line.qty,
    })),
);
const debouncedQuote = refDebounced(quoteRequest, QUOTE_DEBOUNCE_MS);
const quote = useQuery(
  computed(() => ({
    ...$orpc.sales.quote.queryOptions({
      input: {
        lines: debouncedQuote.value.map(({ productId, qty }) => ({
          productId,
          qty,
        })),
      },
    }),
    enabled: debouncedQuote.value.length > 0,
    placeholderData: keepPreviousData,
  })),
);
const quoteByKey = computed(() => {
  const results = quote.data.value ?? [];
  return new Map(debouncedQuote.value.map((line, index) => [line.key, results[index]]));
});

const lineView = (line: SaleLineState) => {
  const amountFcfa = lineAmountFcfa(line.qty || 0, line.unitPriceFcfa || 0);
  const result = quoteByKey.value.get(line.key);
  const costFcfa = result?.costFcfa ?? null;
  return {
    amountFcfa,
    costFcfa,
    marginFcfa: costFcfa === null ? null : amountFcfa - costFcfa,
    missingQty: result?.missingQty ?? 0,
    unit: line.productId ? productsById.value.get(line.productId)?.unit : undefined,
  };
};

const totals = computed(() => {
  let totalFcfa = 0;
  let costFcfa = 0;
  for (const line of state.lines) {
    const view = lineView(line);
    totalFcfa += view.amountFcfa;
    costFcfa += view.costFcfa ?? 0;
  }
  const paidFcfa =
    state.paymentType === "cash" ? totalFcfa : Math.min(state.paidFcfa || 0, totalFcfa);
  return {
    costFcfa,
    dueFcfa: totalFcfa - paidFcfa,
    marginFcfa: totalFcfa - costFcfa,
    paidFcfa,
    totalFcfa,
  };
});
const hasMissingStock = computed(() => state.lines.some((line) => lineView(line).missingQty > 0));
const lossLines = computed(
  () => state.lines.filter((line) => (lineView(line).marginFcfa ?? 0) < 0).length,
);

// Création rapide d'un client
const customerModalOpen = ref(false);
const onCustomerCreated = async (id: string) => {
  await customers.refetch();
  state.customerId = id;
};

const mutation = useMutation($orpc.sales.create.mutationOptions());

const onSubmit = async (event: FormSubmitEvent<FormOutput>) => {
  try {
    const sale = await mutation.mutateAsync({
      ...event.data,
      saleDate: fromDateInputValue(event.data.saleDate),
    });
    await Promise.all([invalidateSales(), invalidateStock()]);
    notify.success("Vente enregistrée", sale.reference);
    emit("saved", sale.id);
  } catch (error) {
    notify.error("Vente impossible", error);
  }
};

defineExpose({
  saving: computed(() => mutation.isPending.value),
  stashDraft: () => {
    stashFormDraft("sale", state);
  },
});
</script>

<template>
  <div>
    <UForm :id="formId" :schema="formSchema" :state="state" class="space-y-6" @submit="onSubmit">
      <UPageCard variant="subtle" title="Client">
        <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <UFormField label="Client" name="customerId" required>
            <div class="flex gap-2">
              <USelectMenu
                v-model="state.customerId"
                :items="customerItems"
                value-key="value"
                placeholder="Choisir un client"
                :search-input="{ placeholder: 'Rechercher…' }"
                class="min-w-0 flex-1"
              />
              <UButton
                color="neutral"
                variant="outline"
                :icon="icons.customerAdd"
                aria-label="Nouveau client"
                @click="customerModalOpen = true"
              />
            </div>
            <template v-if="selectedCustomer && selectedCustomer.dueFcfa > 0" #help>
              <span class="text-warning">
                Doit déjà {{ formatFcfa(selectedCustomer.dueFcfa) }}
                <template v-if="selectedCustomer.daysOverdue !== null">
                  depuis {{ selectedCustomer.daysOverdue }} jours
                </template>
              </span>
            </template>
          </UFormField>
          <UFormField label="Date" name="saleDate" required>
            <UInput v-model="state.saleDate" type="date" class="w-full" />
          </UFormField>
        </div>
      </UPageCard>

      <UPageCard
        variant="subtle"
        title="Articles"
        :ui="{ container: 'lg:grid-cols-[minmax(0,1fr)]', wrapper: 'min-w-0' }"
      >
        <template #description>
          Prix conseillé pré-rempli, modifiable. Le coût vient des lots les plus anciens (FIFO).
        </template>

        <UFormField name="lines">
          <div class="border-default overflow-x-auto rounded-lg border">
            <table class="w-full min-w-[52rem] text-sm">
              <thead class="bg-muted text-muted text-left font-mono text-[11px] tracking-[0.06em] uppercase">
                <tr>
                  <th class="px-3 py-2 font-medium">Produit</th>
                  <th class="w-36 px-3 py-2 font-medium">Quantité</th>
                  <th class="w-40 px-3 py-2 font-medium">Prix unitaire (FCFA)</th>
                  <th class="px-3 py-2 text-right font-medium">Montant</th>
                  <th class="px-3 py-2 text-right font-medium">Coût</th>
                  <th class="px-3 py-2 text-right font-medium">Marge</th>
                  <th class="w-10" />
                </tr>
              </thead>
              <tbody class="divide-default divide-y">
                <tr v-for="(line, index) in state.lines" :key="line.key" class="align-top">
                  <td class="px-3 py-2">
                    <UFormField :name="`lines.${index}.productId`">
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
                    <UFormField :name="`lines.${index}.qty`">
                      <UInputNumber
                        v-model="line.qty"
                        :min="0"
                        :format-options="{ maximumFractionDigits: 3 }"
                        class="w-full"
                      />
                    </UFormField>
                    <p v-if="lineView(line).missingQty > 0" class="text-error mt-1 text-xs">
                      Manque
                      {{ formatQty(lineView(line).missingQty, lineView(line).unit) }}
                    </p>
                    <p v-else-if="lineView(line).unit" class="text-dimmed mt-1 text-xs">
                      {{ lineView(line).unit }}
                    </p>
                  </td>
                  <td class="px-3 py-2">
                    <UFormField :name="`lines.${index}.unitPriceFcfa`">
                      <UInputNumber
                        v-model="line.unitPriceFcfa"
                        :min="0"
                        :format-options="{ maximumFractionDigits: 0 }"
                        :increment="false"
                        :decrement="false"
                        class="w-full"
                      />
                    </UFormField>
                  </td>
                  <td class="text-highlighted px-3 py-3 text-right font-medium tabular-nums">
                    {{ formatFcfa(lineView(line).amountFcfa) }}
                  </td>
                  <td class="text-muted px-3 py-3 text-right tabular-nums">
                    {{
                      lineView(line).costFcfa === null
                        ? "—"
                        : formatFcfa(lineView(line).costFcfa ?? 0)
                    }}
                  </td>
                  <td class="px-3 py-3 text-right tabular-nums">
                    <template v-if="lineView(line).marginFcfa !== null">
                      <span
                        :class="
                          (lineView(line).marginFcfa ?? 0) < 0
                            ? 'text-error font-medium'
                            : 'text-success'
                        "
                      >
                        {{ formatFcfa(lineView(line).marginFcfa ?? 0) }}
                      </span>
                      <p v-if="(lineView(line).marginFcfa ?? 0) < 0" class="text-error text-xs">
                        sous le coût
                      </p>
                    </template>
                    <span v-else class="text-dimmed">—</span>
                  </td>
                  <td class="px-1 py-2">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      :icon="icons.trash"
                      :aria-label="`Retirer la ligne ${index + 1}`"
                      :disabled="state.lines.length === 1"
                      @click="removeLine(line.key)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UFormField>

        <div class="flex flex-wrap items-center gap-2">
          <UButton variant="soft" :icon="icons.plus" label="Ajouter un produit" @click="addLine" />
        </div>

        <UAlert
          v-if="lossLines > 0"
          color="warning"
          variant="subtle"
          :icon="icons.warning"
          :description="`${lossLines} ligne${lossLines > 1 ? 's sont vendues' : ' est vendue'} sous le coût de revient. La vente reste possible.`"
        />
        <UAlert
          v-if="hasMissingStock"
          color="error"
          variant="subtle"
          :icon="icons.stockMissing"
          description="Stock insuffisant sur au moins une ligne : la vente sera refusée tant que la quantité dépasse le stock."
        />
      </UPageCard>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <UPageCard variant="subtle" title="Paiement">
          <div class="space-y-4">
            <URadioGroup
              v-model="state.paymentType"
              :items="paymentTypeItems"
              variant="card"
              :ui="{ fieldset: 'grid gap-2 sm:grid-cols-2' }"
            />
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField
                v-if="state.paymentType === 'credit'"
                label="Acompte versé (FCFA)"
                name="paidFcfa"
                help="0 si le client ne paie rien maintenant."
              >
                <UInputNumber
                  v-model="state.paidFcfa"
                  :min="0"
                  :step="1000"
                  :format-options="{ maximumFractionDigits: 0 }"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Moyen de paiement" name="paymentMethod">
                <USelect v-model="state.paymentMethod" :items="methodItems" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Notes" name="notes">
              <UTextarea v-model="state.notes" :rows="2" autoresize class="w-full" />
            </UFormField>
          </div>
        </UPageCard>

        <UPageCard variant="subtle" title="Récapitulatif" :icon="icons.sale" class="lg:self-start">
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-muted">Total</dt>
              <dd class="text-highlighted text-lg font-semibold tabular-nums">
                {{ formatFcfa(totals.totalFcfa) }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted">Coût de revient</dt>
              <dd class="tabular-nums">{{ formatFcfa(totals.costFcfa) }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted">Marge</dt>
              <dd
                class="tabular-nums"
                :class="totals.marginFcfa < 0 ? 'text-error' : 'text-success'"
              >
                {{ formatFcfa(totals.marginFcfa) }}
                <span class="text-dimmed text-xs">
                  {{ formatMarginRate(totals.marginFcfa, totals.totalFcfa) }}
                </span>
              </dd>
            </div>
            <USeparator />
            <div class="flex justify-between gap-4">
              <dt class="text-muted">Encaissé maintenant</dt>
              <dd class="tabular-nums">{{ formatFcfa(totals.paidFcfa) }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted">Reste dû</dt>
              <dd
                class="font-semibold tabular-nums"
                :class="totals.dueFcfa > 0 ? 'text-warning' : 'text-highlighted'"
              >
                {{ formatFcfa(totals.dueFcfa) }}
              </dd>
            </div>
          </dl>
        </UPageCard>
      </div>
    </UForm>

    <CustomerFormModal v-model:open="customerModalOpen" @saved="onCustomerCreated" />
  </div>
</template>
