//! Commandes que la page G-stock peut appeler quand elle tourne dans l'application de bureau
//! (`apps/web/app/composables/useDesktop.ts`). Seules celles-ci sont autorisées depuis le serveur
//! local (`capabilities/server.json`), et chacune vérifie ce qu'elle reçoit : la page ne peut ni
//! lancer un programme, ni ouvrir autre chose qu'un PDF ou un dossier.

use std::{
    fmt::Display,
    path::{Path, PathBuf},
};

use serde::Serialize;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_autostart::ManagerExt as _;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

use crate::{backend::BackendState, window};

/// Le message d'erreur affiché par la page.
type CommandResult<T> = Result<T, String>;

fn message(error: impl Display) -> String {
    error.to_string()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopInfo {
    version: String,
    data_dir: String,
    logs_dir: String,
    autostart: bool,
    /// Adresse HTTPS du PC sur Tailscale, autorisée pour le téléphone.
    phone_origin: Option<String>,
}

#[tauri::command]
pub fn desktop_info(
    app: AppHandle,
    backend: State<'_, BackendState>,
) -> CommandResult<DesktopInfo> {
    let backend = backend.0.lock().map_err(message)?;
    let backend = backend
        .as_ref()
        .ok_or("G-stock est encore en train de démarrer.")?;
    let data = backend.data();
    Ok(DesktopInfo {
        version: app.package_info().version.to_string(),
        data_dir: data.dir.display().to_string(),
        logs_dir: data
            .server_log
            .parent()
            .unwrap_or(&data.dir)
            .display()
            .to_string(),
        autostart: app.autolaunch().is_enabled().unwrap_or(false),
        phone_origin: backend.phone_origin().map(str::to_owned),
    })
}

#[tauri::command]
pub fn set_autostart(app: AppHandle, enabled: bool) -> CommandResult<bool> {
    let autolaunch = app.autolaunch();
    if enabled {
        autolaunch.enable().map_err(message)?;
    } else {
        autolaunch.disable().map_err(message)?;
    }
    autolaunch.is_enabled().map_err(message)
}

/// Fenêtre Windows de choix d'un dossier ; `None` si l'utilisateur annule.
#[tauri::command]
pub async fn pick_folder(
    app: AppHandle,
    title: String,
    current: Option<String>,
) -> CommandResult<Option<String>> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = app.dialog().file().set_title(title);
        if let Some(window) = app.get_webview_window(window::MAIN) {
            dialog = dialog.set_parent(&window);
        }
        if let Some(directory) = current.map(PathBuf::from).filter(|path| path.is_dir()) {
            dialog = dialog.set_directory(directory);
        }
        dialog
            .blocking_pick_folder()
            .and_then(|folder| folder.into_path().ok())
            .map(|folder| folder.display().to_string())
    })
    .await
    .map_err(message)
}

/// Ouvre un PDF dans le lecteur habituel.
#[tauri::command]
pub fn open_file(app: AppHandle, path: String) -> CommandResult<()> {
    let path = PathBuf::from(path);
    if !path.is_file() {
        return Err(format!("Fichier introuvable : {}", path.display()));
    }
    if !has_extension(&path, "pdf") {
        return Err("Seuls les PDF s'ouvrent depuis G-stock.".into());
    }
    app.opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(message)
}

/// Ouvre un dossier dans l'Explorateur.
#[tauri::command]
pub fn open_folder(app: AppHandle, path: String) -> CommandResult<()> {
    let path = PathBuf::from(path);
    if !path.is_dir() {
        return Err(format!("Dossier introuvable : {}", path.display()));
    }
    app.opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(message)
}

/// Ouvre l'Explorateur sur le dossier du fichier, le fichier sélectionné.
#[tauri::command]
pub fn reveal_file(app: AppHandle, path: String) -> CommandResult<()> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Err(format!("Fichier introuvable : {}", path.display()));
    }
    app.opener().reveal_item_in_dir(path).map_err(message)
}

/// Ouvre la discussion WhatsApp du client avec le message prêt : dans WhatsApp Desktop s'il est
/// installé, sinon sur wa.me dans le navigateur.
#[tauri::command]
pub fn open_whatsapp(app: AppHandle, phone: Option<String>, text: String) -> CommandResult<()> {
    let phone: String = phone
        .unwrap_or_default()
        .chars()
        .filter(char::is_ascii_digit)
        .collect();
    let text = percent_encode(&text);
    let url = if whatsapp_desktop_installed() {
        format!("whatsapp://send?phone={phone}&text={text}")
    } else {
        format!("https://wa.me/{phone}?text={text}")
    };
    app.opener().open_url(url, None::<&str>).map_err(message)
}

/// Notification Windows, visible même quand la fenêtre est rangée.
#[tauri::command]
pub fn notify(app: AppHandle, title: String, body: String) -> CommandResult<()> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(message)
}

/// Remplace la base par une sauvegarde, après confirmation. `path` vient de la liste des
/// sauvegardes ; sans lui, l'utilisateur choisit le fichier (`folder` : dossier proposé).
/// Renvoie `false` si l'utilisateur renonce.
#[tauri::command]
pub async fn restore_backup(
    app: AppHandle,
    path: Option<String>,
    folder: Option<String>,
) -> CommandResult<bool> {
    tauri::async_runtime::spawn_blocking(move || restore(&app, path, folder))
        .await
        .map_err(message)?
}

fn restore(app: &AppHandle, path: Option<String>, folder: Option<String>) -> CommandResult<bool> {
    let Some(backup) = path.map(PathBuf::from).or_else(|| pick_backup(app, folder)) else {
        return Ok(false);
    };
    let name = backup.file_name().map_or_else(
        || backup.display().to_string(),
        |name| name.to_string_lossy().into_owned(),
    );
    let confirmed = app
        .dialog()
        .message(format!(
            "Remplacer toutes les données actuelles par la sauvegarde « {name} » ?\n\n\
             Les ventes, achats et paiements saisis depuis seront retirés. La base actuelle est \
             gardée à côté, rien n'est supprimé."
        ))
        .title("Restaurer une sauvegarde")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Restaurer".into(),
            "Annuler".into(),
        ))
        .blocking_show();
    if !confirmed {
        return Ok(false);
    }

    window::show_splash(app).map_err(message)?;
    let state = app.state::<BackendState>();
    let outcome = {
        let mut backend = state.0.lock().map_err(message)?;
        let backend = backend
            .as_mut()
            .ok_or("G-stock est encore en train de démarrer.")?;
        backend.restore(&backup)
    };
    let _ = window::open_app(app);

    let (kind, title, text) = match &outcome {
        Ok(kept) => (
            MessageDialogKind::Info,
            "Sauvegarde restaurée",
            format!(
                "Les données sont celles de « {name} ».\n\nL'ancienne base est gardée ici :\n{}",
                kept.display()
            ),
        ),
        Err(error) => (
            MessageDialogKind::Error,
            "Restauration impossible",
            format!("{error:#}\n\nLes données n'ont pas changé."),
        ),
    };
    app.dialog()
        .message(text)
        .title(title)
        .kind(kind)
        .blocking_show();
    outcome.map(|_| true).map_err(|error| format!("{error:#}"))
}

fn pick_backup(app: &AppHandle, folder: Option<String>) -> Option<PathBuf> {
    let mut dialog = app
        .dialog()
        .file()
        .set_title("Choisir la sauvegarde à restaurer")
        .add_filter("Sauvegarde G-stock", &["db"]);
    if let Some(window) = app.get_webview_window(window::MAIN) {
        dialog = dialog.set_parent(&window);
    }
    if let Some(directory) = folder.map(PathBuf::from).filter(|path| path.is_dir()) {
        dialog = dialog.set_directory(directory);
    }
    dialog
        .blocking_pick_file()
        .and_then(|file| file.into_path().ok())
}

fn has_extension(path: &Path, extension: &str) -> bool {
    path.extension()
        .is_some_and(|value| value.eq_ignore_ascii_case(extension))
}

/// Encodage des URL (`%20` pour les espaces, comme `encodeURIComponent`).
fn percent_encode(text: &str) -> String {
    text.bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                char::from(byte).to_string()
            }
            _ => format!("%{byte:02X}"),
        })
        .collect()
}

#[cfg(windows)]
fn whatsapp_desktop_installed() -> bool {
    use winreg::{enums::HKEY_CLASSES_ROOT, RegKey};
    RegKey::predef(HKEY_CLASSES_ROOT)
        .open_subkey("whatsapp")
        .is_ok()
}

#[cfg(not(windows))]
fn whatsapp_desktop_installed() -> bool {
    false
}
