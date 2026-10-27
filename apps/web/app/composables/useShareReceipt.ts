import { receiptMessage, whatsappPhone, whatsappUrl } from "@G-stock/core/whatsapp";
import { useMutation, useQueryClient } from "@tanstack/vue-query";

import { useSettingsStore } from "~/stores/settings";
import type { SaleDetail } from "~/types/api";

/**
 * Partage direct du fichier, réservé aux téléphones (écran tactile, HTTPS). Sur PC, Windows
 * proposerait son propre panneau de partage : on préfère ouvrir WhatsApp sur la bonne discussion.
 */
const canShareFiles = (): boolean => {
  if (!window.matchMedia("(pointer: coarse)").matches) {
    return false;
  }
  try {
    const probe = new File([""], "recu.pdf", { type: "application/pdf" });
    return Boolean(navigator.canShare?.({ files: [probe] }));
  } catch {
    return false;
  }
};

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";
const isNotAllowed = (error: unknown) =>
  error instanceof DOMException && error.name === "NotAllowedError";

const downloadFile = (file: File) => {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Envoie le reçu d'une vente sur WhatsApp, au format téléphone.
 * - Téléphone : le PDF part directement via le partage du système (choisir WhatsApp).
 * - PC : le PDF est téléchargé et WhatsApp s'ouvre sur la discussion du client avec un message
 *   prêt ; il reste à glisser le fichier dans la discussion.
 */
export const useShareReceipt = () => {
  const { $orpc } = useNuxtApp();
  const notify = useNotify();
  const toast = useToast();
  const queryClient = useQueryClient();
  const settingsStore = useSettingsStore();
  const mutation = useMutation($orpc.documents.generate.mutationOptions());

  const shareFile = async (file: File, text: string) => {
    try {
      await navigator.share({ files: [file], text });
    } catch (error) {
      if (isAbort(error)) {
        return;
      }
      if (!isNotAllowed(error)) {
        throw error;
      }
      // La génération a pris trop de temps : le navigateur exige un nouveau geste.
      toast.add({
        actions: [
          {
            icon: "i-lucide-send",
            label: "Envoyer",
            onClick: async () => {
              try {
                await navigator.share({ files: [file], text });
              } catch {
                // Partage fermé par l'utilisateur : rien à faire.
              }
            },
          },
        ],
        color: "success",
        icon: "i-lucide-file-check",
        title: "Reçu prêt à envoyer",
      });
    }
  };

  const share = async (sale: SaleDetail) => {
    const withFile = canShareFiles();
    // Sur PC, l'onglet WhatsApp est ouvert pendant le clic, sinon le navigateur le bloquerait.
    const tab = withFile ? null : window.open("about:blank", "_blank");
    try {
      await settingsStore.load();
      const message = receiptMessage({
        companyName: settingsStore.settings?.companyName,
        customerName: sale.customer.name,
        dueFcfa: sale.summary.dueFcfa,
        isCancelled: sale.status === "cancelled",
        netFcfa: sale.summary.netFcfa,
        reference: sale.reference,
        saleDate: sale.saleDate,
      });
      const generated = await mutation.mutateAsync({
        referenceId: sale.id,
        type: "receipt_mobile",
      });
      await queryClient.invalidateQueries({ queryKey: $orpc.documents.key() });
      const response = await fetch(`/api/documents/${generated.id}?telecharger`);
      if (!response.ok) {
        throw new Error("Le reçu n'a pas pu être récupéré");
      }
      const file = new File([await response.blob()], `Recu-${sale.reference}.pdf`, {
        type: "application/pdf",
      });

      if (withFile) {
        await shareFile(file, message);
        return;
      }
      downloadFile(file);
      const phone = whatsappPhone(
        sale.customer.phone,
        settingsStore.settings?.phoneCountryCode ?? "",
      );
      if (tab) {
        tab.location.href = whatsappUrl(phone, message);
      }
      notify.success(
        "Reçu téléchargé",
        phone
          ? "Glissez le PDF dans la discussion WhatsApp qui vient de s'ouvrir."
          : "Choisissez le client dans WhatsApp, puis glissez-y le PDF téléchargé.",
      );
    } catch (error) {
      tab?.close();
      notify.error("Envoi impossible", error);
    }
  };

  return { share, sharing: mutation.isPending };
};
