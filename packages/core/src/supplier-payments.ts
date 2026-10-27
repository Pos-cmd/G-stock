import { roundFcfa } from "./currency";
import type { ExchangeRates } from "./currency";

/** En deçà, le reste à payer est un arrondi de conversion : la commande est soldée. */
const RMB_TOLERANCE = 0.01;

/** Un versement au fournisseur : envoyé en FCFA, converti en RMB au taux du jour. */
export interface SupplierPaymentEntry {
  amountFcfa: number;
  /** FCFA pour 1 RMB obtenu ce jour-là ; vide = taux de la commande. */
  fcfaPerRmb?: number | null;
}

export interface SupplierPaymentLine {
  amountFcfa: number;
  fcfaPerRmb: number;
  rmb: number;
  usesOrderRate: boolean;
}

export interface SupplierPaymentSummary {
  /** Taux de la commande : FCFA pour 1 RMB, via l'USD. */
  orderFcfaPerRmb: number;
  goodsRmb: number;
  lines: SupplierPaymentLine[];
  paidFcfa: number;
  paidRmb: number;
  /** Taux moyen réellement obtenu sur les versements, null sans versement. */
  averageFcfaPerRmb: number | null;
  remainingRmb: number;
  /** Reste à payer converti au taux de la commande. */
  remainingFcfa: number;
  /** Payé au-delà du prix de la marchandise : avance chez le fournisseur. */
  overpaidRmb: number;
  isPaid: boolean;
  /**
   * Coût réel de la marchandise : les versements à leur taux, le reste au taux de la commande.
   * Une avance n'est pas comptée : seule la part qui paie la marchandise entre dans le coût.
   */
  goodsFcfa: number;
}

/** FCFA pour 1 RMB aux taux de la commande (RMB → USD → FCFA). */
export const orderFcfaPerRmb = (rates: ExchangeRates): number => rates.fcfaPerUsd / rates.rmbPerUsd;

/**
 * Paiement d'une commande en plusieurs tranches : chaque versement est noté en FCFA, avec le
 * taux obtenu ce jour-là (ou celui de la commande à défaut). La marchandise est payée en RMB.
 */
export const summarizeSupplierPayments = (input: {
  goodsRmb: number;
  rates: ExchangeRates;
  payments: readonly SupplierPaymentEntry[];
}): SupplierPaymentSummary => {
  const orderRate = orderFcfaPerRmb(input.rates);
  const lines = input.payments.map((payment): SupplierPaymentLine => {
    const fcfaPerRmb = payment.fcfaPerRmb ?? orderRate;
    return {
      amountFcfa: payment.amountFcfa,
      fcfaPerRmb,
      rmb: payment.amountFcfa / fcfaPerRmb,
      usesOrderRate: !payment.fcfaPerRmb,
    };
  });

  const paidFcfa = lines.reduce((sum, line) => sum + line.amountFcfa, 0);
  const paidRmb = lines.reduce((sum, line) => sum + line.rmb, 0);
  const difference = input.goodsRmb - paidRmb;
  const remainingRmb = difference > RMB_TOLERANCE ? difference : 0;
  const overpaidRmb = difference < -RMB_TOLERANCE ? -difference : 0;

  const goodsFcfa =
    overpaidRmb > 0
      ? roundFcfa((paidFcfa * input.goodsRmb) / paidRmb)
      : roundFcfa(paidFcfa + remainingRmb * orderRate);

  return {
    averageFcfaPerRmb: paidRmb > 0 ? paidFcfa / paidRmb : null,
    goodsFcfa,
    goodsRmb: input.goodsRmb,
    isPaid: remainingRmb === 0,
    lines,
    orderFcfaPerRmb: orderRate,
    overpaidRmb,
    paidFcfa,
    paidRmb,
    remainingFcfa: roundFcfa(remainingRmb * orderRate),
    remainingRmb,
  };
};

/**
 * Coût réel de la marchandise à passer au calcul du prix de revient, ou `undefined` sans
 * versement : la conversion aux taux de la commande s'applique alors ligne par ligne.
 */
export const paidGoodsFcfa = (input: {
  goodsRmb: number;
  rates: ExchangeRates;
  payments: readonly SupplierPaymentEntry[];
}): number | undefined =>
  input.payments.length === 0 ? undefined : summarizeSupplierPayments(input).goodsFcfa;
