<script setup lang="ts">
import { supplierInputSchema } from "@G-stock/api/schemas/suppliers";
import type { SupplierInput } from "@G-stock/api/schemas/suppliers";
import type { FormSubmitEvent } from "@nuxt/ui";
import { useMutation } from "@tanstack/vue-query";
import type { z } from "zod";

import type { SupplierRow } from "~/types/api";

const { supplier = null } = defineProps<{ supplier?: SupplierRow | null }>();
const emit = defineEmits<{ saved: [id: number] }>();
const open = defineModel<boolean>("open", { required: true });

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidatePurchases = useInvalidatePurchases();

// Les champs texte restent des chaînes dans le formulaire ; le schéma convertit "" en null.
type SupplierFormState = Required<{ [K in keyof SupplierInput]: string }>;

const emptyState = (): SupplierFormState => ({
  contact: "",
  country: "Chine",
  name: "",
  notes: "",
  phone: "",
});

const state = reactive<SupplierFormState>(emptyState());

watch(open, (isOpen) => {
  if (!isOpen) {
    return;
  }
  Object.assign(
    state,
    supplier
      ? {
          contact: supplier.contact ?? "",
          country: supplier.country,
          name: supplier.name,
          notes: supplier.notes ?? "",
          phone: supplier.phone ?? "",
        }
      : emptyState(),
  );
});

const createMutation = useMutation($orpc.suppliers.create.mutationOptions());
const updateMutation = useMutation($orpc.suppliers.update.mutationOptions());
const saving = computed(() => createMutation.isPending.value || updateMutation.isPending.value);

const onSubmit = async (event: FormSubmitEvent<z.output<typeof supplierInputSchema>>) => {
  try {
    const saved = supplier
      ? await updateMutation.mutateAsync({ ...event.data, id: supplier.id })
      : await createMutation.mutateAsync(event.data);
    await invalidatePurchases();
    notify.success(supplier ? "Fournisseur mis à jour" : "Fournisseur créé", saved.name);
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
    :title="supplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'"
    description="Coordonnées du fournisseur ou de l'usine."
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <template #body>
      <UForm
        id="supplier-form"
        :schema="supplierInputSchema"
        :state="state"
        class="grid gap-4 sm:grid-cols-2"
        @submit="onSubmit"
      >
        <UFormField label="Nom" name="name" required class="sm:col-span-2">
          <UInput
            v-model="state.name"
            placeholder="Ex. : Guangzhou Textile Co."
            class="w-full"
            autofocus
          />
        </UFormField>
        <UFormField label="Contact" name="contact">
          <UInput v-model="state.contact" placeholder="Nom, WeChat…" class="w-full" />
        </UFormField>
        <UFormField label="Téléphone" name="phone">
          <UInput v-model="state.phone" type="tel" class="w-full" />
        </UFormField>
        <UFormField label="Pays" name="country" required>
          <UInput v-model="state.country" class="w-full" />
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
          form="supplier-form"
          :label="supplier ? 'Enregistrer' : 'Créer le fournisseur'"
          :loading="saving"
        />
      </div>
    </template>
  </UModal>
</template>
