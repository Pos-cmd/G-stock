import type { LotSource, MovementType, StockStatus } from "./enums";

export const SUGGESTED_UNITS = [
  "unité",
  "pièce",
  "rouleau",
  "kg",
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
