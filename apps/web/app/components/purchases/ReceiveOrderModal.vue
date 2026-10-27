<script setup lang="ts">
import { formatFcfa, formatQty } from "@G-stock/core/format";
import { useMutation } from "@tanstack/vue-query";

import type { PurchaseOrderDetail } from "~/types/api";

const { order } = defineProps<{ order: PurchaseOrderDetail }>();
const open = defineModel<boolean>("open", { required: true });

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidateStock = useInvalidateStock();
const invalidatePurchases = useInvalidatePurchases();

const receivedAt = ref(toDateInputValue());

watch(open, (isOpen) => {
  if (isOpen) {
    receivedAt.value = toDateInputValue();
  }
});

const totalValue = computed(() =>
  order.items.reduce((sum, item) => sum + item.qty * item.unitCostFcfa, 0),
);

const mutation = useMutation($orpc.purchases.receive.mutationOptions());

const confirm = async () => {
  if (!receivedAt.value) {
    return;
  }
  try {
    const result = await mutation.mutateAsync({
      id: order.id,
      receivedAt: fromDateInputValue(receivedAt.value),
    });
    await Promise.all([invalidateStock(), invalidatePurchases()]);
    notify.success(
      "Marchandise réceptionnée",
      `${result.lotCount} lot${result.lotCount > 1 ? "s" : ""} ajouté${result.lotCount > 1 ? "s" : ""} au stock`,
    );
    open.value = false;
  } catch (error) {
    notify.error("Réception impossible", error);
  }
};
</script>

<template>
  <UModal
    v-model:open="open"
    title="Réceptionner la marchandise"
    :description="`Commande ${order.reference} : un lot sera créé par ligne, au coût de revient calculé.`"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="Date de réception" required>
          <UInput v-model="receivedAt" type="date" class="w-48" />
        </UFormField>

        <div class="border-default overflow-hidden rounded-lg border">
          <table class="w-full text-sm">
            <thead class="bg-elevated/50 text-muted text-left text-xs">
              <tr>
                <th class="px-3 py-2 font-medium">Produit</th>
                <th class="px-3 py-2 text-right font-medium">Quantité</th>
                <th class="px-3 py-2 text-right font-medium">Coût unitaire</th>
                <th class="px-3 py-2 text-right font-medium">Valeur</th>
              </tr>
            </thead>
            <tbody class="divide-default divide-y">
              <tr v-for="item in order.items" :key="item.id">
                <td class="text-highlighted px-3 py-2">{{ item.productName }}</td>
                <td class="px-3 py-2 text-right tabular-nums">
                  {{ formatQty(item.qty, item.productUnit) }}
                </td>
                <td class="px-3 py-2 text-right tabular-nums">
                  {{ formatFcfa(item.unitCostFcfa) }}
                </td>
                <td class="px-3 py-2 text-right font-medium tabular-nums">
                  {{ formatFcfa(item.qty * item.unitCostFcfa) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="bg-elevated/50 flex items-center justify-between rounded-lg px-3 py-2 text-sm">
          <span class="text-muted">Valeur entrant en stock</span>
          <span class="text-highlighted font-semibold tabular-nums">{{
            formatFcfa(totalValue)
          }}</span>
        </div>

        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-lock"
          description="Une fois réceptionnée, la commande ne peut plus être modifiée. Les écarts constatés se corrigent ensuite par un ajustement de lot."
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Annuler" @click="open = false" />
        <UButton
          icon="i-lucide-package-check"
          label="Confirmer la réception"
          :disabled="!receivedAt"
          :loading="mutation.isPending.value"
          @click="confirm"
        />
      </div>
    </template>
  </UModal>
</template>
