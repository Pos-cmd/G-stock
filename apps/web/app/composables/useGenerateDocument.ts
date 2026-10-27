import type { GeneratedDocumentType } from "@G-stock/api/schemas/documents";
import { useMutation, useQueryClient } from "@tanstack/vue-query";

/**
 * Génère un PDF (rangé dans le dossier des documents) puis l'ouvre dans un nouvel onglet.
 * L'onglet est ouvert avant l'appel au serveur, sinon le navigateur le bloquerait.
 */
export const useGenerateDocument = () => {
  const { $orpc } = useNuxtApp();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const mutation = useMutation($orpc.documents.generate.mutationOptions());

  const generate = async (type: GeneratedDocumentType, referenceId: string) => {
    const tab = window.open("about:blank", "_blank");
    try {
      const document = await mutation.mutateAsync({ referenceId, type });
      await queryClient.invalidateQueries({ queryKey: $orpc.documents.key() });
      if (tab) {
        tab.location.href = `/api/documents/${document.id}`;
      }
      notify.success("PDF enregistré", document.filePath);
    } catch (error) {
      tab?.close();
      notify.error("PDF impossible", error);
    }
  };

  return { generate, generating: mutation.isPending };
};
