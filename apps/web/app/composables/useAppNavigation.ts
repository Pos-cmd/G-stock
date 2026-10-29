import type { NavigationMenuItem } from "@nuxt/ui";
import { useQuery } from "@tanstack/vue-query";

export interface NavSection {
  id: string;
  label: string;
  items: NavigationMenuItem[];
  /** Action « + » à côté du titre de la section. */
  create?: { label: string; onSelect: () => void };
}

/** Rubriques de la barre latérale, reprises par la recherche (Ctrl K). */
export const useAppNavigation = () => {
  const icons = useIcons();
  const { $orpc } = useNuxtApp();
  const create = useCreateDialogs();
  const route = useRoute();

  // Les pages de détail et de création (/ventes/nouvelle, /produits/[id]…) ne sont pas des routes
  // enfants : le lien de la rubrique resterait éteint sans ce test sur le chemin.
  const isUnder = (path: string) => route.path === path || route.path.startsWith(`${path}/`);

  const summary = useQuery($orpc.stock.summary.queryOptions());
  const sales = useQuery($orpc.sales.summary.queryOptions());
  const stockAlerts = computed(() => {
    const data = summary.data.value;
    return data ? data.lowCount + data.outCount : 0;
  });
  const criticalDebtors = computed(() => sales.data.value?.criticalDebtorCount ?? 0);

  // Commandes en cours (passées ou en route) : un simple compte, en gris.
  const purchases = useQuery($orpc.purchases.list.queryOptions({ input: {} }));
  const ordersInProgress = computed(
    () =>
      (purchases.data.value ?? []).filter(
        (order) => order.status === "ordered" || order.status === "in_transit",
      ).length,
  );

  // Badges : rouge plein pour ce qui demande une action, gris pour un simple compte.
  const alertBadge = (count: number) =>
    count > 0
      ? { color: "error" as const, label: String(count), variant: "solid" as const }
      : undefined;
  const countBadge = (count: number) =>
    count > 0
      ? { color: "neutral" as const, label: String(count), variant: "subtle" as const }
      : undefined;

  const sections = computed<NavSection[]>(() => [
    {
      id: "general",
      items: [
        { exact: true, icon: icons.dashboard, label: "Tableau de bord", to: "/" },
        { icon: icons.documents, label: "Documents", to: "/documents" },
      ],
      label: "Général",
    },
    {
      create: { label: "Nouveau produit", onSelect: create.openProduct },
      id: "stock",
      items: [
        {
          active: isUnder("/produits"),
          badge: alertBadge(stockAlerts.value),
          icon: icons.products,
          label: "Produits",
          to: "/produits",
        },
        { icon: icons.movements, label: "Mouvements", to: "/stock/mouvements" },
      ],
      label: "Stock",
    },
    {
      create: { label: "Nouvelle vente", onSelect: () => create.openSale() },
      id: "sales",
      items: [
        { active: isUnder("/ventes"), icon: icons.sales, label: "Ventes", to: "/ventes" },
        {
          active: isUnder("/clients"),
          badge: alertBadge(criticalDebtors.value),
          icon: icons.customers,
          label: "Clients",
          to: "/clients",
        },
      ],
      label: "Ventes",
    },
    {
      create: { label: "Nouvelle commande", onSelect: () => create.openPurchase() },
      id: "purchases",
      items: [
        {
          active: isUnder("/achats") && !isUnder("/achats/fournisseurs"),
          badge: countBadge(ordersInProgress.value),
          icon: icons.purchases,
          label: "Commandes",
          to: "/achats",
        },
        { icon: icons.suppliers, label: "Fournisseurs", to: "/achats/fournisseurs" },
      ],
      label: "Achats",
    },
    {
      create: { label: "Nouvelle simulation", onSelect: create.openSimulation },
      id: "simulator",
      items: [
        {
          active: isUnder("/simulateur") && !isUnder("/simulateur/comparer"),
          icon: icons.simulations,
          label: "Simulations",
          to: "/simulateur",
        },
        { icon: icons.compare, label: "Comparer", to: "/simulateur/comparer" },
      ],
      label: "Simulateur",
    },
  ]);

  const settingsLink: NavigationMenuItem = {
    icon: icons.settings,
    label: "Paramètres",
    to: "/parametres",
  };

  return { criticalDebtors, sections, settingsLink, stockAlerts, summary };
};
