// Applique le thème choisi (couleurs, arrondi, police, graphiques) et le garde dans le navigateur.
const STORAGE_KEY = "gstock-theme";

/**
 * Variables CSS du thème. `html:root` et `html.dark` l'emportent sur les valeurs par défaut de
 * main.css ; les palettes elles-mêmes sont données à Nuxt UI par `appConfig.ui.colors`.
 */
const themeCss = (settings: ThemeSettings) => {
  const black = settings.primary === "black";
  return `html:root {
  --ui-primary: var(--ui-color-${black ? "neutral-900" : "primary-500"});
  --ui-chart-1: ${themeSwatch(settings.accent, 500)};
  --ui-radius: ${settings.radius}rem;
  --font-sans: "${settings.font}", sans-serif;
}
html.dark {
  --ui-primary: var(--ui-color-${black ? "neutral-50" : "primary-400"});
  --ui-chart-1: ${themeSwatch(settings.accent, 400)};
}`;
};

export default defineNuxtPlugin(() => {
  const appConfig = useAppConfig();
  const { settings } = useAppTheme();

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      settings.value = sanitizeTheme(JSON.parse(stored));
    }
  } catch {
    // Stockage indisponible (navigation privée) : on garde le thème d'origine.
  }

  watch(
    settings,
    (value) => {
      appConfig.ui.colors.neutral = value.neutral;
      // « Noir » : la couleur principale est le gris du thème, en teinte foncée.
      appConfig.ui.colors.primary = value.primary === "black" ? value.neutral : value.primary;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch {
        // Le thème s'applique quand même pour cette session.
      }
    },
    { deep: true, immediate: true },
  );

  useHead({
    style: [{ id: "gstock-theme", innerHTML: computed(() => themeCss(settings.value)) }],
  });
});
