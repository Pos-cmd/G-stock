import { useQueryClient } from "@tanstack/vue-query";

/** Rafraîchit ventes, clients et paiements après une écriture (le stock a son propre composable). */
export const useInvalidateSales = () => {
  const queryClient = useQueryClient();
  const { $orpc } = useNuxtApp();

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: $orpc.sales.key() }),
      queryClient.invalidateQueries({ queryKey: $orpc.customers.key() }),
      queryClient.invalidateQueries({ queryKey: $orpc.payments.key() }),
    ]);
  };
};
