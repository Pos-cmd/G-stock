/** Évolution entre deux périodes (0,08 = +8 %) ; `null` sans base de comparaison. */
export const trendRatio = (current: number, previous: number): number | null =>
  previous > 0 ? (current - previous) / previous : null;

const trendFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
  style: "percent",
});
export const formatTrend = (ratio: number): string => trendFormat.format(ratio);

const compactFormat = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  notation: "compact",
});
/** Montant court pour les axes des graphiques (1,2 M, 450 k). */
export const formatCompact = (value: number): string => compactFormat.format(value);

const dayLabelFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  weekday: "short",
});
/** « mar. 14 oct. » pour un jour au format AAAA-MM-JJ. */
export const formatDayLabel = (day: string): string =>
  dayLabelFormat.format(fromDateInputValue(day));

const monthLabelFormat = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" });
/** « oct. 26 » pour un mois au format AAAA-MM. */
export const formatMonthLabel = (month: string): string =>
  monthLabelFormat.format(fromDateInputValue(`${month}-01`));

export const sumOf = <T>(rows: readonly T[], pick: (row: T) => number): number =>
  rows.reduce((total, row) => total + pick(row), 0);
