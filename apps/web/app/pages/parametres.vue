<script setup lang="ts">
import { appSettingsSchema } from "@G-stock/api/schemas/settings";
import type { AppSettings } from "@G-stock/api/schemas/settings";
import { rmbToFcfa, rmbToUsd } from "@G-stock/core/currency";
import { formatFcfa, formatRmb, formatUsd } from "@G-stock/core/format";
import type { FormSubmitEvent } from "@nuxt/ui";

import PagePanel from "~/components/layout/PagePanel.vue";
import BackupStatus from "~/components/settings/BackupStatus.vue";
import { useSettingsStore } from "~/stores/settings";

const icons = useIcons();

useHead({ title: "Paramètres" });

const SAMPLE_AMOUNT_RMB = 100;

const settingsStore = useSettingsStore();
const notify = useNotify();
const saving = ref(false);

const state = reactive<AppSettings>({
  backupFolder: "",
  backupKeep: 0,
  companyAddress: "",
  companyName: "",
  companyPhone: "",
  documentsFolder: "",
  fcfaPerUsd: 0,
  phoneCountryCode: "",
  receivableAlertDays: 0,
  receivableCriticalDays: 0,
  receivableWarningDays: 0,
  rmbPerUsd: 0,
});

onMounted(async () => {
  await settingsStore.load(true);
  if (settingsStore.settings) {
    Object.assign(state, settingsStore.settings);
  }
});

const previewRates = computed(() =>
  state.rmbPerUsd > 0 && state.fcfaPerUsd > 0
    ? { fcfaPerUsd: state.fcfaPerUsd, rmbPerUsd: state.rmbPerUsd }
    : null,
);

const onSubmit = async (event: FormSubmitEvent<AppSettings>) => {
  saving.value = true;
  try {
    await settingsStore.save(event.data);
    notify.success("Paramètres enregistrés");
  } catch (error) {
    notify.error("Enregistrement impossible", error);
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <PagePanel
    id="settings"
    title="Paramètres"
    description="Taux de change, coordonnées de l'entreprise, créances et sauvegardes."
  >
    <UAlert
      v-if="settingsStore.error"
      color="error"
      variant="subtle"
      :icon="icons.error"
      title="Impossible de charger les paramètres"
      :description="settingsStore.error.message"
      class="mb-6"
    />

    <UForm
      :schema="appSettingsSchema"
      :state="state"
      :disabled="settingsStore.loading"
      class="mx-auto max-w-3xl space-y-6"
      @submit="onSubmit"
    >
      <UPageCard
        title="Taux de change"
        description="Utilisés pour convertir les prix fournisseurs (RMB) en FCFA. Une commande garde les taux en vigueur à sa création."
        variant="subtle"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="RMB pour 1 USD" name="rmbPerUsd" required>
            <UInputNumber
              v-model="state.rmbPerUsd"
              :min="0"
              :step="0.05"
              :format-options="RMB_RATE_FORMAT"
              class="w-full sm:w-48"
            />
          </UFormField>
          <UFormField label="FCFA pour 1 USD" name="fcfaPerUsd" required>
            <UInputNumber
              v-model="state.fcfaPerUsd"
              :min="0"
              :step="1"
              :format-options="FCFA_RATE_FORMAT"
              class="w-full sm:w-48"
            />
          </UFormField>
        </div>

        <div
          v-if="previewRates"
          class="bg-elevated/50 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <UIcon :name="icons.exchangeRate" class="text-muted size-4" />
          <span>{{ formatRmb(SAMPLE_AMOUNT_RMB) }}</span>
          <span class="text-muted">→</span>
          <span>{{ formatUsd(rmbToUsd(SAMPLE_AMOUNT_RMB, previewRates)) }}</span>
          <span class="text-muted">→</span>
          <strong class="text-highlighted">{{
            formatFcfa(rmbToFcfa(SAMPLE_AMOUNT_RMB, previewRates))
          }}</strong>
        </div>
      </UPageCard>

      <UPageCard
        title="Ancienneté des créances"
        description="Seuils (en jours) des alertes visuelles sur les ventes à crédit non soldées."
        variant="subtle"
      >
        <div class="grid gap-4 sm:grid-cols-3">
          <UFormField label="Attention après" name="receivableWarningDays" required>
            <UInputNumber
              v-model="state.receivableWarningDays"
              :format-options="DAYS_FORMAT"
              :min="1"
              :step="1"
              class="w-full sm:w-36"
            />
          </UFormField>
          <UFormField label="Alerte après" name="receivableAlertDays" required>
            <UInputNumber
              v-model="state.receivableAlertDays"
              :format-options="DAYS_FORMAT"
              :min="1"
              :step="1"
              class="w-full sm:w-36"
            />
          </UFormField>
          <UFormField label="Critique après" name="receivableCriticalDays" required>
            <UInputNumber
              v-model="state.receivableCriticalDays"
              :format-options="DAYS_FORMAT"
              :min="1"
              :step="1"
              class="w-full sm:w-36"
            />
          </UFormField>
        </div>
      </UPageCard>

      <UPageCard
        title="Entreprise et documents"
        description="Coordonnées imprimées en tête des PDF (reçus, fiches de commande, simulations) et dossier où ils sont rangés."
        variant="subtle"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Nom de l'entreprise" name="companyName" help="« G-stock » si vide.">
            <UInput v-model="state.companyName" class="w-full" />
          </UFormField>
          <UFormField label="Téléphone" name="companyPhone">
            <UInput v-model="state.companyPhone" type="tel" class="w-full" />
          </UFormField>
          <UFormField label="Adresse" name="companyAddress">
            <UInput v-model="state.companyAddress" placeholder="Quartier, ville" class="w-full" />
          </UFormField>
          <UFormField
            label="Indicatif téléphonique"
            name="phoneCountryCode"
            help="Ajouté aux numéros des clients saisis sans indicatif, pour WhatsApp."
          >
            <UInput
              v-model="state.phoneCountryCode"
              placeholder="ex. 228"
              inputmode="numeric"
              :icon="icons.phone"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Dossier des documents"
            name="documentsFolder"
            required
            class="sm:col-span-2"
            help="Sous-dossiers créés automatiquement : Ventes, Simulations, Commandes/<référence>."
          >
            <UInput v-model="state.documentsFolder" :icon="icons.folder" class="w-full" />
          </UFormField>
        </div>
      </UPageCard>

      <UPageCard
        title="Sauvegarde"
        description="Une copie de la base est faite chaque jour, tant que G-stock tourne. Dans un dossier Google Drive, elle est aussi envoyée en ligne : vos données survivent à une panne ou un vol du PC."
        variant="subtle"
      >
        <div class="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <UFormField label="Dossier des sauvegardes" name="backupFolder" required>
            <UInput v-model="state.backupFolder" :icon="icons.backupFolder" class="w-full" />
          </UFormField>
          <UFormField
            label="Sauvegardes conservées"
            name="backupKeep"
            required
            help="Les plus anciennes sont supprimées."
          >
            <UInputNumber
              v-model="state.backupKeep"
              :format-options="INTEGER_FORMAT"
              :min="1"
              :max="365"
              :step="1"
              class="w-full"
            />
          </UFormField>
        </div>

        <BackupStatus :folder="state.backupFolder" @use-folder="state.backupFolder = $event" />
      </UPageCard>

      <div class="flex justify-end">
        <UButton type="submit" :icon="icons.save" label="Enregistrer" :loading="saving" />
      </div>
    </UForm>
  </PagePanel>
</template>
