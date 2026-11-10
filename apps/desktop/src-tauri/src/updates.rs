//! Mises à jour de l'application, publiées dans les releases GitHub (`scripts/release.mjs`).
//!
//! L'application lit `latest.json` sur la dernière release, et n'installe qu'un installateur signé
//! par la clé de G-stock (clé publique dans `tauri.conf.json`). Les données ne bougent pas :
//! la base est dans `%APPDATA%\G-stock`, l'application dans `%LOCALAPPDATA%\G-stock`.

use std::{fmt::Display, sync::Mutex};

use serde::Serialize;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_updater::{Update, Updater, UpdaterExt};

use crate::backend;

/// La mise à jour trouvée par la dernière vérification, prête à être installée.
#[derive(Default)]
pub struct PendingUpdate(Mutex<Option<Update>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    version: String,
    current_version: String,
    notes: Option<String>,
}

fn message(error: impl Display) -> String {
    error.to_string()
}

/// En développement, `GSTOCK_UPDATE_ENDPOINT` remplace l'adresse des releases (tests locaux).
fn updater(app: &AppHandle) -> tauri_plugin_updater::Result<Updater> {
    #[cfg(debug_assertions)]
    if let Ok(endpoint) = std::env::var("GSTOCK_UPDATE_ENDPOINT") {
        if let Ok(url) = endpoint.parse() {
            return app.updater_builder().endpoints(vec![url])?.build();
        }
    }
    app.updater()
}

async fn find(app: &AppHandle) -> Result<Option<UpdateInfo>, String> {
    let update = updater(app)
        .map_err(message)?
        .check()
        .await
        .map_err(message)?;
    let info = update.as_ref().map(|update| UpdateInfo {
        version: update.version.clone(),
        current_version: update.current_version.clone(),
        notes: update.body.clone().filter(|notes| !notes.trim().is_empty()),
    });
    let pending = app.state::<PendingUpdate>();
    *pending.0.lock().map_err(message)? = update;
    Ok(info)
}

/// Au lancement : prévient d'une nouvelle version. Sans connexion, on réessaiera au suivant.
pub async fn check_on_launch(app: AppHandle) {
    if let Ok(Some(info)) = find(&app).await {
        let _ = app
            .notification()
            .builder()
            .title(format!("G-stock {} est disponible", info.version))
            .body("Paramètres → Application de bureau pour l'installer.")
            .show();
    }
}

#[tauri::command]
pub async fn check_update(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    find(&app).await
}

/// Télécharge et vérifie la mise à jour, arrête le serveur (l'installateur remplace `node.exe`
/// et ses fichiers), puis lance l'installation : G-stock se ferme et se relance à la fin.
#[tauri::command]
pub async fn install_update(
    app: AppHandle,
    pending: State<'_, PendingUpdate>,
) -> Result<(), String> {
    let found = pending.0.lock().map_err(message)?.take();
    let update = match found {
        Some(update) => update,
        None => updater(&app)
            .map_err(message)?
            .check()
            .await
            .map_err(message)?
            .ok_or("Aucune mise à jour disponible.")?,
    };
    let installer = update
        .download(|_, _| {}, || {})
        .await
        .map_err(|error| format!("Téléchargement impossible ({error}). Vérifiez la connexion."))?;
    backend::stop(&app);
    update
        .install(installer)
        .map_err(|error| format!("Installation impossible ({error}). Relancez G-stock."))?;
    app.restart();
}
