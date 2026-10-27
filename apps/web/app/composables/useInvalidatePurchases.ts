import { useQueryClient } from "@tanstack/vue-query";

/** Rafraîchit les commandes et les fournisseurs après une écriture. */
export const useInvalidatePurchases = () => {
  const queryClient = useQueryClient();
  const { $orpc } = useNuxtApp();

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: $orpc.purchases.key() }),
      queryClient.invalidateQueries({ queryKey: $orpc.suppliers.key() }),
    ]);
  };
};
