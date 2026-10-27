import type { DehydratedState, VueQueryPluginOptions } from "@tanstack/vue-query";
import { dehydrate, hydrate, QueryCache, QueryClient, VueQueryPlugin } from "@tanstack/vue-query";

export default defineNuxtPlugin((nuxt) => {
  const vueQueryState = useState<DehydratedState | null>("vue-query");

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

  if (import.meta.server) {
    nuxt.hooks.hook("app:rendered", () => {
      vueQueryState.value = dehydrate(queryClient);
    });
  }

  if (import.meta.client) {
    nuxt.hooks.hook("app:created", () => {
      const dehydratedState = vueQueryState.value;
      if (dehydratedState) {
        hydrate(queryClient, dehydratedState);
      }
    });
  }
});
