<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from "@nuxt/ui";
import { z } from "zod";

const icons = useIcons();

defineEmits<{ switchToSignIn: [] }>();

const { $authClient } = useNuxtApp();
const notify = useNotify();
const loading = ref(false);

const fields: AuthFormField[] = [
  {
    id: "sign-up-name",
    label: "Nom",
    name: "name",
    placeholder: "Votre nom",
    required: true,
    type: "text",
  },
  {
    id: "sign-up-email",
    label: "Adresse e-mail",
    name: "email",
    placeholder: "vous@exemple.com",
    required: true,
    type: "email",
  },
  {
    id: "sign-up-password",
    label: "Mot de passe",
    name: "password",
    placeholder: "8 caractères minimum",
    required: true,
    type: "password",
  },
];

const schema = z.object({
  email: z.email("Adresse e-mail invalide"),
  name: z.string().trim().min(2, "2 caractères minimum"),
  password: z.string().min(8, "8 caractères minimum"),
});

type Schema = z.output<typeof schema>;

const onSubmit = async (event: FormSubmitEvent<Schema>) => {
  loading.value = true;
  try {
    const { error } = await $authClient.signUp.email(event.data);
    if (error) {
      notify.error("Création du compte impossible", new Error(error.message ?? "Erreur inconnue"));
      return;
    }
    notify.success("Compte créé", "Bienvenue dans G-stock !");
    await navigateTo("/", { replace: true });
  } catch (error) {
    notify.error("Création du compte impossible", error);
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <UPageCard class="w-full max-w-md">
    <UAuthForm
      :schema="schema"
      :fields="fields"
      title="Créer un compte"
      :icon="icons.signUp"
      :submit="{ label: 'Créer le compte', loading }"
      @submit="onSubmit"
    >
      <template #description>
        Déjà un compte ?
        <ULink as="button" class="text-primary font-medium" @click="$emit('switchToSignIn')">
          Se connecter
        </ULink>
      </template>
    </UAuthForm>
  </UPageCard>
</template>
