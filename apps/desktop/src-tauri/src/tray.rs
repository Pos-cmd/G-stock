//! L'icône près de l'horloge : rouvrir G-stock, sauvegarder, quitter pour de bon.

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter,
};

use crate::window;

/// Écouté par la page (`useDesktopEvents`), qui lance la sauvegarde par l'API.
pub const BACKUP_EVENT: &str = "gstock://sauvegarder";

const OPEN: &str = "ouvrir";
const BACKUP: &str = "sauvegarder";
const QUIT: &str = "quitter";

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, OPEN, "Ouvrir G-stock", true, None::<&str>)?,
            &MenuItem::with_id(app, BACKUP, "Sauvegarder maintenant", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, QUIT, "Quitter G-stock", true, None::<&str>)?,
        ],
    )?;
    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("G-stock")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            OPEN => window::show(app),
            BACKUP => {
                let _ = app.emit_to(window::MAIN, BACKUP_EVENT, ());
            }
            QUIT => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                window::show(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}
