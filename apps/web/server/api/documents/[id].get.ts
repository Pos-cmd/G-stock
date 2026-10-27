import { createReadStream } from "node:fs";

import { getDocumentFile } from "@G-stock/api/services/documents";
import { ORPCError } from "@orpc/server";

import { createContext } from "../../../src/context";

/** Sert le PDF d'un document : affiché dans le navigateur, ou téléchargé avec ?telecharger. */
export default defineEventHandler(async (event) => {
  await ensureDatabaseReady();
  const context = await createContext({ headers: toWebRequest(event).headers });
  if (!context.session) {
    throw createError({ statusCode: 401, statusMessage: "Connexion requise" });
  }

  const id = Number(getRouterParam(event, "id"));
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: "Document invalide" });
  }

  let file;
  try {
    file = await getDocumentFile(context.db, id);
  } catch (error) {
    if (error instanceof ORPCError) {
      throw createError({ statusCode: 404, statusMessage: error.message });
    }
    throw error;
  }

  const disposition = getQuery(event).telecharger === undefined ? "inline" : "attachment";
  setResponseHeaders(event, {
    "Cache-Control": "no-store",
    "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    "Content-Type": "application/pdf",
  });
  return sendStream(event, createReadStream(file.filePath));
});
