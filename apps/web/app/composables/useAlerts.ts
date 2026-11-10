import { useQuery } from "@tanstack/vue-query";

/** Un point qui demande une action : rupture, réassort, créance critique, sauvegarde. */
export interface AppAlert {
  id: string;
  icon: string;
  color: "error" | "warning";
  title: string;
  description: string;
  to: string;
}

export interface AlertOptions {
  /**
   * Rafraîchit toutes les `refetchInterval` ms, même fenêtre rangée : l'application de bureau
   * prévient ainsi d'une alerte alors que G-stock tourne près de l'horloge.
   */
  refetchInterval?: number;
}

/** Réglages vue-query du rafraîchissement continu (aucun sans intervalle). */
export const backgroundPolling = ({ refetchInterval }: AlertOptions) =>
  refetchInterval ? { refetchInterval, refetchIntervalInBackground: true } : {};

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

/** Ce que la cloche de la barre du haut signale (stock, créances, sauvegarde). */
export const useAlerts = (options: AlertOptions = {}) => {
  const icons = useIcons();
  const { $orpc } = useNuxtApp();
  const polling = backgroundPolling(options);

  const summary = useQuery({
    ...$orpc.stock.summary.queryOptions(),
    ...polling,
  });
  const sales = useQuery({ ...$orpc.sales.summary.queryOptions(), ...polling });
  const backupWarning = useBackupWarning(options);

  return computed<AppAlert[]>(() => {
    const list: AppAlert[] = [];
    const stock = summary.data.value;
    const criticalDebtors = sales.data.value?.criticalDebtorCount ?? 0;
    if (stock && stock.outCount > 0) {
      list.push({
        color: "error",
        description: "Plus aucune unité en stock.",
        icon: icons.stockOut,
        id: "out",
        title: `${plural(stock.outCount, "produit")} en rupture`,
        to: "/produits?statut=out",
      });
    }
    if (stock && stock.lowCount > 0) {
      list.push({
        color: "warning",
        description: "Au niveau ou sous le seuil d'alerte.",
        icon: icons.stockLow,
        id: "low",
        title: `${plural(stock.lowCount, "produit")} à réapprovisionner`,
        to: "/produits?statut=low",
      });
    }
    if (criticalDebtors > 0) {
      list.push({
        color: "error",
        description: "Créances anciennes à relancer.",
        icon: icons.receivablesCritical,
        id: "debtors",
        title: `${plural(criticalDebtors, "client")} en retard critique`,
        to: "/clients?debiteurs",
      });
    }
    if (backupWarning.value) {
      list.push({
        color: "warning",
        description: backupWarning.value,
        icon: icons.backup,
        id: "backup",
        title: "Sauvegarde à vérifier",
        to: "/parametres",
      });
    }
    return list;
  });
};
