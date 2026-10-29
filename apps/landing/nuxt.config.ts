// Page de présentation de G-stock, rendue en statique (pnpm --filter landing generate).
export default defineNuxtConfig({
  app: {
    head: {
      htmlAttrs: { lang: "fr" },
      link: [{ href: "/favicon.svg", rel: "icon", type: "image/svg+xml" }],
      meta: [
        {
          content:
            "Stock par lots, vraie marge, ventes à crédit, commandes de Chine et reçus sur WhatsApp : la gestion du magasin pour les importateurs, installée chez vous.",
          name: "description",
        },
        { content: "#f4f2ef", name: "theme-color" },
      ],
      title: "G-stock — La gestion du magasin pour les importateurs",
    },
  },
  compatibilityDate: "latest",
  css: ["~/assets/css/main.css"],
  devtools: { enabled: false },
  icon: {
    clientBundle: { scan: true },
    serverBundle: "local",
  },
  modules: [
    "@nuxt/ui",
    // Sans numéro, chaque bouton ouvrirait WhatsApp sans destinataire : la version publiée refuse
    // de se construire tant que NUXT_PUBLIC_WHATSAPP n'est pas renseigné (le mode dev l'accepte).
    (_options, nuxt) => {
      nuxt.hook("build:before", () => {
        if (!nuxt.options.dev && !process.env.NUXT_PUBLIC_WHATSAPP) {
          throw new Error(
            "NUXT_PUBLIC_WHATSAPP manquant : indiquez le numéro WhatsApp (ex. 22890000000) avant de générer la landing.",
          );
        }
      });
    },
  ],
  runtimeConfig: {
    public: {
      // Numéro WhatsApp au format international, chiffres seuls (ex. 22890000000).
      // NUXT_PUBLIC_WHATSAPP au moment de la génération.
      demoUrl: "",
      whatsapp: "",
    },
  },
  ui: { colorMode: false },
});
