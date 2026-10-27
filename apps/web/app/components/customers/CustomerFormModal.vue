<script setup lang="ts">
import { customerInputSchema } from "@G-stock/api/schemas/customers";
import type { CustomerInput } from "@G-stock/api/schemas/customers";
import type { FormSubmitEvent } from "@nuxt/ui";
import { useMutation } from "@tanstack/vue-query";
import type { z } from "zod";

const { customer = null } = defineProps<{
  customer?: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    notes: string | null;
  } | null;
}>();
const emit = defineEmits<{ saved: [id: string] }>();
const open = defineModel<boolean>("open", { required: true });

const { $orpc } = useNuxtApp();
const notify = useNotify();
const invalidateSales = useInvalidateSales();

// Les champs texte restent des chaînes dans le formulaire ; le schéma convertit "" en null.
type CustomerFormState = Required<{ [K in keyof CustomerInput]: string }>;

const emptyState = (): CustomerFormState => ({
  address: "",
  name: "",
  notes: "",
  phone: "",
});
const state = reactive<CustomerFormState>(emptyState());

watch(open, (isOpen) => {
  if (!isOpen) {
    return;
  }
  Object.assign(
    state,
    customer
      ? {
          address: customer.address ?? "",
          name: customer.name,
          notes: customer.notes ?? "",
          phone: customer.phone ?? "",
        }
      : emptyState(),
  );
});

const createMutation = useMutation($orpc.customers.create.mutationOptions());
const updateMutation = useMutation($orpc.customers.update.mutationOptions());
const saving = computed(() => createMutation.isPending.value || updateMutation.isPending.value);

const onSubmit = async (event: FormSubmitEvent<z.output<typeof customerInputSchema>>) => {
  try {
    const saved = customer
      ? await updateMutation.mutateAsync({ ...event.data, id: customer.id })
      : await createMutation.mutateAsync(event.data);
    await invalidateSales();
    notify.success(customer ? "Client mis à jour" : "Client créé", saved.name);
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
    :title="customer ? 'Modifier le client' : 'Nouveau client'"
    description="Coordonnées du client ; son solde se calcule à partir de ses ventes et paiements."
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <template #body>
      <UForm
        id="customer-form"
        :schema="customerInputSchema"
        :state="state"
        class="grid gap-4 sm:grid-cols-2"
        @submit="onSubmit"
      >
        <UFormField label="Nom" name="name" required class="sm:col-span-2">
          <UInput
            v-model="state.name"
            placeholder="Ex. : Quincaillerie Awa"
            class="w-full"
            autofocus
          />
        </UFormField>
        <UFormField label="Téléphone" name="phone">
          <UInput v-model="state.phone" type="tel" class="w-full" />
        </UFormField>
        <UFormField label="Adresse" name="address">
          <UInput v-model="state.address" placeholder="Quartier, ville…" class="w-full" />
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
          form="customer-form"
          :label="customer ? 'Enregistrer' : 'Créer le client'"
          :loading="saving"
        />
      </div>
    </template>
  </UModal>
</template>
