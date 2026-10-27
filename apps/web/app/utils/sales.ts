import type { SaleStatus } from "@G-stock/core/enums";

export const ALL = "all";

/** Filtres de l'historique des ventes, tels que saisis à l'écran. */
export interface SalesFilterState {
  search: string;
  from: string;
  to: string;
  productId: number | undefined;
  status: SaleStatus | typeof ALL;
  paymentState: "paid" | "due" | typeof ALL;
}

export const emptySalesFilters = (): SalesFilterState => ({
  from: "",
  paymentState: ALL,
  productId: undefined,
  search: "",
  status: ALL,
  to: "",
});

/** Bornes incluses : du début du premier jour à la fin du dernier. */
export const periodBounds = (from: string, to: string) => ({
  from: from ? new Date(`${from}T00:00:00`) : null,
  to: to ? new Date(`${to}T23:59:59.999`) : null,
});

export const toSaleListInput = (state: SalesFilterState, customerId?: number) => ({
  ...periodBounds(state.from, state.to),
  customerId: customerId ?? null,
  paymentState: state.paymentState === ALL ? null : state.paymentState,
  productId: state.productId ?? null,
  search: state.search || null,
  status: state.status === ALL ? null : state.status,
});

/** Raccourcis de période : aujourd'hui, ce mois, 30 derniers jours, cette année. */
export const PERIOD_PRESETS = [
  { label: "Aujourd'hui", range: (now: Date) => [now, now] },
  {
    label: "Ce mois",
    range: (now: Date) => [new Date(now.getFullYear(), now.getMonth(), 1), now],
  },
  {
    label: "30 jours",
    range: (now: Date) => [new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29), now],
  },
  { label: "Cette année", range: (now: Date) => [new Date(now.getFullYear(), 0, 1), now] },
] as const satisfies readonly { label: string; range: (now: Date) => [Date, Date] }[];

const percentFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  style: "percent",
});

/** Taux de marge sur le prix de vente, ou null si le montant est nul. */
export const formatMarginRate = (marginFcfa: number, amountFcfa: number): string | null =>
  amountFcfa > 0 ? percentFormatter.format(marginFcfa / amountFcfa) : null;
