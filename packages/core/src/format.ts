const LOCALE = "fr-FR";

const fcfaFormatter = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 0,
});
const decimalFormatter = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});
const qtyFormatter = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 3,
});
const dateFormatter = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: "medium",
  timeStyle: "short",
});

export const formatFcfa = (amount: number): string => `${fcfaFormatter.format(amount)} FCFA`;

export const formatRmb = (amount: number): string => `${decimalFormatter.format(amount)} RMB`;

export const formatUsd = (amount: number): string => `${decimalFormatter.format(amount)} $`;

export const formatQty = (qty: number, unit?: string | null): string => {
  const formatted = qtyFormatter.format(qty);
  return unit ? `${formatted} ${unit}` : formatted;
};

export const formatDate = (date: Date | number | string): string =>
  dateFormatter.format(new Date(date));

export const formatDateTime = (date: Date | number | string): string =>
  dateTimeFormatter.format(new Date(date));
