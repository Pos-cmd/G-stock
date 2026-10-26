import type { Session } from "@G-stock/auth";
import type { Database } from "@G-stock/db";

export type Context = {
  session: Session | null;
  db: Database;
};
