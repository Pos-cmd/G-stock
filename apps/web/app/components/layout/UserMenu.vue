<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";

// Profil dans la barre du haut : qui est connecté, les paramètres et la déconnexion.
const icons = useIcons();

const { $authClient } = useNuxtApp();
const session = $authClient.useSession();
const notify = useNotify();

const user = computed(() => session.value.data?.user);

const handleSignOut = async () => {
  try {
    await $authClient.signOut();
    await navigateTo("/login", { external: true, replace: true });
  } catch (error) {
    notify.error("Échec de la déconnexion", error);
  }
};

const items = computed<DropdownMenuItem[][]>(() => [
  [
    {
      avatar: { alt: user.value?.name ?? "Utilisateur" },
      description: user.value?.email,
      label: user.value?.name ?? "Utilisateur",
      type: "label",
    },
  ],
  [{ icon: icons.settings, label: "Paramètres", to: "/parametres" }],
  [{ color: "error", icon: icons.signOut, label: "Se déconnecter", onSelect: handleSignOut }],
]);
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'end', collisionPadding: 12 }"
    :ui="{ content: 'w-60' }"
  >
    <UButton
      color="neutral"
      variant="ghost"
      class="rounded-full p-0.5"
      :aria-label="`Compte de ${user?.name ?? 'l’utilisateur'}`"
    >
      <UAvatar :alt="user?.name ?? 'Utilisateur'" size="sm" class="ring-default ring" />
    </UButton>
  </UDropdownMenu>
</template>
