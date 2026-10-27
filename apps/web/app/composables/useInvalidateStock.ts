import { useQueryClient } from "@tanstack/vue-query";

/** Rafraîchit tout ce qui dépend des produits et du stock après une écriture. */
export const useInvalidateStock = () => {
  const queryClient = useQueryClient();
  const { $orpc } = useNuxtApp();

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: $orpc.products.key() }),
      queryClient.invalidateQueries({ queryKey: $orpc.stock.key() }),
    ]);
  };
};
