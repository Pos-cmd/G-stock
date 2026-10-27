import { sql } from "drizzle-orm";
import { integer } from "drizzle-orm/sqlite-core";

const nowMs = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

/** Identifiant entier auto-incrémenté des tables métier. */
export const id = () => integer("id").primaryKey({ autoIncrement: true });

/** Date stockée en millisecondes, comme les tables d'authentification. */
export const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });

export const createdAt = () => timestamp("created_at").default(nowMs).notNull();

export const updatedAt = () =>
  timestamp("updated_at")
    .default(nowMs)
    .$onUpdate(() => new Date())
    .notNull();
