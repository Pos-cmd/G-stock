import colors from "tailwindcss/colors";

/** Thème choisi dans le sélecteur de la barre du haut (appliqué par le plugin `theme.client`). */
export const useAppTheme = () => {
  const settings = useState<ThemeSettings>("app-theme", () => ({ ...DEFAULT_THEME }));

  const activePreset = computed(() =>
    THEME_PRESETS.find((preset) => sameTheme(preset.settings, settings.value)),
  );
  const applyPreset = (preset: ThemePreset) => {
    settings.value = { ...preset.settings };
  };
  const randomize = () => {
    settings.value = randomTheme();
  };
  const reset = () => {
    settings.value = { ...DEFAULT_THEME };
  };

  return { activePreset, applyPreset, randomize, reset, settings };
};

type Palette = Record<number, string>;
const palettes = colors as unknown as Record<string, Palette | undefined>;

/** Teinte d'une couleur du thème, pour les pastilles d'aperçu et les graphiques. */
export const themeSwatch = (color: string, shade = 500): string => {
  if (color === "black") {
    return "oklch(21% 0.006 60)";
  }
  if (color === "sand") {
    return `var(--color-sand-${shade})`;
  }
  return palettes[color]?.[shade] ?? "transparent";
};
