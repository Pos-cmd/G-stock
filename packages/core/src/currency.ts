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
