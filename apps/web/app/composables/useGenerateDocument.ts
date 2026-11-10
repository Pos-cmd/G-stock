import type { GeneratedDocumentType } from "@G-stock/api/schemas/documents";
import { useMutation, useQueryClient } from "@tanstack/vue-query";

/**
 * Génère un PDF (rangé dans le dossier des documents) puis l'ouvre : dans le lecteur PDF du PC
 * avec l'application de bureau, sinon dans un nouvel onglet. L'onglet est ouvert avant l'appel au
 * serveur, sinon le navigateur le bloquerait.
 */
export const useGenerateDocument = () => {
  const { $orpc } = useNuxtApp();
  const notify = useNotify();
  const desktop = useDesktop();
  const queryClient = useQueryClient();
  const mutation = useMutation($orpc.documents.generate.mutationOptions());

  const generateOnDesktop = async (type: GeneratedDocumentType, referenceId: string) => {
    try {
      const document = await mutation.mutateAsync({ referenceId, type });
      await queryClient.invalidateQueries({ queryKey: $orpc.documents.key() });
      notify.success("PDF enregistré", document.filePath);
      await desktop.openFile(document.filePath);
    } catch (error) {
      notify.error("PDF impossible", error);
    }
  };

  const generate = async (type: GeneratedDocumentType, referenceId: string) => {
    if (desktop.isDesktop) {
      await generateOnDesktop(type, referenceId);
      return;
    }
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
