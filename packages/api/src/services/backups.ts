import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { uuidv7 } from "@G-stock/core/ids";
import type { Executor } from "@G-stock/db";
import { ORPCError } from "@orpc/server";
import { sql } from "drizzle-orm";

import { detectDriveFolder, getSettings } from "./settings";

/** Une sauvegarde automatique par jour. */
export const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

const BACKUP_FILE =
  /^gstock-(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})-(?<hours>\d{2})(?<minutes>\d{2})(?<seconds>\d{2})\.db$/u;

const pad = (value: number): string => String(value).padStart(2, "0");

/** Nom horodaté (heure locale) : l'ordre alphabétique est l'ordre chronologique. */
export const backupFileName = (date: Date): string =>
  `gstock-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}.db`;

/** Date d'une sauvegarde d'après son nom, ou null si le fichier n'en est pas une. */
export const parseBackupFileName = (fileName: string): Date | null => {
  const match = BACKUP_FILE.exec(fileName);
  if (!match) {
    return null;
  }
  const { year, month, day, hours, minutes, seconds } = match.groups ?? {};
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds),
  );
};

export interface BackupFile {
  fileName: string;
  createdAt: Date;
  sizeBytes: number;
}

/** Sauvegardes présentes dans le dossier, la plus récente d'abord. */
export const listBackups = async (folder: string): Promise<BackupFile[]> => {
  let names: string[];
  try {
    names = await readdir(folder);
  } catch {
    return [];
  }
  const backups = await Promise.all(
    names.map(async (fileName) => {
      const createdAt = parseBackupFileName(fileName);
      if (!createdAt) {
        return null;
      }
      const info = await stat(path.join(folder, fileName));
      return { createdAt, fileName, sizeBytes: info.size };
    }),
  );
  return backups
    .filter((backup): backup is BackupFile => backup !== null)
    .toSorted((a, b) => b.fileName.localeCompare(a.fileName));
};

/** Supprime les sauvegardes au-delà des `keep` plus récentes (uniquement les fichiers G-stock). */
const pruneBackups = async (folder: string, keep: number): Promise<void> => {
  const backups = await listBackups(folder);
  await Promise.all(
    backups.slice(keep).map((backup) => rm(path.join(folder, backup.fileName), { force: true })),
  );
};

const sqlString = (value: string): string => `'${value.replaceAll("'", "''")}'`;

export interface BackupResult {
  fileName: string;
  folder: string;
}

/**
 * Copie cohérente de la base (VACUUM INTO), même pendant que l'application tourne.
 * La copie est d'abord écrite dans le dossier temporaire puis déposée d'un coup dans le dossier
 * de sauvegarde : Google Drive ne synchronise jamais un fichier à moitié écrit.
 */
export const createBackup = async (executor: Executor, now = new Date()): Promise<BackupResult> => {
  const { backupFolder: folder, backupKeep } = await getSettings(executor);
  const fileName = backupFileName(now);
  const temporary = path.join(tmpdir(), `gstock-sauvegarde-${uuidv7()}.db`);
  try {
    await mkdir(folder, { recursive: true });
    await executor.run(sql.raw(`VACUUM INTO ${sqlString(temporary)}`));
    await copyFile(temporary, path.join(folder, fileName));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: `Sauvegarde impossible dans « ${folder} » : ${detail}`,
    });
  } finally {
    await rm(temporary, { force: true });
  }
  await pruneBackups(folder, backupKeep);
  return { fileName, folder };
};

interface BackupRunState {
  lastError: { at: Date; message: string } | null;
  lastSuccessAt: Date | null;
}

/** État de la dernière tentative, en mémoire du processus serveur. */
const runState: BackupRunState = { lastError: null, lastSuccessAt: null };

const recordAttempt = async (attempt: () => Promise<BackupResult>): Promise<BackupResult> => {
  try {
    const result = await attempt();
    runState.lastError = null;
    runState.lastSuccessAt = new Date();
    return result;
  } catch (error) {
    runState.lastError = {
      at: new Date(),
      message: error instanceof Error ? error.message : String(error),
    };
    throw error;
  }
};

/** Sauvegarde demandée depuis l'écran Paramètres. */
export const backupNow = (executor: Executor): Promise<BackupResult> =>
  recordAttempt(() => createBackup(executor));

/**
 * Sauvegarde automatique : seulement si la plus récente du dossier a plus de 24 h. Vérifiée
 * régulièrement, elle rattrape un PC resté éteint ou un Drive momentanément indisponible.
 */
export const runAutomaticBackup = async (
  executor: Executor,
  now = new Date(),
): Promise<BackupResult | null> => {
  const { backupFolder } = await getSettings(executor);
  const [latest] = await listBackups(backupFolder);
  if (latest && now.getTime() - latest.createdAt.getTime() < BACKUP_INTERVAL_MS) {
    return null;
  }
  return recordAttempt(() => createBackup(executor, now));
};

export const getBackupStatus = async (executor: Executor) => {
  const { backupFolder, backupKeep } = await getSettings(executor);
  const backups = await listBackups(backupFolder);
  return {
    backups,
    driveFolder: detectDriveFolder(),
    folder: backupFolder,
    keep: backupKeep,
    lastError: runState.lastError,
    latestAt: backups[0]?.createdAt ?? null,
  };
};

/** Chemin d'une sauvegarde du dossier courant, pour la télécharger. */
export const getBackupFile = async (executor: Executor, fileName: string): Promise<string> => {
  if (!parseBackupFileName(fileName)) {
    throw new ORPCError("BAD_REQUEST", { message: "Sauvegarde invalide" });
  }
  const { backupFolder } = await getSettings(executor);
  const filePath = path.join(backupFolder, fileName);
  if (!existsSync(filePath)) {
    throw new ORPCError("NOT_FOUND", { message: "Sauvegarde introuvable" });
  }
  return filePath;
};
