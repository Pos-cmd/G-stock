// Valeurs des colonnes énumérées, partagées par le schéma, l'API et l'UI.

export const MOVEMENT_TYPES = ["in", "out", "adjustment"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const LOT_SOURCES = ["purchase", "initial", "adjustment"] as const;
export type LotSource = (typeof LOT_SOURCES)[number];

export const MOVEMENT_REFERENCE_TYPES = ["purchase_order", "sale", "manual"] as const;
export type MovementReferenceType = (typeof MOVEMENT_REFERENCE_TYPES)[number];

export const STOCK_STATUSES = ["ok", "low", "out"] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

export const PURCHASE_ORDER_STATUSES = [
  "draft",
  "ordered",
  "in_transit",
  "received",
  "cancelled",
] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export const ALLOCATION_METHODS = ["proportional", "equal", "weight", "value"] as const;
export type AllocationMethod = (typeof ALLOCATION_METHODS)[number];

/** Base du prix d'achat d'une ligne : par unité de stock, ou à la tonne. */
export const PRICING_BASES = ["unit", "weight"] as const;
export type PricingBasis = (typeof PRICING_BASES)[number];

/** Devise dans laquelle un frais d'approche a été payé ; il est converti en FCFA. */
export const FEE_CURRENCIES = ["fcfa", "usd", "rmb"] as const;
export type FeeCurrency = (typeof FEE_CURRENCIES)[number];

export const PAYMENT_TYPES = ["cash", "credit"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_METHODS = ["cash", "mobile_money", "bank"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const DOCUMENT_TYPES = ["receipt", "cost_sheet", "simulation", "purchase_order"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
