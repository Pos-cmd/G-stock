import type { Context as ApiContext } from "@G-stock/api/context";

import { db } from "./services";
import { auth } from "./services";

export type CreateContextOptions = {
  headers: Headers;
};

export async function createContext({ headers }: CreateContextOptions): Promise<ApiContext> {
  const session = await auth.api.getSession({ headers });
  return {
    db,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
