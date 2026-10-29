// Page de présentation de G-stock, rendue en statique (pnpm --filter landing generate).
export default defineNuxtConfig({
  app: {
    head: {
      htmlAttrs: { lang: "fr" },
      link: [{ href: "/favicon.svg", rel: "icon", type: "image/svg+xml" }],
      meta: [
        {
          content:
            "La vraie marge de chaque produit, frais compris : stock, ventes à crédit et commandes de Chine pour les importateurs. Une licence par magasin, sans abonnement.",
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
  modules: ["@nuxt/ui"],
  runtimeConfig: {
    public: {
      // Contacts affichés sur la page ; chacun se remplace à la génération (NUXT_PUBLIC_…).
      demoUrl: "",
      email: "afolabiyasser06@gmail.com",
      // Prix de départ de la licence, en FCFA ; vide : « prix sur demande ».
      licenceFrom: "",
      phone: "+228 96 53 63 39",
      // WhatsApp au format international, chiffres seuls.
      whatsapp: "22896536339",
    },
  },
  ui: { colorMode: false },
});
