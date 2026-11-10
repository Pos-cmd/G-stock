//! La fenêtre principale : écran de démarrage, puis le serveur G-stock.
//!
//! Elle ne quitte jamais l'application : un lien vers un autre site (WhatsApp, Google Drive…)
//! s'ouvre dans le navigateur ou l'application du système. La fermer la range près de l'horloge,
//! le serveur continue (sauvegardes, accès depuis le téléphone).

use std::sync::atomic::{AtomicBool, Ordering};

use anyhow::{Context, Result};
use tauri::{
    webview::NewWindowResponse, AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder,
    WindowEvent,
};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

use crate::server;

pub const MAIN: &str = "main";
/// `splash/index.html`, tel que Tauri le sert sous Windows.
const SPLASH_URL: &str = "http://tauri.localhost/index.html";
/// Liens confiés au système plutôt qu'ouverts dans la fenêtre.
const SYSTEM_SCHEMES: [&str; 5] = ["http", "https", "mailto", "tel", "whatsapp"];

static TRAY_HINT_SHOWN: AtomicBool = AtomicBool::new(false);

pub fn create(app: &AppHandle, visible: bool) -> tauri::Result<()> {
    let navigation_app = app.clone();
    let popup_app = app.clone();
    let window = WebviewWindowBuilder::new(app, MAIN, WebviewUrl::App("index.html".into()))
        .title("G-stock")
        .inner_size(1360.0, 860.0)
        .min_inner_size(1024.0, 640.0)
        .center()
        .visible(visible)
        .on_navigation(move |url| stays_inside(&navigation_app, url))
        .on_new_window(move |url, _features| {
            if stays_inside(&popup_app, &url) {
                NewWindowResponse::Allow
            } else {
                NewWindowResponse::Deny
            }
        })
        .build()?;

    let close_app = app.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            hide_to_tray(&close_app);
        }
    });
    Ok(())
}

/// Affiche G-stock une fois le serveur prêt.
pub fn open_app(app: &AppHandle) -> Result<()> {
    navigate(app, &server::origin())
}

/// Revient à l'écran de démarrage pendant que le serveur redémarre.
pub fn show_splash(app: &AppHandle) -> Result<()> {
    navigate(app, SPLASH_URL)
}

pub fn show(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn navigate(app: &AppHandle, url: &str) -> Result<()> {
    let window = app
        .get_webview_window(MAIN)
        .context("Fenêtre principale introuvable")?;
    window.navigate(Url::parse(url)?)?;
    Ok(())
}

fn stays_inside(app: &AppHandle, url: &Url) -> bool {
    if is_app_url(url) {
        return true;
    }
    if SYSTEM_SCHEMES.contains(&url.scheme()) {
        let _ = app.opener().open_url(url.as_str(), None::<&str>);
    }
    false
}

fn is_app_url(url: &Url) -> bool {
    match url.scheme() {
        "about" | "blob" | "data" => true,
        "http" => matches!(
            (url.host_str(), url.port_or_known_default()),
            (Some("tauri.localhost"), _) | (Some("127.0.0.1"), Some(server::PORT))
        ),
        _ => false,
    }
}

fn hide_to_tray(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN) {
        let _ = window.hide();
    }
    if !TRAY_HINT_SHOWN.swap(true, Ordering::Relaxed) {
        let _ = app
            .notification()
            .builder()
            .title("G-stock reste ouvert")
            .body("Il continue près de l'horloge (sauvegardes, téléphone). Pour l'arrêter : clic droit sur son icône, « Quitter G-stock ».")
            .show();
    }
}
