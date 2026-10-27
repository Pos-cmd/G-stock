<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";

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
      icon: colorMode.value === "dark" ? "i-lucide-sun" : "i-lucide-moon",
      label: colorMode.value === "dark" ? "Thème clair" : "Thème sombre",
      onSelect: () => {
        colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
      },
    },
  ],
  [
    {
      color: "error",
      icon: "i-lucide-log-out",
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
        :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
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
