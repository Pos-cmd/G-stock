/**
 * Contacts de la page et prix de la licence, réglés dans nuxt.config.ts (runtimeConfig.public) et
 * remplaçables à la génération (NUXT_PUBLIC_WHATSAPP, NUXT_PUBLIC_PHONE, NUXT_PUBLIC_EMAIL,
 * NUXT_PUBLIC_LICENCE_FROM, NUXT_PUBLIC_DEMO_URL).
 */
export type RequestKind = "demo" | "licence";

export const REQUEST_LABELS: Record<RequestKind, string> = {
  demo: "une démonstration",
  licence: "une licence",
};

const fcfa = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export const useContact = () => {
  const config = useRuntimeConfig().public;
  const whatsappNumber = String(config.whatsapp ?? "").replaceAll(/\D/gu, "");
  const phone = String(config.phone ?? "");
  const email = String(config.email ?? "");
  const licenceFrom = Number(config.licenceFrom) || 0;

  const whatsapp = (text: string) =>
    `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
  const mail = (subject: string, body: string) =>
    `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return {
    email,
    licencePrice:
      licenceFrom > 0 ? `À partir de ${fcfa.format(licenceFrom)} FCFA` : "Prix sur demande",
    mail,
    phone,
    phoneHref: `tel:${phone.replaceAll(/\s/gu, "")}`,
    whatsapp,
  };
};
