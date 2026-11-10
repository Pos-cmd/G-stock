//! Tout ce qui fait tourner G-stock sur ce poste : données, secret et serveur.

use std::{
    path::{Path, PathBuf},
    sync::Mutex,
};

use anyhow::{Context, Result};
use tauri::{AppHandle, Manager};

use crate::{
    phone, secret,
    server::{Bundle, Instance, Server},
    storage::{self, DataPaths},
};

/// Le backend démarré, absent tant que le serveur n'a pas répondu.
#[derive(Default)]
pub struct BackendState(pub Mutex<Option<Backend>>);

pub struct Backend {
    bundle: Bundle,
    data: DataPaths,
    secret: String,
    trusted_origins: Vec<String>,
    server: Option<Server>,
}

impl Backend {
    pub fn start(app: &AppHandle) -> Result<Self> {
        let data = DataPaths::prepare(app)?;
        storage::ensure_database(app, &data.database)?;
        let secret = secret::load_or_create()?;
        let resource_dir = app
            .path()
            .resource_dir()
            .context("Dossier de l'application introuvable")?;
        let mut backend = Self {
            bundle: Bundle::locate(&resource_dir)?,
            data,
            secret,
            trusted_origins: phone::tailscale_origin().into_iter().collect(),
            server: None,
        };
        backend.server = Some(backend.launch()?);
        Ok(backend)
    }

    fn launch(&self) -> Result<Server> {
        Server::start(
            &self.bundle,
            &Instance {
                secret: &self.secret,
                database: &self.data.database,
                working_dir: &self.data.dir,
                log_file: &self.data.server_log,
                trusted_origins: &self.trusted_origins,
            },
        )
    }

    /// Arrête le serveur, remplace la base par la sauvegarde et relance. Le serveur repart même
    /// si la restauration échoue, sur la base d'avant. Renvoie l'emplacement de l'ancienne base.
    pub fn restore(&mut self, backup: &Path) -> Result<PathBuf> {
        drop(self.server.take());
        let restored = storage::restore_database(backup, &self.data.database);
        self.server = Some(self.launch()?);
        restored
    }

    pub fn data(&self) -> &DataPaths {
        &self.data
    }

    pub fn phone_origin(&self) -> Option<&str> {
        self.trusted_origins.first().map(String::as_str)
    }
}

/// Arrête le serveur à la fermeture de l'application.
pub fn stop(app: &AppHandle) {
    let backend = app
        .state::<BackendState>()
        .0
        .lock()
        .ok()
        .and_then(|mut backend| backend.take());
    drop(backend);
}
