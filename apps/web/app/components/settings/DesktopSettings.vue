<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";

import type { DesktopInfo } from "~/composables/useDesktop";

// Réglages propres à l'application de bureau, affichés seulement dans sa fenêtre.
const icons = useIcons();
const desktop = useDesktop();
const notify = useNotify();
const queryClient = useQueryClient();

const INFO_KEY = ["desktop", "info"] as const;
/** Publie le serveur de ce PC sur le réseau Tailscale, en HTTPS (port de l'application). */
const TAILSCALE_COMMAND = "tailscale serve --bg 3210";

const info = useQuery({ queryFn: desktop.info, queryKey: INFO_KEY });

const autostart = useMutation({
  mutationFn: desktop.setAutostart,
  onError: (error) => notify.error("Réglage impossible", error),
  onSuccess: (enabled) => {
    queryClient.setQueryData<DesktopInfo>(INFO_KEY, (current) =>
      current ? { ...current, autostart: enabled } : current,
    );
  },
});

const openFolder = async (path: string) => {
  try {
    await desktop.openFolder(path);
  } catch (error) {
    notify.error("Dossier introuvable", error);
  }
};

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    notify.success("Copié", text);
  } catch (error) {
    notify.error("Copie impossible", error);
  }
};
</script>

<template>
  <UPageCard
    title="Application de bureau"
    :description="
      info.data.value
        ? `G-stock ${info.data.value.version} pour Windows. Fermer la fenêtre la range près de l'horloge : « Quitter G-stock » dans le menu de son icône l'arrête.`
        : 'G-stock pour Windows.'
    "
    variant="subtle"
  >
    <UAlert
      v-if="info.error.value"
      color="error"
      variant="subtle"
      :icon="icons.error"
      title="Informations indisponibles"
      :description="info.error.value.message"
    />

    <template v-else-if="info.data.value">
      <USwitch
        :model-value="info.data.value.autostart"
        :loading="autostart.isPending.value"
        label="Lancer G-stock au démarrage de Windows"
        description="Il démarre rangé près de l'horloge : les sauvegardes et l'accès depuis le téléphone fonctionnent sans y penser."
        @update:model-value="autostart.mutate($event)"
      />

      <div
        class="bg-elevated/50 flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2"
      >
        <div class="min-w-0 text-sm">
          <p class="text-highlighted font-medium">Données de G-stock</p>
          <p class="text-muted truncate font-mono text-xs">
            {{ info.data.value.dataDir }}
          </p>
        </div>
        <div class="flex gap-1">
          <UButton
            :icon="icons.folderOpen"
            label="Ouvrir"
            color="neutral"
            variant="outline"
            @click="openFolder(info.data.value.dataDir)"
          />
          <UButton
            :icon="icons.file"
            label="Journaux"
            color="neutral"
            variant="ghost"
            @click="openFolder(info.data.value.logsDir)"
          />
        </div>
      </div>

      <div class="space-y-2 text-sm">
        <p class="text-highlighted flex items-center gap-2 font-medium">
          <UIcon :name="icons.receiptMobile" class="text-muted size-4" />
          Accès depuis le téléphone
        </p>
        <template v-if="info.data.value.phoneOrigin">
          <p>
            Sur le téléphone connecté à Tailscale, ouvrez
            <button
              type="button"
              class="text-primary font-mono hover:underline"
              :title="`Copier ${info.data.value.phoneOrigin}`"
              @click="copy(info.data.value.phoneOrigin)"
            >
              {{ info.data.value.phoneOrigin }}</button
            >.
          </p>
          <p class="text-muted">
            S'il ne répond pas, lancez une fois sur ce PC, dans un terminal :
            <button
              type="button"
              class="text-highlighted font-mono hover:underline"
              :title="`Copier ${TAILSCALE_COMMAND}`"
              @click="copy(TAILSCALE_COMMAND)"
            >
              {{ TAILSCALE_COMMAND }}
            </button>
          </p>
        </template>
        <p v-else class="text-muted">
          Installez Tailscale sur ce PC et sur le téléphone, connectez-les au même compte, puis
          relancez G-stock : l'adresse à ouvrir sur le téléphone s'affichera ici.
        </p>
      </div>
    </template>
  </UPageCard>
</template>
