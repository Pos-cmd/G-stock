import type { VueQueryPluginOptions } from "@tanstack/vue-query";
import { QueryCache, QueryClient, VueQueryPlugin } from "@tanstack/vue-query";

export default defineNuxtPlugin((nuxt) => {
  const toast = useToast();
  const icons = useIcons();

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5_000,
      },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        toast.add({
          color: "error",
          description: error?.message || "Une erreur inattendue est survenue.",
          icon: icons.error,
          title: "Erreur de chargement",
        });
      },
    }),
  });
  const options: VueQueryPluginOptions = { queryClient };

  nuxt.vueApp.use(VueQueryPlugin, options);
});
