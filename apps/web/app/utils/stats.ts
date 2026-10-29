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

/** Périodes proposées au-dessus des tableaux à tendances, en semaines. */
export const TREND_PERIODS = [4, 13, 26] as const;
export type TrendPeriod = (typeof TREND_PERIODS)[number];

const periodEndFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
/** « 13 semaines au 29 oct., comparées aux 13 précédentes ». */
export const trendPeriodLabel = (weeks: number): string =>
  `${weeks} semaines au ${periodEndFormat.format(new Date())}, comparées aux ${weeks} précédentes`;

const DAY_MS = 86_400_000;
const DAYS_PER_MONTH = 30;
/** « aujourd'hui », « hier », « il y a 12 j », « il y a 3 mois ». */
export const formatDaysAgo = (date: Date | string | number): string => {
  const start = new Date(date);
  const today = new Date();
  const days = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()) /
      DAY_MS,
  );
  if (days <= 0) {
    return "aujourd'hui";
  }
  if (days === 1) {
    return "hier";
  }
  return days < 2 * DAYS_PER_MONTH
    ? `il y a ${days} j`
    : `il y a ${Math.round(days / DAYS_PER_MONTH)} mois`;
};
