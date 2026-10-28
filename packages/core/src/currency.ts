import type { PurchaseCurrency } from "./enums";

export interface ExchangeRates {
  /** Yuans pour 1 USD (ex : 7,2) */
  rmbPerUsd: number;
  /** FCFA pour 1 USD (ex : 598) */
  fcfaPerUsd: number;
}

export const DEFAULT_EXCHANGE_RATES = {
  fcfaPerUsd: 598,
  rmbPerUsd: 7.2,
} as const satisfies ExchangeRates;

const assertValidRates = (rates: ExchangeRates): void => {
  if (rates.rmbPerUsd <= 0 || rates.fcfaPerUsd <= 0) {
    throw new Error("Les taux de change doivent être strictement positifs");
  }
};

/** Le FCFA n'a pas de subdivision : tout montant stocké est un entier. */
export const roundFcfa = (amount: number): number => Math.round(amount);

export const rmbToUsd = (amountRmb: number, rates: ExchangeRates): number => {
  assertValidRates(rates);
  return amountRmb / rates.rmbPerUsd;
};

export const usdToFcfa = (amountUsd: number, rates: ExchangeRates): number => {
  assertValidRates(rates);
  return amountUsd * rates.fcfaPerUsd;
};

/** RMB → USD → FCFA, arrondi au FCFA. */
export const rmbToFcfa = (amountRmb: number, rates: ExchangeRates): number =>
  roundFcfa(usdToFcfa(rmbToUsd(amountRmb, rates), rates));

/** FCFA pour 1 unité de la devise d'achat : l'USD directement, le RMB via l'USD. */
export const fcfaPerUnit = (currency: PurchaseCurrency, rates: ExchangeRates): number => {
  assertValidRates(rates);
  return currency === "usd" ? rates.fcfaPerUsd : rates.fcfaPerUsd / rates.rmbPerUsd;
};

export const purchaseAmountToUsd = (
  amount: number,
  currency: PurchaseCurrency,
  rates: ExchangeRates,
): number => (currency === "usd" ? amount : rmbToUsd(amount, rates));

/** Prix fournisseur en FCFA, arrondi : USD → FCFA directement, RMB → USD → FCFA. */
export const purchaseAmountToFcfa = (
  amount: number,
  currency: PurchaseCurrency,
  rates: ExchangeRates,
): number => (currency === "usd" ? roundFcfa(usdToFcfa(amount, rates)) : rmbToFcfa(amount, rates));
