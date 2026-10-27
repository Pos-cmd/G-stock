import { uuidv7 } from "@G-stock/core/ids";
import { sql } from "drizzle-orm";
import { integer, text } from "drizzle-orm/sqlite-core";

const nowMs = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

/**
 * Identifiant UUID v7 des tables métier : unique sans compteur (aucun risque de doublon,
 * même entre plusieurs postes) et trié par date de création.
 */
export const id = () => text("id").primaryKey().$defaultFn(uuidv7);

/** Colonne qui pointe vers l'identifiant d'une autre table. */
export const ref = (name: string) => text(name);

/** Date stockée en millisecondes, comme les tables d'authentification. */
export const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });

export const createdAt = () => timestamp("created_at").default(nowMs).notNull();

export const updatedAt = () =>
  timestamp("updated_at")
    .default(nowMs)
    .$onUpdate(() => new Date())
    .notNull();
