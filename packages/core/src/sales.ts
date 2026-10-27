import { roundFcfa } from "./currency";
import type { ReceivableLevel } from "./enums";

/** Montant d'une ligne de vente : quantité (éventuellement décimale) × prix, arrondi au FCFA. */
export const lineAmountFcfa = (qty: number, unitPriceFcfa: number): number =>
  roundFcfa(qty * unitPriceFcfa);

export interface DebtSale {
  id: string;
  date: Date;
  /** Montant net : total de la vente moins ses remises. */
  netFcfa: number;
}

export interface DebtPayment {
  saleId?: string | null;
  amountFcfa: number;
}

export interface SaleSettlement {
  paidFcfa: number;
  dueFcfa: number;
}

export interface PaymentAllocation {
  sales: Map<string, SaleSettlement>;
  /** Somme des restes dus. */
  totalDueFcfa: number;
  /** Trop-perçu (paiements au-delà des ventes, ou remise accordée après paiement). */
  creditFcfa: number;
  /** Date de la plus ancienne vente pas entièrement payée. */
  oldestUnpaidDate: Date | null;
}

/**
 * Affecte les paiements d'un client à ses ventes : un paiement rattaché à une vente la règle en
 * priorité ; le reste (paiements libres, excédents) solde les ventes les plus anciennes d'abord.
 */
export const allocatePayments = (
  sales: readonly DebtSale[],
  payments: readonly DebtPayment[],
): PaymentAllocation => {
  const ordered = sales.toSorted(
    (a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id),
  );
  const settlements = new Map<string, SaleSettlement>(
    ordered.map((sale) => [sale.id, { dueFcfa: Math.max(sale.netFcfa, 0), paidFcfa: 0 }]),
  );

  let pool = 0;
  for (const payment of payments) {
    const target = payment.saleId ? settlements.get(payment.saleId) : undefined;
    if (!target) {
      pool += payment.amountFcfa;
      continue;
    }
    const applied = Math.min(payment.amountFcfa, target.dueFcfa);
    target.paidFcfa += applied;
    target.dueFcfa -= applied;
    pool += payment.amountFcfa - applied;
  }

  let oldestUnpaidDate: Date | null = null;
  let totalDueFcfa = 0;
  for (const sale of ordered) {
    const settlement = settlements.get(sale.id);
    if (!settlement) {
      continue;
    }
    const applied = Math.min(pool, settlement.dueFcfa);
    settlement.paidFcfa += applied;
    settlement.dueFcfa -= applied;
    pool -= applied;
    totalDueFcfa += settlement.dueFcfa;
    if (settlement.dueFcfa > 0 && !oldestUnpaidDate) {
      oldestUnpaidDate = sale.date;
    }
  }

  return {
    creditFcfa: pool,
    oldestUnpaidDate,
    sales: settlements,
    totalDueFcfa,
  };
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Nombre de jours entiers écoulés entre deux dates. */
export const daysBetween = (from: Date, to: Date): number =>
  Math.max(Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY), 0);

export interface ReceivableThresholds {
  receivableWarningDays: number;
  receivableAlertDays: number;
  receivableCriticalDays: number;
}

export const receivableLevel = (
  days: number,
  thresholds: ReceivableThresholds,
): ReceivableLevel => {
  if (days >= thresholds.receivableCriticalDays) {
    return "critical";
  }
  if (days >= thresholds.receivableAlertDays) {
    return "alert";
  }
  if (days >= thresholds.receivableWarningDays) {
    return "warning";
  }
  return "current";
};
