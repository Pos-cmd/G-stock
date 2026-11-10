<script setup lang="ts">
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { useDocumentVisibility, useWindowFocus } from "@vueuse/core";

import type { AppAlert } from "~/composables/useAlerts";

/**
 * Lien avec l'application de bureau, monté seulement dans sa fenêtre (rien à afficher) :
 * - « Sauvegarder maintenant » depuis l'icône près de l'horloge ;
 * - notifications Windows pour les alertes de la cloche quand la fenêtre n'est pas regardée,
 *   au plus une fois par jour et par alerte.
 */
const REFRESH_MS = 15 * 60 * 1000;
const NOTIFIED_STORAGE_KEY = "gstock:alertes-notifiees";

const { $orpc } = useNuxtApp();
const desktop = useDesktop();
const notify = useNotify();
const queryClient = useQueryClient();
const alerts = useAlerts({ refetchInterval: REFRESH_MS });
const visibility = useDocumentVisibility();
const focused = useWindowFocus();

const backup = useMutation($orpc.backups.create.mutationOptions());

const backupNow = async () => {
  try {
    const result = await backup.mutateAsync();
    notify.success("Sauvegarde effectuée", result.fileName);
    await desktop.notify("Sauvegarde effectuée", result.fileName);
  } catch (error) {
    notify.error("Sauvegarde impossible", error);
    const reason = error instanceof Error ? error.message : "Réessayez depuis les Paramètres.";
    await desktop.notify("Sauvegarde impossible", reason).catch(() => null);
  } finally {
    await queryClient.invalidateQueries({ queryKey: $orpc.backups.key() });
  }
};

let stopListening: (() => void) | undefined;
onMounted(async () => {
  stopListening = await desktop.onBackupRequested(backupNow);
});
onBeforeUnmount(() => stopListening?.());

/** Alertes déjà signalées : identifiant → « jour|titre ». Mémoire de confort, propre à ce PC. */
const readNotified = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
};
const writeNotified = (notified: Record<string, string>) => {
  try {
    localStorage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify(notified));
  } catch {
    // Stockage indisponible : l'alerte sera simplement signalée à nouveau.
  }
};

const signature = (alert: AppAlert) => `${new Date().toDateString()}|${alert.title}`;

const notifyNewAlerts = async (list: AppAlert[]) => {
  // Fenêtre au premier plan : la cloche suffit.
  if (visibility.value === "visible" && focused.value) {
    return;
  }
  const notified = readNotified();
  const fresh = list.filter((alert) => notified[alert.id] !== signature(alert));
  const [first] = fresh;
  if (!first) {
    return;
  }
  const title = fresh.length === 1 ? first.title : `G-stock : ${fresh.length} points à traiter`;
  const body =
    fresh.length === 1 ? first.description : fresh.map((alert) => alert.title).join("\n");
  try {
    await desktop.notify(title, body);
    for (const alert of fresh) {
      notified[alert.id] = signature(alert);
    }
    writeNotified(notified);
  } catch {
    // Notifications désactivées dans Windows : la cloche reste là.
  }
};

watch([alerts, visibility, focused], ([list]) => notifyNewAlerts(list));
</script>

<template>
  <span hidden />
</template>
