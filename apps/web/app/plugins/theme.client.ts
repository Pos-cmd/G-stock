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

const TABLER_PREFIX = "i-tabler-";

/** Icône de app.config (écrite en Tabler) dans la bibliothèque choisie. */
const translateIcon = (icon: string, library: IconLibrary) => {
  if (library === "tabler" || !icon.startsWith(TABLER_PREFIX)) {
    return icon;
  }
  const name = icon.slice(TABLER_PREFIX.length);
  const table = library === "lucide" ? LUCIDE_ICONS : PHOSPHOR_ICONS;
  return table[name] ?? icon;
};

export default defineNuxtPlugin(() => {
  const appConfig = useAppConfig();
  const { settings } = useAppTheme();
  // Icônes d'origine (Tabler), pour pouvoir changer de bibliothèque dans les deux sens.
  const originalIcons = { ...appConfig.ui.icons } as Record<string, string>;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      settings.value = sanitizeTheme(JSON.parse(stored));
    }
  } catch {
    // Stockage indisponible (navigation privée) : on garde le thème d'origine.
  }

  // Fondu des couleurs lors d'un changement de thème (pas au chargement de la page).
  const THEME_FADE_MS = 400;
  let fadeTimer: ReturnType<typeof setTimeout> | undefined;
  watch(
    settings,
    () => {
      document.documentElement.classList.add("theme-changing");
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(() => {
        document.documentElement.classList.remove("theme-changing");
      }, THEME_FADE_MS);
    },
    { deep: true },
  );

  watch(
    settings,
    (value) => {
      appConfig.ui.colors.neutral = value.neutral;
      // « Noir » : la couleur principale est le gris du thème, en teinte foncée.
      appConfig.ui.colors.primary = value.primary === "black" ? value.neutral : value.primary;
      const icons = appConfig.ui.icons as Record<string, string>;
      for (const [key, icon] of Object.entries(originalIcons)) {
        icons[key] = translateIcon(icon, value.icons);
      }
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
