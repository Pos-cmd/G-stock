//! Emplacement des données du poste et choix de la base au premier lancement.

use std::{
    ffi::OsString,
    fs::{self, File},
    io::Read,
    path::{Path, PathBuf},
};

use anyhow::{bail, Context, Result};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

const APP_FOLDER: &str = "G-stock";
const DATABASE_FILE: &str = "gstock.db";
const SQLITE_HEADER: &[u8; 16] = b"SQLite format 3\0";

/// `%APPDATA%\G-stock` : la base, et les journaux du serveur dans `logs`.
pub struct DataPaths {
    pub dir: PathBuf,
    pub database: PathBuf,
    pub server_log: PathBuf,
}

impl DataPaths {
    pub fn prepare(app: &AppHandle) -> Result<Self> {
        let dir = data_dir(app)?;
        let logs = dir.join("logs");
        fs::create_dir_all(&logs)
            .with_context(|| format!("Création du dossier {} impossible", logs.display()))?;
        Ok(Self {
            database: dir.join(DATABASE_FILE),
            server_log: logs.join("serveur.log"),
            dir,
        })
    }
}

/// En développement, `GSTOCK_DATA_DIR` désigne un dossier de test (par exemple une copie de la
/// base démo) : les essais ne touchent ni `%APPDATA%\G-stock` ni la vraie base.
fn data_dir(app: &AppHandle) -> Result<PathBuf> {
    #[cfg(debug_assertions)]
    if let Some(dir) = std::env::var_os("GSTOCK_DATA_DIR") {
        return Ok(PathBuf::from(dir));
    }
    Ok(app
        .path()
        .data_dir()
        .context("Dossier AppData introuvable")?
        .join(APP_FOLDER))
}

/// Sans base sur ce poste, propose d'en importer une (sauvegarde ou ancienne `local.db`) avant
/// que le serveur n'en crée une vide.
pub fn ensure_database(app: &AppHandle, database: &Path) -> Result<()> {
    if database.exists() {
        return Ok(());
    }
    while wants_import(app) {
        let Some(source) = pick_database(app) else {
            continue;
        };
        match import_database(&source, database) {
            Ok(()) => return Ok(()),
            Err(error) => {
                app.dialog()
                    .message(format!("{error:#}"))
                    .title("Import impossible")
                    .kind(MessageDialogKind::Error)
                    .blocking_show();
            }
        }
    }
    Ok(())
}

fn wants_import(app: &AppHandle) -> bool {
    app.dialog()
        .message(
            "Aucune base G-stock n'existe encore sur ce poste.\n\n\
             Pour retrouver vos données, importez une sauvegarde (gstock-AAAA-MM-JJ-….db) ou \
             votre ancienne base local.db. Fermez d'abord toute autre fenêtre G-stock ouverte \
             sur cette base.\n\n\
             Le fichier choisi est copié : l'original n'est pas modifié.",
        )
        .title("Bienvenue dans G-stock")
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Importer une base…".into(),
            "Commencer vide".into(),
        ))
        .blocking_show()
}

fn pick_database(app: &AppHandle) -> Option<PathBuf> {
    app.dialog()
        .file()
        .set_title("Choisir la base G-stock à importer")
        .add_filter("Base G-stock", &["db"])
        .blocking_pick_file()
        .and_then(|file| file.into_path().ok())
}

fn import_database(source: &Path, target: &Path) -> Result<()> {
    ensure_sqlite(source)?;
    // Une base ouverte en mode WAL garde ses dernières écritures dans le fichier `-wal` voisin.
    let source_wal = with_suffix(source, "-wal");
    if source_wal.exists() {
        fs::copy(&source_wal, with_suffix(target, "-wal"))
            .context("Copie du journal de la base impossible")?;
    }
    // Copie sous un nom provisoire puis renommage : une copie interrompue ne laisse pas de base
    // à moitié écrite que le serveur ouvrirait au prochain lancement.
    let partial = with_suffix(target, ".import");
    fs::copy(source, &partial)
        .with_context(|| format!("Copie de {} impossible", source.display()))?;
    fs::rename(&partial, target).context("Mise en place de la base importée impossible")?;
    Ok(())
}

/// Fichiers qui accompagnent une base SQLite ouverte.
const COMPANION_SUFFIXES: [&str; 3] = ["-wal", "-shm", "-journal"];

/// Remplace la base (serveur arrêté) par une sauvegarde. L'ancienne base est gardée à côté, sous
/// `gstock.db.avant-restauration-<date>` : rien n'est perdu. Renvoie son emplacement.
pub fn restore_database(backup: &Path, database: &Path) -> Result<PathBuf> {
    ensure_sqlite(backup)?;
    let kept = with_suffix(database, &format!(".avant-restauration-{}", timestamp()));
    let mut moved = Vec::new();
    for suffix in std::iter::once("").chain(COMPANION_SUFFIXES) {
        let current = with_suffix(database, suffix);
        if !current.exists() {
            continue;
        }
        let aside = with_suffix(&kept, suffix);
        if let Err(error) = fs::rename(&current, &aside) {
            put_back(&moved);
            return Err(error).context("La base actuelle n'a pas pu être mise de côté");
        }
        moved.push((current, aside));
    }
    if let Err(error) = import_database(backup, database) {
        put_back(&moved);
        return Err(error);
    }
    Ok(kept)
}

fn put_back(moved: &[(PathBuf, PathBuf)]) {
    for (original, aside) in moved {
        let _ = fs::rename(aside, original);
    }
}

/// Date et heure (UTC) au format `AAAA-MM-JJ-HHMMSS`, sans dépendance de calendrier.
fn timestamp() -> String {
    const SECONDS_PER_DAY: u64 = 86_400;
    let seconds = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.as_secs());
    let (days, time) = (seconds / SECONDS_PER_DAY, seconds % SECONDS_PER_DAY);
    // Conversion jours → date civile (algorithme de Howard Hinnant).
    let shifted = days + 719_468;
    let era = shifted / 146_097;
    let day_of_era = shifted % 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_index = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_index + 2) / 5 + 1;
    let month = if month_index < 10 {
        month_index + 3
    } else {
        month_index - 9
    };
    let year = year_of_era + era * 400 + u64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02}-{:02}{:02}{:02}",
        time / 3_600,
        time % 3_600 / 60,
        time % 60
    )
}

fn ensure_sqlite(path: &Path) -> Result<()> {
    let mut header = [0_u8; 16];
    File::open(path)
        .and_then(|mut file| file.read_exact(&mut header))
        .with_context(|| format!("Lecture de {} impossible", path.display()))?;
    if &header != SQLITE_HEADER {
        bail!("{} n'est pas une base G-stock.", path.display());
    }
    Ok(())
}

fn with_suffix(path: &Path, suffix: &str) -> PathBuf {
    let mut name = OsString::from(path.as_os_str());
    name.push(suffix);
    PathBuf::from(name)
}
