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

/** Paiement identifié, pour retrouver ce qu'il règle. */
export interface CoveragePayment extends DebtPayment {
  id: string;
}

/** Part d'un paiement qui revient à une vente. */
export interface PaymentCoverage {
  saleId: string;
  amountFcfa: number;
}

/**
 * Quelles ventes chaque paiement règle, avec les mêmes règles que `allocatePayments` : la vente
 * rattachée d'abord, puis les plus anciennes. Les totaux par vente sont donc identiques : cette
 * fonction ne sert qu'à l'affichage (« ce jour-là, le client a soldé ces ventes »).
 * Les paiements doivent être donnés dans l'ordre chronologique.
 */
export const allocatePaymentCoverage = (
  sales: readonly DebtSale[],
  payments: readonly CoveragePayment[]
): Map<string, PaymentCoverage[]> => {
  const ordered = sales.toSorted(
    (a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id)
  );
  const due = new Map(
    ordered.map((sale) => [sale.id, Math.max(sale.netFcfa, 0)])
  );
  const coverage = new Map<string, PaymentCoverage[]>(
    payments.map((payment) => [payment.id, []])
  );

  // 1. Une vente choisie au moment du paiement est réglée en priorité.
  const pool: { amountFcfa: number; id: string }[] = [];
  for (const payment of payments) {
    let left = payment.amountFcfa;
    const targetDue = payment.saleId ? due.get(payment.saleId) : undefined;
    if (payment.saleId && targetDue !== undefined) {
      const applied = Math.min(left, targetDue);
      if (applied > 0) {
        due.set(payment.saleId, targetDue - applied);
        coverage
          .get(payment.id)
          ?.push({ amountFcfa: applied, saleId: payment.saleId });
        left -= applied;
      }
    }
    if (left > 0) {
      pool.push({ amountFcfa: left, id: payment.id });
    }
  }

  // 2. Le reste solde les ventes les plus anciennes, dans l'ordre des paiements.
  let cursor = 0;
  for (const sale of ordered) {
    let remaining = due.get(sale.id) ?? 0;
    while (remaining > 0 && cursor < pool.length) {
      const entry = pool[cursor];
      if (!entry) {
        break;
      }
      const applied = Math.min(entry.amountFcfa, remaining);
      if (applied > 0) {
        coverage.get(entry.id)?.push({ amountFcfa: applied, saleId: sale.id });
        entry.amountFcfa -= applied;
        remaining -= applied;
        due.set(sale.id, remaining);
      }
      if (entry.amountFcfa <= 0) {
        cursor += 1;
      }
    }
  }

  return coverage;
};

/**
 * Affecte les paiements d'un client à ses ventes : un paiement rattaché à une vente la règle en
 * priorité ; le reste (paiements libres, excédents) solde les ventes les plus anciennes d'abord.
 */
export const allocatePayments = (
  sales: readonly DebtSale[],
  payments: readonly DebtPayment[]
): PaymentAllocation => {
  const ordered = sales.toSorted(
    (a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id)
  );
  const settlements = new Map<string, SaleSettlement>(
    ordered.map((sale) => [
      sale.id,
      { dueFcfa: Math.max(sale.netFcfa, 0), paidFcfa: 0 },
    ])
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
  thresholds: ReceivableThresholds
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
