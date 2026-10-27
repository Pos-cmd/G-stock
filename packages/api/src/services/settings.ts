import { DEFAULT_EXCHANGE_RATES } from "@G-stock/core/currency";
import type { Executor } from "@G-stock/db";
import { settings } from "@G-stock/db/schema/settings";
import { sql } from "drizzle-orm";

import type { AppSettings } from "../schemas/settings";

const SETTING_KEYS = {
  fcfaPerUsd: "fcfa_per_usd",
  receivableAlertDays: "receivable_alert_days",
  receivableCriticalDays: "receivable_critical_days",
  receivableWarningDays: "receivable_warning_days",
  rmbPerUsd: "rmb_per_usd",
} as const satisfies Record<keyof AppSettings, string>;

const DEFAULT_SETTINGS: AppSettings = {
  fcfaPerUsd: DEFAULT_EXCHANGE_RATES.fcfaPerUsd,
  receivableAlertDays: 60,
  receivableCriticalDays: 90,
  receivableWarningDays: 30,
  rmbPerUsd: DEFAULT_EXCHANGE_RATES.rmbPerUsd,
};

const settingNames = Object.keys(SETTING_KEYS) as (keyof AppSettings)[];

export const getSettings = async (executor: Executor): Promise<AppSettings> => {
  const rows = await executor.select().from(settings);
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const result = { ...DEFAULT_SETTINGS };
  for (const name of settingNames) {
    const parsed = Number(values.get(SETTING_KEYS[name]));
    if (Number.isFinite(parsed) && parsed > 0) {
      result[name] = parsed;
    }
  }
  return result;
};

export const updateSettings = async (
  executor: Executor,
  input: AppSettings,
): Promise<AppSettings> => {
  await executor
    .insert(settings)
    .values(
      settingNames.map((name) => ({
        key: SETTING_KEYS[name],
        value: String(input[name]),
      })),
    )
    .onConflictDoUpdate({
      set: { updatedAt: new Date(), value: sql`excluded.value` },
      target: settings.key,
    });
  return getSettings(executor);
};
