import type { VueQueryPluginOptions } from "@tanstack/vue-query";
import { QueryCache, QueryClient, VueQueryPlugin } from "@tanstack/vue-query";

export default defineNuxtPlugin((nuxt) => {
  const toast = useToast();

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
          icon: "i-lucide-circle-alert",
          title: "Erreur de chargement",
        });
      },
    }),
  });
  const options: VueQueryPluginOptions = { queryClient };

  nuxt.vueApp.use(VueQueryPlugin, options);
});
