//! Secret de signature des sessions (`BETTER_AUTH_SECRET`), propre à chaque poste.
//!
//! Généré au premier lancement et rangé dans le Gestionnaire d'identification de Windows plutôt
//! que dans un fichier. S'il disparaît (nouveau profil Windows), un nouveau secret est créé : les
//! sessions ouvertes sont fermées, mais aucune donnée n'est perdue.

use anyhow::{Context, Result};
use keyring::{Entry, Error as KeyringError};

const SERVICE: &str = "G-stock";
const ACCOUNT: &str = "better-auth-secret";
const SECRET_BYTES: usize = 32;

pub fn load_or_create() -> Result<String> {
    let entry = Entry::new(SERVICE, ACCOUNT)
        .context("Accès au Gestionnaire d'identification de Windows impossible")?;
    match entry.get_password() {
        Ok(secret) => Ok(secret),
        Err(KeyringError::NoEntry) => {
            let secret = generate()?;
            entry
                .set_password(&secret)
                .context("Enregistrement du secret de session impossible")?;
            Ok(secret)
        }
        Err(error) => Err(error).context("Lecture du secret de session impossible"),
    }
}

fn generate() -> Result<String> {
    let mut bytes = [0_u8; SECRET_BYTES];
    getrandom::fill(&mut bytes).context("Génération du secret de session impossible")?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}
