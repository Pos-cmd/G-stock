<script setup lang="ts">
import { formatDateTime } from "@G-stock/core/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";

const icons = useIcons();

/** Dossier en cours de saisie dans le formulaire, pour proposer Google Drive s'il diffère. */
const { folder } = defineProps<{ folder: string }>();
const emit = defineEmits<{ useFolder: [folder: string] }>();

const VISIBLE_BACKUPS = 5;
const STALE_AFTER_MS = 2 * 24 * 60 * 60 * 1000;
const BYTES_PER_KB = 1024;

const { $orpc } = useNuxtApp();
const queryClient = useQueryClient();
const notify = useNotify();

const status = useQuery($orpc.backups.status.queryOptions());

const backupNow = useMutation(
  $orpc.backups.create.mutationOptions({
    onError: (error) => notify.error("Sauvegarde impossible", error),
    onSettled: () => queryClient.invalidateQueries({ queryKey: $orpc.backups.key() }),
    onSuccess: (result) => notify.success("Sauvegarde effectuée", result.fileName),
  }),
);

const latestAt = computed(() => status.data.value?.latestAt ?? null);
const isStale = computed(
  () => !latestAt.value || Date.now() - new Date(latestAt.value).getTime() > STALE_AFTER_MS,
);
const suggestedDrive = computed(() => {
  const drive = status.data.value?.driveFolder;
  return drive && drive !== folder ? drive : null;
});
const savedFolderChanged = computed(
  () => status.data.value !== undefined && status.data.value.folder !== folder,
);

const formatSize = (bytes: number): string => {
  const kilobytes = bytes / BYTES_PER_KB;
  return kilobytes < BYTES_PER_KB
    ? `${Math.max(1, Math.round(kilobytes))} Ko`
    : `${(kilobytes / BYTES_PER_KB).toFixed(1).replace(".", ",")} Mo`;
};
</script>

<template>
  <div class="space-y-3">
    <UAlert
      v-if="suggestedDrive"
      color="info"
      variant="subtle"
      :icon="icons.cloud"
      title="Google Drive détecté"
      :description="`Les sauvegardes peuvent aller dans ${suggestedDrive} : elles seront copiées en ligne automatiquement.`"
      :actions="[
        {
          label: 'Utiliser Google Drive',
          color: 'info',
          onClick: () => emit('useFolder', suggestedDrive ?? ''),
        },
      ]"
    />
    <UAlert
      v-else-if="status.data.value && !status.data.value.driveFolder"
      color="neutral"
      variant="subtle"
      :icon="icons.cloudOff"
      title="Google Drive n'est pas installé sur ce PC"
      description="Installez « Google Drive pour ordinateur » : un dossier Mon Drive apparaît et sera proposé ici. En attendant, les sauvegardes restent sur ce PC."
    />

    <UAlert
      v-if="status.data.value?.lastError"
      color="error"
      variant="subtle"
      :icon="icons.error"
      title="La dernière sauvegarde a échoué"
      :description="status.data.value.lastError.message"
    />

    <div
      class="bg-elevated/50 flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2"
    >
      <div class="flex items-center gap-2 text-sm">
        <UIcon
          :name="isStale ? icons.warning : icons.backupOk"
          :class="isStale ? 'text-warning' : 'text-success'"
          class="size-4 shrink-0"
        />
        <span v-if="status.isPending.value" class="text-muted">Chargement…</span>
        <span v-else-if="latestAt">
          Dernière sauvegarde le <strong>{{ formatDateTime(latestAt) }}</strong>
          <span class="text-muted"> · {{ status.data.value?.backups.length }} conservée(s)</span>
        </span>
        <span v-else>Aucune sauvegarde pour l'instant.</span>
      </div>
      <UButton
        :icon="icons.backupNow"
        label="Sauvegarder maintenant"
        color="neutral"
        variant="outline"
        :loading="backupNow.isPending.value"
        @click="backupNow.mutate()"
      />
    </div>
    <p v-if="savedFolderChanged" class="text-muted text-xs">
      Enregistrez les paramètres pour sauvegarder dans le nouveau dossier.
    </p>

    <ul v-if="status.data.value?.backups.length" class="divide-default divide-y text-sm">
      <li
        v-for="backup in status.data.value.backups.slice(0, VISIBLE_BACKUPS)"
        :key="backup.fileName"
        class="flex items-center justify-between gap-3 py-1.5"
      >
        <span>{{ formatDateTime(backup.createdAt) }}</span>
        <span class="flex items-center gap-2">
          <span class="text-muted">{{ formatSize(backup.sizeBytes) }}</span>
          <UButton
            :to="`/api/sauvegardes/${backup.fileName}`"
            external
            :icon="icons.download"
            color="neutral"
            variant="ghost"
            size="xs"
            :aria-label="`Télécharger la sauvegarde du ${formatDateTime(backup.createdAt)}`"
          />
        </span>
      </li>
    </ul>
  </div>
</template>
