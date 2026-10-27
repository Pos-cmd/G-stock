import type { AppSettings } from "@G-stock/api/schemas/settings";
import { DEFAULT_EXCHANGE_RATES } from "@G-stock/core/currency";
import type { ExchangeRates } from "@G-stock/core/currency";
import { defineStore } from "pinia";

/** Réglages de l'application (taux de change…), chargés une fois et partagés par tous les écrans. */
export const useSettingsStore = defineStore("settings", () => {
  const { $orpc } = useNuxtApp();

  const settings = ref<AppSettings | null>(null);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  const rates = computed<ExchangeRates>(() =>
    settings.value
      ? {
          fcfaPerUsd: settings.value.fcfaPerUsd,
          rmbPerUsd: settings.value.rmbPerUsd,
        }
      : DEFAULT_EXCHANGE_RATES,
  );

  const load = async (force = false) => {
    if ((settings.value && !force) || loading.value) {
      return;
    }
    loading.value = true;
    try {
      settings.value = await $orpc.settings.get.call();
      error.value = null;
    } catch (error_) {
      // Les écrans restent utilisables avec les taux par défaut.
      error.value = error_ instanceof Error ? error_ : new Error("Réglages indisponibles");
    } finally {
      loading.value = false;
    }
  };

  const save = async (input: AppSettings) => {
    settings.value = await $orpc.settings.update.call(input);
  };

  return { error, load, loading, rates, save, settings };
});
