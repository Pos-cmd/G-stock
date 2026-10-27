<script setup lang="ts">
import type { AuthFormField, FormSubmitEvent } from "@nuxt/ui";
import { z } from "zod";

defineEmits<{ switchToSignUp: [] }>();

const { $authClient } = useNuxtApp();
const notify = useNotify();
const loading = ref(false);

const fields: AuthFormField[] = [
  {
    id: "sign-in-email",
    label: "Adresse e-mail",
    name: "email",
    placeholder: "vous@exemple.com",
    required: true,
    type: "email",
  },
  {
    id: "sign-in-password",
    label: "Mot de passe",
    name: "password",
    placeholder: "Votre mot de passe",
    required: true,
    type: "password",
  },
];

const schema = z.object({
  email: z.email("Adresse e-mail invalide"),
  password: z.string().min(8, "8 caractères minimum"),
});

type Schema = z.output<typeof schema>;

const onSubmit = async (event: FormSubmitEvent<Schema>) => {
  loading.value = true;
  try {
    const { error } = await $authClient.signIn.email(event.data);
    if (error) {
      notify.error("Connexion impossible", new Error(error.message ?? "Identifiants incorrects"));
      return;
    }
    await navigateTo("/", { replace: true });
  } catch (error) {
    notify.error("Connexion impossible", error);
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
      title="Connexion"
      icon="i-lucide-log-in"
      :submit="{ label: 'Se connecter', loading }"
      @submit="onSubmit"
    >
      <template #description>
        Pas encore de compte ?
        <ULink as="button" class="text-primary font-medium" @click="$emit('switchToSignUp')">
          Créer un compte
        </ULink>
      </template>
    </UAuthForm>
  </UPageCard>
</template>
