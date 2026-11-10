import { formatDateTime } from "@G-stock/core/format";
import { useQuery } from "@tanstack/vue-query";

import type { AlertOptions } from "~/composables/useAlerts";

const BACKUP_STALE_AFTER_MS = 2 * 24 * 60 * 60 * 1000;

/** Rappel si la sauvegarde quotidienne échoue ou n'a pas tourné depuis plus de deux jours. */
export const useBackupWarning = (options: AlertOptions = {}) => {
  const { $orpc } = useNuxtApp();
  const backups = useQuery({
    ...$orpc.backups.status.queryOptions(),
    ...backgroundPolling(options),
  });

  return computed(() => {
    const status = backups.data.value;
    if (!status) {
      return null;
    }
    if (status.lastError) {
      return status.lastError.message;
    }
    const latest = status.latestAt ? new Date(status.latestAt).getTime() : null;
    if (latest === null) {
      return "Aucune sauvegarde de la base n'a encore été faite.";
    }
    return Date.now() - latest > BACKUP_STALE_AFTER_MS
      ? `Dernière sauvegarde le ${formatDateTime(latest)}.`
      : null;
  });
};
