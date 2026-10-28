import type appConfig from "~/app.config";

type AppIcons = typeof appConfig.ui.icons;

/** Icônes de l'application, définies en un seul endroit : `ui.icons` dans `app.config.ts`. */
export const useIcons = (): AppIcons =>
  // Nuxt UI type `ui.icons` en `Record<string, string>` : on reprend les clés réelles de la
  // configuration pour qu'une icône inconnue soit une erreur de compilation.
  useAppConfig().ui.icons as AppIcons;
