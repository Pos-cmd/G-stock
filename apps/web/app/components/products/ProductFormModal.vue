<script setup lang="ts">
import { productInputSchema } from "@G-stock/api/schemas/products";
import type { ProductInput } from "@G-stock/api/schemas/products";
import { rmbToFcfa } from "@G-stock/core/currency";
import { formatFcfa } from "@G-stock/core/format";
import { SUGGESTED_UNITS } from "@G-stock/core/labels";
import type { FormSubmitEvent } from "@nuxt/ui";
import { useMutation, useQuery } from "@tanstack/vue-query";
import type { z } from "zod";

import { useSettingsStore } from "~/stores/settings";
import type { ProductDetail, ProductRow } from "~/types/api";

const { product = null } = defineProps<{ product?: ProductRow | ProductDetail | null }>();
const emit = defineEmits<{ saved: [id: number] }>();
const open = defineModel<boolean>("open", { required: true });

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidateStock = useInvalidateStock();
const settingsStore = useSettingsStore();

// Les champs texte restent des chaînes dans le formulaire ; le schéma convertit "" en null.
type ProductFormState = Omit<ProductInput, "category" | "notes" | "reference"> & {
  category: string;
  notes: string;
  reference: string;
};

const unitItems: string[] = [...SUGGESTED_UNITS];

const emptyState = (): ProductFormState => ({
  alertThreshold: 0,
  category: "",
  name: "",
  notes: "",
  reference: "",
  referencePriceRmb: null,
  suggestedSalePriceFcfa: null,
  unit: "unité",
});

const state = reactive<ProductFormState>(emptyState());
const isEdit = computed(() => product !== null);

watch(open, async (isOpen) => {
  if (!isOpen) {
    return;
  }
  await settingsStore.load();
  Object.assign(
    state,
    product
      ? {
          alertThreshold: product.alertThreshold,
          category: product.category ?? "",
          name: product.name,
          notes: product.notes ?? "",
          reference: product.reference ?? "",
          referencePriceRmb: product.referencePriceRmb,
          suggestedSalePriceFcfa: product.suggestedSalePriceFcfa,
          unit: product.unit,
        }
      : emptyState(),
  );
});

const categories = useQuery(
  computed(() => ({ ...$orpc.products.categories.queryOptions(), enabled: open.value })),
);

const referencePriceFcfa = computed(() =>
  state.referencePriceRmb ? rmbToFcfa(state.referencePriceRmb, settingsStore.rates) : null,
);

const createMutation = useMutation($orpc.products.create.mutationOptions());
const updateMutation = useMutation($orpc.products.update.mutationOptions());
const saving = computed(() => createMutation.isPending.value || updateMutation.isPending.value);

const onSubmit = async (event: FormSubmitEvent<z.output<typeof productInputSchema>>) => {
  try {
    const saved = product
      ? await updateMutation.mutateAsync({ ...event.data, id: product.id })
      : await createMutation.mutateAsync(event.data);
    await invalidateStock();
    notify.success(product ? "Produit mis à jour" : "Produit créé", saved.name);
    open.value = false;
    emit("saved", saved.id);
  } catch (error) {
    notify.error("Enregistrement impossible", error);
  }
};
</script>

<template>
  <UModal
    v-model:open="open"
    :title="isEdit ? 'Modifier le produit' : 'Nouveau produit'"
    description="Informations générales et seuil d'alerte de stock."
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <UForm
        id="product-form"
        :schema="productInputSchema"
        :state="state"
        class="grid gap-4 sm:grid-cols-2"
        @submit="onSubmit"
      >
        <UFormField label="Nom" name="name" required class="sm:col-span-2">
          <UInput
            v-model="state.name"
            placeholder="Ex. : Tissu wax 6 yards"
            class="w-full"
            autofocus
          />
        </UFormField>

        <UFormField label="Référence" name="reference">
          <UInput
            v-model="state.reference"
            placeholder="Code interne (facultatif)"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Catégorie" name="category">
          <UInputMenu
            v-model="state.category"
            mode="autocomplete"
            :items="categories.data.value ?? []"
            placeholder="Choisir ou saisir"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Unité" name="unit" required>
          <UInputMenu
            v-model="state.unit"
            mode="autocomplete"
            :items="unitItems"
            placeholder="unité, rouleau, kg…"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Seuil d'alerte"
          name="alertThreshold"
          help="Alerte « stock bas » à partir de cette quantité."
        >
          <UInputNumber v-model="state.alertThreshold" :min="0" :step="1" class="w-full" />
        </UFormField>

        <UFormField label="Prix d'achat de référence (RMB)" name="referencePriceRmb">
          <UInputNumber
            v-model="state.referencePriceRmb"
            :min="0"
            :step="0.5"
            :format-options="{ maximumFractionDigits: 2 }"
            placeholder="Facultatif"
            class="w-full"
          />
          <template #help>
            <span v-if="referencePriceFcfa">≈ {{ formatFcfa(referencePriceFcfa) }} hors frais</span>
            <span v-else>Prix fournisseur indicatif, hors transport.</span>
          </template>
        </UFormField>

        <UFormField label="Prix de vente conseillé (FCFA)" name="suggestedSalePriceFcfa">
          <UInputNumber
            v-model="state.suggestedSalePriceFcfa"
            :min="0"
            :step="500"
            :format-options="{ maximumFractionDigits: 0 }"
            placeholder="Facultatif"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Notes" name="notes" class="sm:col-span-2">
          <UTextarea v-model="state.notes" :rows="2" autoresize class="w-full" />
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Annuler" @click="open = false" />
        <UButton
          type="submit"
          form="product-form"
          :label="isEdit ? 'Enregistrer' : 'Créer le produit'"
          :loading="saving"
        />
      </div>
    </template>
  </UModal>
</template>
