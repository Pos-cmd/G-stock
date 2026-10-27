<script setup lang="ts">
import { formatFcfa, formatQty } from "@G-stock/core/format";
import { useMutation } from "@tanstack/vue-query";

import type { ProductDetail } from "~/types/api";
import ResponsiveModal from "~/components/common/ResponsiveModal.vue";

/** Ouvrir des cartons pour vendre au détail : leurs pièces passent dans le produit « pièce ». */
const { product } = defineProps<{ product: ProductDetail }>();
const open = defineModel<boolean>("open", { required: true });

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidateStock = useInvalidateStock();

const qty = ref(1);
watch(open, (isOpen) => {
  if (isOpen) {
    qty.value = 1;
  }
});

const piecesPerUnit = computed(() => product.piecesPerUnit ?? 0);
const maxQty = computed(() => Math.floor(product.stockQty));
const pieceName = computed(() => product.pieceProduct?.name ?? `${product.name} (pièce)`);
const valid = computed(
  () => Number.isInteger(qty.value) && qty.value >= 1 && qty.value <= maxQty.value,
);

const mutation = useMutation($orpc.stock.unpack.mutationOptions());

const submit = async () => {
  if (!valid.value) {
    return;
  }
  try {
    const result = await mutation.mutateAsync({
      productId: product.id,
      qty: qty.value,
    });
    await invalidateStock();
    notify.success(
      "Cartons ouverts",
      `${formatQty(result.pieceCount, "pièce")} ajoutées à « ${result.pieceProductName} »`,
    );
    open.value = false;
  } catch (error) {
    notify.error("Ouverture impossible", error);
  }
};
</script>

<template>
  <ResponsiveModal
    v-model:open="open"
    :title="`Ouvrir des ${product.unit}s`"
    :description="`${piecesPerUnit} pièces par ${product.unit} · ${formatQty(product.stockQty, product.unit)} en stock`"
  >
    <template #body>
      <form id="unpack-form" class="space-y-4" @submit.prevent="submit">
        <UFormField
          :label="`Nombre de ${product.unit}s à ouvrir`"
          :error="valid ? undefined : `Entre 1 et ${maxQty}`"
        >
          <UInputNumber v-model="qty" :min="1" :max="maxQty" :step="1" class="w-full" autofocus />
        </UFormField>

        <div class="bg-elevated/50 space-y-1 rounded-lg px-3 py-2 text-sm">
          <div class="flex justify-between gap-4">
            <span class="text-muted">Sort du stock</span>
            <span class="tabular-nums">{{ formatQty(qty || 0, product.unit) }}</span>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-muted">Entre dans « {{ pieceName }} »</span>
            <strong class="text-highlighted tabular-nums">
              {{ formatQty((qty || 0) * piecesPerUnit, "pièce") }}
            </strong>
          </div>
          <p v-if="product.averageCostFcfa > 0" class="text-dimmed text-xs">
            Coût par pièce ≈
            {{ formatFcfa(Math.round(product.averageCostFcfa / piecesPerUnit)) }}
            (coût du {{ product.unit }} divisé par {{ piecesPerUnit }}, lot par lot).
          </p>
          <p v-if="!product.pieceProduct" class="text-info text-xs">
            Le produit « {{ pieceName }} » sera créé à la première ouverture ; vous pourrez le
            renommer et fixer son prix de vente.
          </p>
        </div>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Annuler" @click="open = false" />
        <UButton
          type="submit"
          form="unpack-form"
          icon="i-lucide-package-open"
          :label="`Ouvrir ${qty || 0} ${product.unit}${qty > 1 ? 's' : ''}`"
          :disabled="!valid"
          :loading="mutation.isPending.value"
        />
      </div>
    </template>
  </ResponsiveModal>
</template>
