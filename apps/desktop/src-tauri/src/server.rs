//! Le serveur G-stock (Nuxt/Nitro construit) lancé avec le Node.js embarqué.
//!
//! L'interface et l'API restent celles de `apps/web` : la fenêtre affiche simplement l'adresse
//! locale du serveur. Il est rattaché à l'application par un « job » Windows, qui le termine même
//! si l'application plante, pour qu'aucun processus orphelin ne garde la base ouverte.

use std::{
    fs::{self, File},
    net::{SocketAddr, TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    thread,
    time::{Duration, Instant},
};

use anyhow::{bail, Context, Result};

/// Port fixe : l'adresse fait partie de la config d'authentification (cookies, origines). Distinct
/// de 3001 (`pnpm dev`) et 3003 (`pnpm dev:demo`).
pub const PORT: u16 = 3210;
const HOST: [u8; 4] = [127, 0, 0, 1];
const STARTUP_TIMEOUT: Duration = Duration::from_secs(60);
const POLL_INTERVAL: Duration = Duration::from_millis(150);
const LOG_TAIL_LINES: usize = 15;
/// Variables héritées qui changeraient le comportement du Node embarqué ou de varlock.
const INHERITED_TO_CLEAR: [&str; 4] = [
    "NODE_OPTIONS",
    "__VARLOCK_ENV",
    "_VARLOCK_ENV_KEY",
    "_VARLOCK_USE_INJECTED_ENV",
];

pub fn origin() -> String {
    format!("http://127.0.0.1:{PORT}")
}

/// Fichiers livrés avec l'application (voir `scripts/prepare-server.mjs`).
pub struct Bundle {
    node: PathBuf,
    entry: PathBuf,
    migrations: PathBuf,
    frozen_env: PathBuf,
}

impl Bundle {
    pub fn locate(resource_dir: &Path) -> Result<Self> {
        let executable = std::env::current_exe().context("Emplacement de l'application inconnu")?;
        let executable_dir = executable
            .parent()
            .context("Dossier de l'application introuvable")?;
        // Tauri renvoie des chemins « étendus » (`\\?\C:\…`) que Node ne sait pas ouvrir comme
        // script d'entrée : on les ramène à la forme classique.
        let executable_dir = dunce::simplified(executable_dir);
        let resources = dunce::simplified(resource_dir).join("resources");
        let bundle = Self {
            node: executable_dir.join("node.exe"),
            entry: resources.join("server").join("server").join("index.mjs"),
            migrations: resources.join("migrations"),
            frozen_env: resources.join("frozen-env"),
        };
        for path in [
            &bundle.node,
            &bundle.entry,
            &bundle.migrations,
            &bundle.frozen_env,
        ] {
            if !path.exists() {
                bail!(
                    "Fichier de l'application manquant : {}\nRéinstallez G-stock.",
                    path.display()
                );
            }
        }
        Ok(bundle)
    }
}

/// Valeurs propres au poste, fournies au lancement (`@dynamic=boot` dans `.env.schema`).
pub struct Instance<'a> {
    pub secret: &'a str,
    pub database: &'a Path,
    pub working_dir: &'a Path,
    pub log_file: &'a Path,
}

pub struct Server {
    child: Child,
    #[cfg(windows)]
    _job: win32job::Job,
}

impl Server {
    pub fn start(bundle: &Bundle, instance: &Instance) -> Result<Self> {
        ensure_port_free()?;
        rotate_log(instance.log_file);
        let log =
            File::create(instance.log_file).context("Création du journal du serveur impossible")?;

        let mut command = Command::new(&bundle.node);
        command
            .arg(&bundle.entry)
            .current_dir(instance.working_dir)
            .env("NODE_ENV", "production")
            .env("_VARLOCK_USE_FROZEN_ENV", &bundle.frozen_env)
            .env("NUXT_MIGRATIONS_FOLDER", &bundle.migrations)
            .env("BETTER_AUTH_SECRET", instance.secret)
            .env("BETTER_AUTH_URL", origin())
            .env("DATABASE_URL", database_url(instance.database))
            .env("HOST", "127.0.0.1")
            .env("PORT", PORT.to_string())
            .stdin(Stdio::null())
            .stdout(log.try_clone()?)
            .stderr(log);
        for key in INHERITED_TO_CLEAR {
            command.env_remove(key);
        }
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            command.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = command
            .spawn()
            .context("Lancement du serveur G-stock impossible")?;
        #[cfg(windows)]
        let job = match bind_to_app(&child) {
            Ok(job) => job,
            Err(error) => {
                let _ = child.kill();
                return Err(error);
            }
        };
        let mut server = Self {
            child,
            #[cfg(windows)]
            _job: job,
        };
        server.wait_until_ready(instance.log_file)?;
        Ok(server)
    }

    fn wait_until_ready(&mut self, log_file: &Path) -> Result<()> {
        let address = SocketAddr::from((HOST, PORT));
        let deadline = Instant::now() + STARTUP_TIMEOUT;
        loop {
            if let Some(status) = self.child.try_wait()? {
                bail!(
                    "Le serveur s'est arrêté au démarrage ({status}).\n\n{}",
                    log_tail(log_file)
                );
            }
            if TcpStream::connect_timeout(&address, POLL_INTERVAL).is_ok() {
                return Ok(());
            }
            if Instant::now() >= deadline {
                bail!(
                    "Le serveur ne répond pas après {} secondes.\n\n{}",
                    STARTUP_TIMEOUT.as_secs(),
                    log_tail(log_file)
                );
            }
            thread::sleep(POLL_INTERVAL);
        }
    }
}

impl Drop for Server {
    fn drop(&mut self) {
        // SQLite reste cohérent même arrêté net : une écriture en cours est annulée au prochain
        // démarrage, jamais à moitié appliquée.
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

/// Un autre programme sur le port recevrait les requêtes de la fenêtre : on refuse de démarrer.
fn ensure_port_free() -> Result<()> {
    TcpListener::bind(SocketAddr::from((HOST, PORT)))
        .map(drop)
        .with_context(|| {
            format!(
                "Le port {PORT} est déjà utilisé par un autre programme.\n\
                 Fermez-le, ou redémarrez l'ordinateur, puis relancez G-stock."
            )
        })
}

/// libsql attend une URL `file:` ; les barres obliques évitent les échappements Windows.
fn database_url(database: &Path) -> String {
    format!("file:{}", database.to_string_lossy().replace('\\', "/"))
}

/// Garde le journal du lancement précédent, utile quand on relance après une erreur.
fn rotate_log(log_file: &Path) {
    if log_file.exists() {
        let _ = fs::rename(log_file, log_file.with_extension("precedent.log"));
    }
}

fn log_tail(log_file: &Path) -> String {
    let content = fs::read_to_string(log_file).unwrap_or_default();
    let lines: Vec<&str> = content.lines().collect();
    let start = lines.len().saturating_sub(LOG_TAIL_LINES);
    format!(
        "Journal : {}\n{}",
        log_file.display(),
        lines[start..].join("\n")
    )
}

#[cfg(windows)]
fn bind_to_app(child: &Child) -> Result<win32job::Job> {
    use std::os::windows::io::AsRawHandle;

    let job = win32job::Job::create().context("Création du job Windows impossible")?;
    let mut limits = job.query_extended_limit_info()?;
    limits.limit_kill_on_job_close();
    job.set_extended_limit_info(&limits)?;
    job.assign_process(child.as_raw_handle() as isize)?;
    Ok(job)
}
