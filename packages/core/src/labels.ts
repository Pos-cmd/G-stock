import type {
  AllocationMethod,
  FeeCurrency,
  LotSource,
  MovementType,
  PricingBasis,
  PurchaseOrderStatus,
  StockStatus,
} from "./enums";

export const SUGGESTED_UNITS = [
  "unité",
  "pièce",
  "rouleau",
  "kg",
  "tonne",
  "mètre",
  "carton",
  "paquet",
  "sac",
  "lot",
] as const;

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  adjustment: "Ajustement",
  in: "Entrée",
  out: "Sortie",
};

export const LOT_SOURCE_LABELS: Record<LotSource, string> = {
  adjustment: "Ajustement",
  initial: "Entrée manuelle",
  purchase: "Commande fournisseur",
};

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  low: "Stock bas",
  ok: "En stock",
  out: "Rupture",
};

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  cancelled: "Annulée",
  draft: "Brouillon",
  in_transit: "En transit",
  ordered: "Commandée",
  received: "Reçue",
};

export const ALLOCATION_METHOD_LABELS: Record<AllocationMethod, string> = {
  equal: "Parts égales",
  proportional: "Au prorata des voyages",
  value: "Au prorata de la valeur",
  weight: "Au prorata du poids",
};

export const FEE_CURRENCY_LABELS: Record<FeeCurrency, string> = {
  fcfa: "FCFA",
  rmb: "RMB",
  usd: "USD",
};

/** Libellés proposés pour les frais de réception ; la saisie reste libre. */
export const SUGGESTED_FEE_LABELS = [
  "Fret maritime",
  "Douane",
  "Transit / manutention",
  "Frais de port",
  "Transport local",
  "Autres frais",
];

export const PRICING_BASIS_LABELS: Record<PricingBasis, string> = {
  unit: "/ unité",
  weight: "/ tonne",
};
