import { describe, expect, it } from "vite-plus/test";

import { receiptMessage, whatsappPhone, whatsappUrl } from "./whatsapp";

describe("whatsappPhone", () => {
  it("garde un numéro déjà international", () => {
    expect(whatsappPhone("+228 90 12 34 56", "")).toBe("22890123456");
    expect(whatsappPhone("00225 07 01 02 03 04", "228")).toBe("2250701020304");
  });

  it("ajoute l'indicatif par défaut à un numéro local", () => {
    expect(whatsappPhone("90 12 34 56", "228")).toBe("22890123456");
    expect(whatsappPhone("90-12-34-56", "+228")).toBe("22890123456");
    // Un numéro local qui commence comme l'indicatif reste un numéro local.
    expect(whatsappPhone("22 81 23 45", "228")).toBe("22822812345");
    expect(whatsappPhone("228 90 12 34 56", "228")).toBe("22890123456");
  });

  it("renonce sans numéro ni indicatif", () => {
    expect(whatsappPhone(null, "228")).toBeNull();
    expect(whatsappPhone("  ", "228")).toBeNull();
    expect(whatsappPhone("90 12 34 56", "")).toBeNull();
  });
});

describe("whatsappUrl", () => {
  it("encode le message et accepte un contact inconnu", () => {
    expect(whatsappUrl("22890123456", "Bonjour Awa,\nmerci")).toBe(
      "https://wa.me/22890123456?text=Bonjour%20Awa%2C%0Amerci",
    );
    expect(whatsappUrl(null, "Bonjour")).toBe("https://wa.me/?text=Bonjour");
  });
});

describe("receiptMessage", () => {
  const base = {
    customerName: "Awa",
    netFcfa: 125_000,
    reference: "V-2026-00012",
    saleDate: new Date(2026, 9, 27),
  };

  it("annonce le reste à payer d'une vente à crédit", () => {
    expect(receiptMessage({ ...base, companyName: "Ets Yass", dueFcfa: 25_000 })).toBe(
      [
        "Bonjour Awa,",
        "Voici votre reçu V-2026-00012 du 27 oct. 2026 : 125 000 FCFA.",
        "Reste à payer : 25 000 FCFA.",
        "Merci de votre confiance.",
        "Ets Yass",
      ].join("\n"),
    );
  });

  it("indique une facture soldée ou une vente annulée", () => {
    expect(receiptMessage({ ...base, dueFcfa: 0 })).toContain("Facture soldée.");
    const cancelled = receiptMessage({
      ...base,
      dueFcfa: 0,
      isCancelled: true,
    });
    expect(cancelled).toContain("a été annulée");
    expect(cancelled).not.toContain("Merci");
  });
});
