import { createReadStream } from "node:fs";

import { getBackupFile } from "@G-stock/api/services/backups";
import { ORPCError } from "@orpc/server";

import { createContext } from "../../../src/context";

/** Télécharge une sauvegarde du dossier configuré (pour la copier ailleurs, sur une clé…). */
export default defineEventHandler(async (event) => {
  await ensureDatabaseReady();
  const context = await createContext({ headers: toWebRequest(event).headers });
  if (!context.session) {
    throw createError({ statusCode: 401, statusMessage: "Connexion requise" });
  }

  const name = getRouterParam(event, "name") ?? "";
  let filePath;
  try {
    filePath = await getBackupFile(context.db, name);
  } catch (error) {
    if (error instanceof ORPCError) {
      throw createError({ statusCode: error.status, statusMessage: error.message });
    }
    throw error;
  }

  setResponseHeaders(event, {
    "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="${name}"`,
    "Content-Type": "application/vnd.sqlite3",
  });
  return sendStream(event, createReadStream(filePath));
});
