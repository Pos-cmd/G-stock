<script setup lang="ts">
import SignInForm from "~/components/auth/SignInForm.vue";
import SignUpForm from "~/components/auth/SignUpForm.vue";

definePageMeta({ layout: "auth" });
useHead({ title: "Connexion" });

const { data: session } = await useAuthSession();
const showSignIn = ref(true);
const hydrated = ref(false);

onMounted(() => {
  hydrated.value = true;
});

watchEffect(() => {
  if (session.value) {
    navigateTo("/", { replace: true });
  }
});
</script>

<template>
  <fieldset v-if="!session" :disabled="!hydrated" class="flex w-full justify-center">
    <SignInForm v-if="showSignIn" @switch-to-sign-up="showSignIn = false" />
    <SignUpForm v-else @switch-to-sign-in="showSignIn = true" />
  </fieldset>
</template>
