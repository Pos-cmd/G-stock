//! G-stock de bureau : une fenêtre Tauri devant le serveur G-stock lancé en arrière-plan.
//!
//! Au lancement, l'écran `splash/` s'affiche pendant que l'on prépare les données du poste, puis
//! la fenêtre bascule sur le serveur local dès qu'il répond. Fermer l'application l'arrête.

mod secret;
mod server;
mod storage;

use std::sync::Mutex;

use anyhow::{Context, Result};
use tauri::{AppHandle, Manager, RunEvent, Url};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

const MAIN_WINDOW: &str = "main";

/// Le serveur en cours, arrêté quand l'application se ferme.
#[derive(Default)]
struct RunningServer(Mutex<Option<server::Server>>);

pub fn run() {
    let app = tauri::Builder::default()
        // En premier : un second lancement ramène la fenêtre existante, sans second serveur.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(RunningServer::default())
        .setup(|app| {
            let handle = app.handle().clone();
            // Les boîtes de dialogue bloquantes et l'attente du serveur ne doivent pas figer
            // la fenêtre.
            std::thread::spawn(move || boot(&handle));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("G-stock n'a pas pu s'initialiser");

    app.run(|app, event| {
        if let RunEvent::Exit = event {
            stop_server(app);
        }
    });
}

fn boot(app: &AppHandle) {
    if let Err(error) = start(app) {
        app.dialog()
            .message(format!("{error:#}"))
            .title("G-stock n'a pas pu démarrer")
            .kind(MessageDialogKind::Error)
            .blocking_show();
        app.exit(1);
    }
}

fn start(app: &AppHandle) -> Result<()> {
    let data = storage::DataPaths::prepare(app)?;
    storage::ensure_database(app, &data.database)?;
    let secret = secret::load_or_create()?;
    let resource_dir = app
        .path()
        .resource_dir()
        .context("Dossier de l'application introuvable")?;
    let bundle = server::Bundle::locate(&resource_dir)?;
    let server = server::Server::start(
        &bundle,
        &server::Instance {
            secret: &secret,
            database: &data.database,
            working_dir: &data.dir,
            log_file: &data.server_log,
        },
    )?;
    if let Ok(mut running) = app.state::<RunningServer>().0.lock() {
        *running = Some(server);
    }

    let window = app
        .get_webview_window(MAIN_WINDOW)
        .context("Fenêtre principale introuvable")?;
    window.navigate(Url::parse(&server::origin())?)?;
    Ok(())
}

fn stop_server(app: &AppHandle) {
    let server = app
        .state::<RunningServer>()
        .0
        .lock()
        .ok()
        .and_then(|mut running| running.take());
    drop(server);
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
