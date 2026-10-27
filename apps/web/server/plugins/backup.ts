import { runAutomaticBackup } from "@G-stock/api/services/backups";

import { db } from "../../src/services";

/** Première vérification peu après le démarrage, puis toutes les heures. */
const FIRST_CHECK_DELAY_MS = 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

const check = async () => {
  try {
    await ensureDatabaseReady();
    await runAutomaticBackup(db);
  } catch {
    // L'erreur est conservée par le service et affichée dans Paramètres ; nouvel essai dans une heure.
  }
};

// Sauvegarde quotidienne de la base vers le dossier choisi (Google Drive de préférence).
export default defineNitroPlugin((nitroApp) => {
  const firstCheck = setTimeout(check, FIRST_CHECK_DELAY_MS);
  const interval = setInterval(check, CHECK_INTERVAL_MS);
  nitroApp.hooks.hook("close", () => {
    clearTimeout(firstCheck);
    clearInterval(interval);
  });
});
