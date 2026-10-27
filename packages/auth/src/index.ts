import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import type { Database } from "@G-stock/db";
import * as schema from "@G-stock/db/schema/auth";
import { betterAuth } from "better-auth";

export type AuthConfig = {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  /** Adresses supplémentaires (ex. Tailscale), séparées par des virgules. */
  TRUSTED_ORIGINS?: string | undefined;
};

const TRAILING_SLASHES = /\/+$/u;

/** Adresse principale et adresses supplémentaires d'où l'on peut se connecter. */
export const trustedOriginsOf = (env: AuthConfig): string[] => [
  env.BETTER_AUTH_URL,
  ...(env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(TRAILING_SLASHES, ""))
    .filter(Boolean),
];

export function createAuth(env: AuthConfig, database: Database) {
  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "sqlite",
      schema,
    }),
    trustedOrigins: trustedOriginsOf(env),
    emailAndPassword: { enabled: true },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    plugins: [],
  });
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
