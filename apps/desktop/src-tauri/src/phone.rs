//! Accès depuis le téléphone par Tailscale.
//!
//! Le serveur n'écoute que sur ce PC (127.0.0.1). `tailscale serve --bg 3210` le publie en HTTPS
//! sur le réseau privé Tailscale ; il reste à autoriser cette adresse auprès de l'authentification,
//! ce que fait `TRUSTED_ORIGINS` quand Tailscale est installé et connecté.

use std::{path::PathBuf, process::Command};

use serde::Deserialize;

use crate::server::hide_console;

#[derive(Deserialize)]
struct Status {
    #[serde(rename = "BackendState")]
    backend_state: Option<String>,
    #[serde(rename = "Self")]
    this_device: Option<Device>,
}

#[derive(Deserialize)]
struct Device {
    #[serde(rename = "DNSName")]
    dns_name: Option<String>,
}

/// L'adresse HTTPS de ce PC sur Tailscale (`https://mon-pc.tail1234.ts.net`), s'il est connecté.
pub fn tailscale_origin() -> Option<String> {
    let mut command = Command::new(tailscale_executable()?);
    command.args(["status", "--json"]);
    hide_console(&mut command);
    let output = command.output().ok()?;
    if !output.status.success() {
        return None;
    }
    let status: Status = serde_json::from_slice(&output.stdout).ok()?;
    if status.backend_state.as_deref() != Some("Running") {
        return None;
    }
    let name = status.this_device?.dns_name?;
    let name = name.trim_end_matches('.');
    (!name.is_empty()).then(|| format!("https://{name}"))
}

fn tailscale_executable() -> Option<PathBuf> {
    let program_files = std::env::var_os("ProgramFiles")?;
    let executable = PathBuf::from(program_files)
        .join("Tailscale")
        .join("tailscale.exe");
    executable.exists().then_some(executable)
}
