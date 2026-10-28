<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";

const icons = useIcons();

defineProps<{ collapsed?: boolean }>();

const { $authClient } = useNuxtApp();
const session = $authClient.useSession();
const colorMode = useColorMode();
const notify = useNotify();

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
      icon: colorMode.value === "dark" ? icons.light : icons.dark,
      label: colorMode.value === "dark" ? "Thème clair" : "Thème sombre",
      onSelect: () => {
        colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
      },
    },
  ],
  [
    {
      color: "error",
      icon: icons.signOut,
      label: "Se déconnecter",
      onSelect: handleSignOut,
    },
  ],
]);
</script>

<template>
  <ClientOnly>
    <UDropdownMenu
      :items="items"
      :content="{ align: 'center', collisionPadding: 12 }"
      :ui="{
        content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)',
      }"
    >
      <UButton
        :avatar="{ alt: session.data?.user.name ?? 'Utilisateur' }"
        :label="collapsed ? undefined : session.data?.user.name"
        :trailing-icon="collapsed ? undefined : icons.selector"
        color="neutral"
        variant="ghost"
        block
        :square="collapsed"
        class="data-[state=open]:bg-elevated"
      />
    </UDropdownMenu>
    <template #fallback>
      <USkeleton class="h-9 w-full" />
    </template>
  </ClientOnly>
</template>
