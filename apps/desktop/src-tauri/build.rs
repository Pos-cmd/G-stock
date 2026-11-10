/// Commandes de `src/commands.rs` : Tauri en tire les permissions `allow-<commande>`, accordées
/// au serveur local dans `capabilities/server.json`.
const COMMANDS: &[&str] = &[
    "desktop_info",
    "set_autostart",
    "pick_folder",
    "open_file",
    "open_folder",
    "reveal_file",
    "open_whatsapp",
    "notify",
    "restore_backup",
];

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("échec du build Tauri");
}
