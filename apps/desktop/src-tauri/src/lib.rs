//! G-stock de bureau : une fenêtre Tauri devant le serveur G-stock lancé en arrière-plan.
//!
//! Au lancement, l'écran `splash/` s'affiche pendant que l'on prépare les données du poste, puis
//! la fenêtre bascule sur le serveur local dès qu'il répond. Fermer la fenêtre la range près de
//! l'horloge ; « Quitter » dans le menu de l'icône arrête l'application et le serveur.

mod backend;
mod commands;
mod phone;
mod secret;
mod server;
mod storage;
mod tray;
mod updates;
mod window;

use tauri::{AppHandle, Manager, RunEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};
use tauri_plugin_window_state::StateFlags;

use crate::backend::{Backend, BackendState};

/// Argument du lancement au démarrage de Windows : l'application démarre rangée.
const AUTOSTART_ARG: &str = "--minimized";

pub fn run() {
    let minimized = std::env::args().any(|argument| argument == AUTOSTART_ARG);

    let app = tauri::Builder::default()
        // En premier : un second lancement ramène la fenêtre existante, sans second serveur.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            window::show(app);
        }))
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![AUTOSTART_ARG]),
        ))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(BackendState::default())
        .manage(updates::PendingUpdate::default())
        .invoke_handler(tauri::generate_handler![
            commands::desktop_info,
            commands::set_autostart,
            commands::pick_folder,
            commands::open_file,
            commands::open_folder,
            commands::reveal_file,
            commands::open_whatsapp,
            commands::notify,
            commands::restore_backup,
            updates::check_update,
            updates::install_update,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            window::create(&handle, !minimized)?;
            tray::create(&handle)?;
            // Les boîtes de dialogue bloquantes et l'attente du serveur ne doivent pas figer
            // la fenêtre.
            std::thread::spawn(move || boot(&handle));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("G-stock n'a pas pu s'initialiser");

    app.run(|app, event| {
        if let RunEvent::Exit = event {
            backend::stop(app);
        }
    });
}

fn boot(app: &AppHandle) {
    let started = Backend::start(app).and_then(|backend| {
        if let Ok(mut state) = app.state::<BackendState>().0.lock() {
            *state = Some(backend);
        }
        window::open_app(app)
    });
    match started {
        Ok(()) => {
            tauri::async_runtime::spawn(updates::check_on_launch(app.clone()));
        }
        Err(error) => {
            app.dialog()
                .message(format!("{error:#}"))
                .title("G-stock n'a pas pu démarrer")
                .kind(MessageDialogKind::Error)
                .blocking_show();
            app.exit(1);
        }
    }
}
