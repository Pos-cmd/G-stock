import { homedir } from "node:os";
import path from "node:path";

import { DEFAULT_EXCHANGE_RATES } from "@G-stock/core/currency";
import type { Executor } from "@G-stock/db";
import { settings } from "@G-stock/db/schema/settings";
import { sql } from "drizzle-orm";

import type { AppSettings } from "../schemas/settings";

type NumericSetting = {
  [K in keyof AppSettings]: AppSettings[K] extends number ? K : never;
}[keyof AppSettings];
type TextSetting = Exclude<keyof AppSettings, NumericSetting>;

const NUMERIC_KEYS = {
  fcfaPerUsd: "fcfa_per_usd",
  receivableAlertDays: "receivable_alert_days",
  receivableCriticalDays: "receivable_critical_days",
  receivableWarningDays: "receivable_warning_days",
  rmbPerUsd: "rmb_per_usd",
} as const satisfies Record<NumericSetting, string>;

const TEXT_KEYS = {
  companyAddress: "company_address",
  companyName: "company_name",
  companyPhone: "company_phone",
  documentsFolder: "documents_folder",
} as const satisfies Record<TextSetting, string>;

/** Dossier par défaut des PDF : Documents/G-stock de l'utilisateur. */
export const defaultDocumentsFolder = (): string => path.join(homedir(), "Documents", "G-stock");

const defaultSettings = (): AppSettings => ({
  companyAddress: "",
  companyName: "",
  companyPhone: "",
  documentsFolder: defaultDocumentsFolder(),
  fcfaPerUsd: DEFAULT_EXCHANGE_RATES.fcfaPerUsd,
  receivableAlertDays: 60,
  receivableCriticalDays: 90,
  receivableWarningDays: 30,
  rmbPerUsd: DEFAULT_EXCHANGE_RATES.rmbPerUsd,
});

const numericNames = Object.keys(NUMERIC_KEYS) as NumericSetting[];
const textNames = Object.keys(TEXT_KEYS) as TextSetting[];

export const getSettings = async (executor: Executor): Promise<AppSettings> => {
  const rows = await executor.select().from(settings);
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const result = defaultSettings();
  for (const name of numericNames) {
    const parsed = Number(values.get(NUMERIC_KEYS[name]));
    if (Number.isFinite(parsed) && parsed > 0) {
      result[name] = parsed;
    }
  }
  for (const name of textNames) {
    const value = values.get(TEXT_KEYS[name]);
    if (value) {
      result[name] = value;
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
    .values([
      ...numericNames.map((name) => ({
        key: NUMERIC_KEYS[name],
        value: String(input[name]),
      })),
      ...textNames.map((name) => ({
        key: TEXT_KEYS[name],
        value: input[name],
      })),
    ])
    .onConflictDoUpdate({
      set: { updatedAt: new Date(), value: sql`excluded.value` },
      target: settings.key,
    });
  return getSettings(executor);
};
