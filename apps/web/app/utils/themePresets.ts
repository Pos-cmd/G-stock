/**
 * Thèmes de l'application : réglages possibles et thèmes prêts à l'emploi. Pour ajouter ou
 * modifier un thème, il suffit d'éditer `THEME_PRESETS` ; le sélecteur (barre du haut) les liste.
 */

/** Couleur des boutons principaux : « noir » (encre) ou une palette Tailwind. */
export const PRIMARY_COLORS = [
  "black",
  "red",
  "orange",
  "amber",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
] as const;

/** Gris des fonds, bordures et textes ; « sand » est le gris chaud propre à G-stock. */
export const NEUTRAL_COLORS = [
  "sand",
  "stone",
  "taupe",
  "mauve",
  "neutral",
  "zinc",
  "gray",
  "slate",
  "mist",
  "olive",
] as const;

/** Couleur des courbes et barres des graphiques. */
export const ACCENT_COLORS = PRIMARY_COLORS.filter((color) => color !== "black");

/** Arrondi de base, en rem : les cartes et fenêtres en sont des multiples. */
export const RADII = [0, 0.125, 0.25, 0.375, 0.5, 0.75] as const;

/** Polices proposées (téléchargées une fois, puis embarquées avec l'application). */
export const FONTS = ["Inter", "Geist", "DM Sans", "Public Sans", "Manrope", "Outfit"] as const;

export type PrimaryColor = (typeof PRIMARY_COLORS)[number];
export type NeutralColor = (typeof NEUTRAL_COLORS)[number];
export type AccentColor = Exclude<PrimaryColor, "black">;
export type ThemeFont = (typeof FONTS)[number];

export interface ThemeSettings {
  icons: IconLibrary;
  primary: PrimaryColor;
  neutral: NeutralColor;
  accent: AccentColor;
  radius: number;
  font: ThemeFont;
}

export interface ThemePreset {
  id: string;
  label: string;
  description: string;
  settings: ThemeSettings;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    description: "Noir sur gris chaud, le thème d'origine.",
    id: "encre",
    label: "Encre",
    settings: {
      icons: "tabler",
      accent: "indigo",
      font: "Inter",
      neutral: "sand",
      primary: "black",
      radius: 0.375,
    },
  },
  {
    description: "Bleu ciel et ardoise, net et frais.",
    id: "ocean",
    label: "Océan",
    settings: {
      icons: "lucide",
      accent: "sky",
      font: "Public Sans",
      neutral: "slate",
      primary: "sky",
      radius: 0.5,
    },
  },
  {
    description: "Vert émeraude sur pierre, calme.",
    id: "foret",
    label: "Forêt",
    settings: {
      icons: "phosphor",
      accent: "emerald",
      font: "DM Sans",
      neutral: "stone",
      primary: "emerald",
      radius: 0.375,
    },
  },
  {
    description: "Orange chaud et grand arrondi.",
    id: "terre-cuite",
    label: "Terre cuite",
    settings: {
      icons: "phosphor",
      accent: "amber",
      font: "Manrope",
      neutral: "taupe",
      primary: "orange",
      radius: 0.75,
    },
  },
  {
    description: "Violet profond sur zinc.",
    id: "amethyste",
    label: "Améthyste",
    settings: {
      icons: "lucide",
      accent: "violet",
      font: "Geist",
      neutral: "zinc",
      primary: "violet",
      radius: 0.5,
    },
  },
  {
    description: "Noir, angles vifs et cyan : technique.",
    id: "graphite",
    label: "Graphite",
    settings: {
      icons: "tabler",
      accent: "cyan",
      font: "Geist",
      neutral: "zinc",
      primary: "black",
      radius: 0.125,
    },
  },
  {
    description: "Rose corail, doux et arrondi.",
    id: "corail",
    label: "Corail",
    settings: {
      icons: "phosphor",
      accent: "rose",
      font: "Outfit",
      neutral: "mauve",
      primary: "rose",
      radius: 0.75,
    },
  },
];

export const DEFAULT_THEME: ThemeSettings = {
  ...(THEME_PRESETS[0] as ThemePreset).settings,
};

const COLOR_LABELS: Record<string, string> = {
  amber: "Ambre",
  black: "Noir",
  blue: "Bleu",
  cyan: "Cyan",
  emerald: "Émeraude",
  fuchsia: "Fuchsia",
  gray: "Gris",
  green: "Vert",
  indigo: "Indigo",
  mauve: "Mauve",
  mist: "Brume",
  neutral: "Neutre",
  olive: "Olive",
  orange: "Orange",
  pink: "Rose vif",
  purple: "Pourpre",
  red: "Rouge",
  rose: "Rose",
  sand: "Sable",
  sky: "Ciel",
  slate: "Ardoise",
  stone: "Pierre",
  taupe: "Taupe",
  teal: "Sarcelle",
  violet: "Violet",
  zinc: "Zinc",
};
export const colorLabel = (color: string): string => COLOR_LABELS[color] ?? color;

const oneOf = <T extends string | number>(list: readonly T[], candidate: unknown, fallback: T) =>
  list.find((item) => item === candidate) ?? fallback;

/** Valide un réglage lu dans le navigateur : une valeur inconnue reprend celle du thème d'origine. */
export const sanitizeTheme = (value: unknown): ThemeSettings => {
  const input = (typeof value === "object" && value !== null ? value : {}) as Record<
    string,
    unknown
  >;
  return {
    accent: oneOf(ACCENT_COLORS, input.accent, DEFAULT_THEME.accent),
    icons: oneOf(ICON_LIBRARIES, input.icons, DEFAULT_THEME.icons),
    font: oneOf(FONTS, input.font, DEFAULT_THEME.font),
    neutral: oneOf(NEUTRAL_COLORS, input.neutral, DEFAULT_THEME.neutral),
    primary: oneOf(PRIMARY_COLORS, input.primary, DEFAULT_THEME.primary),
    radius: oneOf(RADII, input.radius, DEFAULT_THEME.radius),
  };
};

const pickOne = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)] as T;

/** Thème au hasard, mais lisible : l'accent reprend souvent la couleur principale. */
export const randomTheme = (): ThemeSettings => {
  const primary = pickOne(PRIMARY_COLORS);
  const accent = primary !== "black" && Math.random() < 0.6 ? primary : pickOne(ACCENT_COLORS);
  return {
    accent,
    font: pickOne(FONTS),
    icons: pickOne(ICON_LIBRARIES),
    neutral: pickOne(NEUTRAL_COLORS),
    primary,
    radius: pickOne(RADII),
  };
};

export const sameTheme = (a: ThemeSettings, b: ThemeSettings): boolean =>
  a.primary === b.primary &&
  a.neutral === b.neutral &&
  a.accent === b.accent &&
  a.radius === b.radius &&
  a.font === b.font &&
  a.icons === b.icons;
