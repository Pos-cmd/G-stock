/**
 * Liens de contact : WhatsApp avec un message prêt, et la démo quand elle est en ligne. Le numéro
 * et l'adresse de la démo se règlent à la génération (NUXT_PUBLIC_WHATSAPP, NUXT_PUBLIC_DEMO_URL).
 */
export const CONTACT_MESSAGE = "Bonjour, je voudrais G-stock pour mon magasin.";
export const DEMO_MESSAGE = "Bonjour, je voudrais voir une démonstration de G-stock.";

export const useContact = () => {
  const config = useRuntimeConfig().public;
  const number = String(config.whatsapp ?? "").replaceAll(/\D/gu, "");
  const demoUrl = String(config.demoUrl ?? "");

  // Sans numéro, WhatsApp s'ouvre avec le message et laisse choisir le destinataire.
  const whatsapp = (text: string = CONTACT_MESSAGE) =>
    `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

  return {
    demo: demoUrl
      ? { external: true, label: "Essayer la démo", to: demoUrl }
      : {
          external: true,
          label: "Demander une démonstration",
          to: whatsapp(DEMO_MESSAGE),
        },
    hasDemo: demoUrl !== "",
    whatsapp,
  };
};
