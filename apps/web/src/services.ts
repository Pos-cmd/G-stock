import { createAuth } from "@G-stock/auth";
import { createDb } from "@G-stock/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
