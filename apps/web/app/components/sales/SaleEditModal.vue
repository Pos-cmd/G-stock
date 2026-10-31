<script setup lang="ts">
import { formatFcfa, formatQty } from "@G-stock/core/format";
import { uuidv7 } from "@G-stock/core/ids";
import { lineAmountFcfa } from "@G-stock/core/sales";
import type { FormSubmitEvent } from "@nuxt/ui";
import { useMutation, useQuery } from "@tanstack/vue-query";
import { z } from "zod";

import DateField from "~/components/common/DateField.vue";
import ResponsiveModal from "~/components/common/ResponsiveModal.vue";

/** Ligne en cours de modification : `id` absent pour une ligne ajoutée. */
interface EditLine {
  id?: string;
  key: string;
  productId: string;
  productName: string;
  qty: number;
  unit: string | null;
  unitPriceFcfa: number;
}

const { sale } = defineProps<{
  sale: {
    id: string;
    items: readonly {
      id: string;
      productId: string;
      productName: string;
      productUnit: string | null;
      qty: number;
      unitPriceFcfa: number;
    }[];
    notes: string | null;
    reference: string;
    saleDate: Date | string;
    totalFcfa: number;
  };
}>();
const open = defineModel<boolean>("open", { required: true });

const icons = useIcons();
const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidateSales = useInvalidateSales();
const invalidateStock = useInvalidateStock();

const formSchema = z
  .object({
    items: z
      .array(
        z.object({
          id: z.uuid().optional(),
          key: z.string(),
          productId: z.uuid({ error: "Choisissez un produit" }),
          productName: z.string(),
          qty: z.number().positive("La quantité doit être supérieure à zéro"),
          unit: z.string().nullish(),
          unitPriceFcfa: z.number().min(0, "Le prix ne peut pas être négatif"),
        })
      )
      .min(1, "La vente doit garder au moins un article"),
    notes: z.string().max(1000, "1000 caractères maximum"),
    reason: z
      .string()
      .trim()
      .min(3, "Indiquez le motif (3 caractères minimum)")
      .max(500),
    saleDate: z.iso.date("Date invalide"),
  })
  .superRefine((value, ctx) => {
    const duplicated = value.items.some(
      (item, index) =>
        item.id &&
        value.items.findIndex((other) => other.id === item.id) !== index
    );
    if (duplicated) {
      ctx.addIssue({
        code: "custom",
        message: "Deux lignes identiques",
        path: ["items"],
      });
    }
  });
type FormOutput = z.output<typeof formSchema>;

interface EditState {
  items: EditLine[];
  notes: string;
  reason: string;
  saleDate: string;
}

const state = reactive<EditState>({
  items: [],
  notes: "",
  reason: "",
  saleDate: toDateInputValue(),
});

const products = useQuery(
  computed(() => ({
    ...$orpc.products.list.queryOptions({ input: {} }),
    enabled: open.value,
  }))
);
const productItems = computed(() =>
  (products.data.value ?? []).map((product) => ({
    label: product.name,
    suffix: `${formatQty(product.stockQty, product.unit)} en stock`,
    value: product.id,
  }))
);
const productById = computed(
  () =>
    new Map((products.data.value ?? []).map((product) => [product.id, product]))
);

watch(open, (isOpen) => {
  if (!isOpen) {
    return;
  }
  state.items = sale.items.map((item) => ({
    id: item.id,
    key: uuidv7(),
    productId: item.productId,
    productName: item.productName,
    qty: item.qty,
    unit: item.productUnit,
    unitPriceFcfa: item.unitPriceFcfa,
  }));
  state.notes = sale.notes ?? "";
  state.reason = "";
  state.saleDate = toDateInputValue(new Date(sale.saleDate));
});

const addLine = () => {
  state.items.push({
    key: uuidv7(),
    productId: "",
    productName: "",
    qty: 1,
    unit: null,
    unitPriceFcfa: 0,
  });
};
const removeLine = (key: string) => {
  state.items = state.items.filter((line) => line.key !== key);
};
const onProductChange = (line: EditLine) => {
  const product = productById.value.get(line.productId);
  line.productName = product?.name ?? "";
  line.unit = product?.unit ?? null;
  if (product && !line.unitPriceFcfa) {
    line.unitPriceFcfa = product.suggestedSalePriceFcfa ?? 0;
  }
};

const totalFcfa = computed(() =>
  state.items.reduce(
    (sum, line) => sum + lineAmountFcfa(line.qty, line.unitPriceFcfa),
    0
  )
);
const deltaFcfa = computed(() => totalFcfa.value - sale.totalFcfa);

const mutation = useMutation($orpc.sales.update.mutationOptions());

const onSubmit = async (event: FormSubmitEvent<FormOutput>) => {
  try {
    await mutation.mutateAsync({
      id: sale.id,
      items: event.data.items.map((line) => ({
        id: line.id,
        productId: line.productId,
        qty: line.qty,
        unitPriceFcfa: line.unitPriceFcfa,
      })),
      notes: event.data.notes,
      reason: event.data.reason,
      saleDate: fromDateInputValue(event.data.saleDate),
    });
    await Promise.all([invalidateSales(), invalidateStock()]);
    notify.success(
      "Vente modifiée",
      `${sale.reference} · ${formatFcfa(totalFcfa.value)}`
    );
    open.value = false;
  } catch (error) {
    notify.error("Modification impossible", error);
  }
};
</script>

<template>
  <ResponsiveModal
    v-model:open="open"
    :title="`Modifier ${sale.reference}`"
    description="Le stock suit les changements : ce qui est ajouté sort des lots, ce qui est retiré y retourne."
  >
    <template #body>
      <UForm
        id="sale-edit-form"
        :schema="formSchema"
        :state="state"
        class="space-y-4"
        @submit="onSubmit"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Date de la vente" name="saleDate" required>
            <DateField v-model="state.saleDate" class="w-full" />
          </UFormField>
          <UFormField label="Motif de la modification" name="reason" required>
            <UInput
              v-model="state.reason"
              placeholder="Article oublié, quantité erronée…"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField name="items">
          <div class="space-y-2">
            <div
              v-for="(line, index) in state.items"
              :key="line.key"
              class="flex flex-wrap items-end gap-2"
            >
              <div class="min-w-48 flex-1">
                <USelectMenu
                  v-model="line.productId"
                  :items="productItems"
                  value-key="value"
                  placeholder="Produit"
                  :search-input="{ placeholder: 'Rechercher…' }"
                  class="w-full"
                  @update:model-value="onProductChange(line)"
                />
              </div>
              <UInputNumber
                v-model="line.qty"
                :min="0"
                :step="0.001"
                size="sm"
                class="w-28"
                :name="`qty-${index}`"
                :aria-label="'Quantité'"
              />
              <UInputNumber
                v-model="line.unitPriceFcfa"
                :min="0"
                :step="50"
                :format-options="FCFA_FORMAT"
                size="sm"
                class="w-32"
                :name="`price-${index}`"
                :aria-label="'Prix unitaire'"
              />
              <span class="text-muted w-24 text-right text-sm tabular-nums">
                {{ formatFcfa(lineAmountFcfa(line.qty, line.unitPriceFcfa)) }}
              </span>
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                :icon="icons.cancel"
                :aria-label="`Retirer ${line.productName || 'la ligne'}`"
                :disabled="state.items.length === 1"
                @click="removeLine(line.key)"
              />
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              :icon="icons.productAdd"
              label="Ajouter un article"
              @click="addLine"
            />
          </div>
        </UFormField>

        <UFormField label="Notes" name="notes">
          <UInput v-model="state.notes" class="w-full" />
        </UFormField>

        <div class="bg-elevated/50 space-y-1 rounded-lg p-3 text-sm">
          <div class="flex justify-between gap-4">
            <span class="text-muted">Total actuel</span>
            <span class="tabular-nums">{{ formatFcfa(sale.totalFcfa) }}</span>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-highlighted font-medium">Nouveau total</span>
            <span class="font-semibold tabular-nums">{{
              formatFcfa(totalFcfa)
            }}</span>
          </div>
          <div v-if="deltaFcfa !== 0" class="flex justify-between gap-4">
            <span class="text-muted">Écart</span>
            <span
              class="tabular-nums"
              :class="deltaFcfa > 0 ? 'text-warning' : 'text-success'"
            >
              {{ deltaFcfa > 0 ? "+" : "" }}{{ formatFcfa(deltaFcfa) }}
            </span>
          </div>
        </div>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          label="Annuler"
          @click="open = false"
        />
        <UButton
          type="submit"
          form="sale-edit-form"
          :icon="icons.save"
          label="Enregistrer les modifications"
          :loading="mutation.isPending.value"
        />
      </div>
    </template>
  </ResponsiveModal>
</template>
