import { fcfaPerUnit, roundFcfa } from "./currency";
import type { ExchangeRates } from "./currency";
import type { PurchaseCurrency } from "./enums";

/** En deçà, le reste à payer est un arrondi de conversion : la commande est soldée. */
const AMOUNT_TOLERANCE = 0.01;

/**
 * Un versement au fournisseur : envoyé en FCFA, converti dans la devise de la commande (RMB ou
 * USD) au taux du jour.
 */
export interface SupplierPaymentEntry {
  amountFcfa: number;
  /** FCFA pour 1 unité de la devise de la commande, obtenu ce jour-là ; vide = taux de la commande. */
  fcfaRate?: number | null;
}

export interface SupplierPaymentLine {
  amountFcfa: number;
  fcfaRate: number;
  /** Montant reçu par le fournisseur, dans la devise de la commande. */
  amount: number;
  usesOrderRate: boolean;
}

/** Montants en devise (`…Amount`) : dans la devise de la commande, RMB ou USD. */
export interface SupplierPaymentSummary {
  currency: PurchaseCurrency;
  /** Taux de la commande : FCFA pour 1 unité de la devise (le RMB passe par l'USD). */
  orderFcfaRate: number;
  goodsAmount: number;
  lines: SupplierPaymentLine[];
  paidFcfa: number;
  paidAmount: number;
  /** Taux moyen réellement obtenu sur les versements, null sans versement. */
  averageFcfaRate: number | null;
  remainingAmount: number;
  /** Reste à payer converti au taux de la commande. */
  remainingFcfa: number;
  /** Payé au-delà du prix de la marchandise : avance chez le fournisseur. */
  overpaidAmount: number;
  isPaid: boolean;
  /**
   * Coût réel de la marchandise : les versements à leur taux, le reste au taux de la commande.
   * Une avance n'est pas comptée : seule la part qui paie la marchandise entre dans le coût.
   */
  goodsFcfa: number;
}

export interface SupplierPaymentsInput {
  /** Valeur de la marchandise dans la devise de la commande. */
  goodsAmount: number;
  currency: PurchaseCurrency;
  rates: ExchangeRates;
  payments: readonly SupplierPaymentEntry[];
}

/**
 * Paiement d'une commande en plusieurs tranches : chaque versement est noté en FCFA, avec le
 * taux obtenu ce jour-là (ou celui de la commande à défaut). La marchandise est payée dans la
 * devise de la commande.
 */
export const summarizeSupplierPayments = (input: SupplierPaymentsInput): SupplierPaymentSummary => {
  const orderRate = fcfaPerUnit(input.currency, input.rates);
  const lines = input.payments.map((payment): SupplierPaymentLine => {
    const fcfaRate = payment.fcfaRate ?? orderRate;
    return {
      amount: payment.amountFcfa / fcfaRate,
      amountFcfa: payment.amountFcfa,
      fcfaRate,
      usesOrderRate: !payment.fcfaRate,
    };
  });

  const paidFcfa = lines.reduce((sum, line) => sum + line.amountFcfa, 0);
  const paidAmount = lines.reduce((sum, line) => sum + line.amount, 0);
  const difference = input.goodsAmount - paidAmount;
  const remainingAmount = difference > AMOUNT_TOLERANCE ? difference : 0;
  const overpaidAmount = difference < -AMOUNT_TOLERANCE ? -difference : 0;

  const goodsFcfa =
    overpaidAmount > 0
      ? roundFcfa((paidFcfa * input.goodsAmount) / paidAmount)
      : roundFcfa(paidFcfa + remainingAmount * orderRate);

  return {
    averageFcfaRate: paidAmount > 0 ? paidFcfa / paidAmount : null,
    currency: input.currency,
    goodsAmount: input.goodsAmount,
    goodsFcfa,
    isPaid: remainingAmount === 0,
    lines,
    orderFcfaRate: orderRate,
    overpaidAmount,
    paidAmount,
    paidFcfa,
    remainingAmount,
    remainingFcfa: roundFcfa(remainingAmount * orderRate),
  };
};

/**
 * Coût réel de la marchandise à passer au calcul du prix de revient, ou `undefined` sans
 * versement : la conversion aux taux de la commande s'applique alors ligne par ligne.
 */
export const paidGoodsFcfa = (input: SupplierPaymentsInput): number | undefined =>
  input.payments.length === 0 ? undefined : summarizeSupplierPayments(input).goodsFcfa;
