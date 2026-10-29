// Documentation utilisateur de G-stock (Docus, au-dessus de Nuxt Content et Nuxt UI).
// Les captures annotées viennent de comark-ui : voir scripts/capture.mjs et scripts/render-figures.mjs.
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
  extends: ["docus"],
  site: {
    name: "G-stock",
  },
});
