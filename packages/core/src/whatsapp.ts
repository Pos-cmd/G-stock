import { formatDate, formatFcfa } from "./format";

const NON_DIGITS = /\D/gu;
/** Toutes les espaces, dont les fines insécables de fr-FR : remplacées par des espaces simples. */
const SPACES = /\p{Zs}/gu;
/** Longueur minimale d'un numéro national après l'indicatif (8 chiffres en Afrique de l'Ouest). */
const MIN_NATIONAL_DIGITS = 8;

/**
 * Numéro au format attendu par WhatsApp (indicatif + numéro, chiffres seuls), ou null si on ne
 * peut pas le déduire. « +228 90 00 00 00 » et « 00228… » sont déjà internationaux ; un numéro
 * local reçoit l'indicatif par défaut des Paramètres.
 */
export const whatsappPhone = (
  phone: string | null | undefined,
  defaultCountryCode: string,
): string | null => {
  const trimmed = phone?.trim() ?? "";
  const digits = trimmed.replaceAll(NON_DIGITS, "");
  if (!digits) {
    return null;
  }
  if (trimmed.startsWith("+")) {
    return digits;
  }
  if (digits.startsWith("00")) {
    return digits.slice(2);
  }
  const code = defaultCountryCode.replaceAll(NON_DIGITS, "");
  if (!code) {
    return null;
  }
  const alreadyInternational =
    digits.startsWith(code) && digits.length >= code.length + MIN_NATIONAL_DIGITS;
  return alreadyInternational ? digits : `${code}${digits}`;
};

/** Lien qui ouvre une discussion WhatsApp (avec le contact s'il est connu) et un message prêt. */
export const whatsappUrl = (phone: string | null, message: string): string =>
  `https://wa.me/${phone ?? ""}?text=${encodeURIComponent(message)}`;

export interface ReceiptMessageInput {
  customerName: string;
  reference: string;
  saleDate: Date | string;
  netFcfa: number;
  dueFcfa: number;
  companyName?: string | null;
  isCancelled?: boolean;
}

/** Message qui accompagne le reçu envoyé au client. */
export const receiptMessage = (input: ReceiptMessageInput): string => {
  const lines = [
    `Bonjour ${input.customerName},`,
    input.isCancelled
      ? `La vente ${input.reference} du ${formatDate(input.saleDate)} a été annulée.`
      : `Voici votre reçu ${input.reference} du ${formatDate(input.saleDate)} : ${formatFcfa(input.netFcfa)}.`,
  ];
  if (!input.isCancelled) {
    lines.push(
      input.dueFcfa > 0 ? `Reste à payer : ${formatFcfa(input.dueFcfa)}.` : "Facture soldée.",
      "Merci de votre confiance.",
    );
  }
  if (input.companyName) {
    lines.push(input.companyName);
  }
  return lines.join("\n").replaceAll(SPACES, " ");
};
