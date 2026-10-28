import type { FeeCurrency, PurchaseCurrency } from "@G-stock/core/enums";

/**
 * Formats des champs numériques (`format-options` de UInputNumber) : l'unité s'affiche dans le
 * champ (« 150 000 F CFA », « 7,2 ¥ », « 30 jours ») et la saisie reste libre, avec ou sans unité.
 */
type NumberFormat = Intl.NumberFormatOptions;

const currency = (code: string, maximumFractionDigits: number): NumberFormat => ({
  currency: code,
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits,
  minimumFractionDigits: 0,
  style: "currency",
});

/** Montant en francs CFA, sans centimes. */
export const FCFA_FORMAT = currency("XOF", 0);
/** Taux en francs CFA pour une devise (ex. 598,5 F CFA pour 1 $). */
export const FCFA_RATE_FORMAT = currency("XOF", 4);
export const RMB_FORMAT = currency("CNY", 2);
/** Taux en yuans pour 1 $ (ex. 7,2 ¥). */
export const RMB_RATE_FORMAT = currency("CNY", 4);
export const USD_FORMAT = currency("USD", 2);

/** Prix fournisseur dans la devise de la commande. */
export const supplierPriceFormat = (code: PurchaseCurrency): NumberFormat =>
  code === "usd" ? USD_FORMAT : RMB_FORMAT;

const FEE_FORMATS = { fcfa: FCFA_FORMAT, rmb: RMB_FORMAT, usd: USD_FORMAT } as const;
/** Frais saisi dans sa devise. */
export const feeAmountFormat = (code: FeeCurrency): NumberFormat => FEE_FORMATS[code];

/** Quantité : jusqu'au millième (mètres, tonnes, kilos…). */
export const QUANTITY_FORMAT: NumberFormat = { maximumFractionDigits: 3 };
/** Nombre entier (voyages, pièces, seuils). */
export const INTEGER_FORMAT: NumberFormat = { maximumFractionDigits: 0 };
export const DAYS_FORMAT: NumberFormat = { style: "unit", unit: "day", unitDisplay: "long" };
export const PERCENT_FORMAT: NumberFormat = {
  maximumFractionDigits: 2,
  style: "unit",
  unit: "percent",
};
