import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** Ce que l'application de bureau dit d'elle-même (`desktop_info` dans apps/desktop). */
export interface DesktopInfo {
  version: string;
  dataDir: string;
  logsDir: string;
  autostart: boolean;
  /** Adresse du PC sur Tailscale, autorisée pour le téléphone ; null sans Tailscale. */
  phoneOrigin: string | null;
}

/** Émis par l'icône près de l'horloge, « Sauvegarder maintenant ». */
const BACKUP_REQUESTED_EVENT = "gstock://sauvegarder";

/** Les commandes renvoient leur erreur en texte : on en fait une vraie erreur pour useNotify. */
const call = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
};

const commands = {
  info: () => call<DesktopInfo>("desktop_info"),
  notify: (title: string, body: string) => call<null>("notify", { body, title }),
  /** Avertit quand l'utilisateur demande une sauvegarde depuis l'icône ; renvoie le désabonnement. */
  onBackupRequested: (handler: () => void) => listen(BACKUP_REQUESTED_EVENT, handler),
  openFile: (path: string) => call<null>("open_file", { path }),
  openFolder: (path: string) => call<null>("open_folder", { path }),
  openWhatsapp: (phone: string | null, text: string) =>
    call<null>("open_whatsapp", { phone, text }),
  /** Fenêtre Windows de choix d'un dossier ; null si l'utilisateur annule. */
  pickFolder: (title: string, current?: string) =>
    call<string | null>("pick_folder", { current: current || null, title }),
  /** Restaure une sauvegarde après confirmation ; false si l'utilisateur renonce. */
  restoreBackup: (source: { path?: string; folder?: string }) =>
    call<boolean>("restore_backup", {
      folder: source.folder ?? null,
      path: source.path ?? null,
    }),
  revealFile: (path: string) => call<null>("reveal_file", { path }),
  setAutostart: (enabled: boolean) => call<boolean>("set_autostart", { enabled }),
};

/**
 * Fonctions propres à l'application de bureau (apps/desktop). Dans un navigateur ou sur le
 * téléphone, `isDesktop` est faux et les écrans gardent leur comportement web.
 */
export const useDesktop = () => ({
  isDesktop: import.meta.client && isTauri(),
  ...commands,
});

/** Chemin d'un fichier dans un dossier Windows. */
export const joinWindowsPath = (folder: string, fileName: string): string =>
  `${folder.replace(/[\\/]+$/u, "")}\\${fileName}`;
