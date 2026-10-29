/**
 * Visite guidée de G-stock : les étapes (repères `data-tour` dans la barre latérale, la barre du
 * haut et l'en-tête de page) et la demande de lancement, partagée entre le menu du profil et
 * `AppTour`, qui l'affiche.
 */
export interface AppTourStep {
  /** Sélecteur du repère, ou `null` pour une étape au centre de l'écran. */
  target: string | null;
  title: string;
  body: string;
  side?: "top" | "right" | "bottom" | "left";
}

export const APP_TOUR_STEPS: AppTourStep[] = [
  {
    body: "En une minute, voici où trouver chaque chose. Flèches ← → pour avancer, Échap pour quitter.",
    target: null,
    title: "Bienvenue dans G-stock",
  },
  {
    body: "Produits, clients, ventes ou pages : tapez quelques lettres. Raccourci : Ctrl K.",
    side: "right",
    target: '[data-tour="search"]',
    title: "Tout retrouver",
  },
  {
    body: "Vos produits, leur stock lot par lot et chaque entrée ou sortie, avec les alertes de rupture.",
    side: "right",
    target: '[data-tour="nav-stock"]',
    title: "Le stock",
  },
  {
    body: "L'historique des ventes, ce qui reste à encaisser et le compte de chaque client.",
    side: "right",
    target: '[data-tour="nav-sales"]',
    title: "Ventes et clients",
  },
  {
    body: "Le + de chaque rubrique ouvre directement le formulaire : nouvelle vente, nouveau produit, nouvelle commande…",
    side: "right",
    target: '[data-tour="create-sales"]',
    title: "Créer en un clic",
  },
  {
    body: "Commandes aux fournisseurs, fret et frais d'approche : le prix de revient de chaque produit en découle.",
    side: "right",
    target: '[data-tour="nav-purchases"]',
    title: "Achats",
  },
  {
    body: "Estimez le prix de revient d'une commande avant de la passer, et comparez plusieurs scénarios.",
    side: "right",
    target: '[data-tour="nav-simulator"]',
    title: "Simulateur",
  },
  {
    body: "L'action principale de chaque page se trouve ici, en haut à droite.",
    side: "bottom",
    target: '[data-tour="page-actions"]',
    title: "Actions de la page",
  },
  {
    body: "Ruptures, stocks bas, clients en retard : le point rouge signale ce qui demande votre attention.",
    side: "bottom",
    target: '[data-tour="alerts"]',
    title: "Alertes",
  },
  {
    body: "Couleurs, police, arrondis et bibliothèque d'icônes. Le bouton « au hasard » propose un thème.",
    side: "bottom",
    target: '[data-tour="theme"]',
    title: "À votre goût",
  },
  {
    body: "Paramètres de l'entreprise, déconnexion, et cette visite à revoir quand vous voulez.",
    side: "bottom",
    target: '[data-tour="user"]',
    title: "Votre compte",
  },
  {
    body: "Le tableau de bord résume vos ventes, votre marge et vos créances : bon point de départ.",
    target: null,
    title: "C'est parti",
  },
];

/** La visite a été vue (terminée ou passée) dans ce navigateur. */
export const TOUR_DONE_KEY = "gstock-tour-done";

export const useAppTour = () => {
  // Chaque demande incrémente le compteur ; `AppTour` le surveille.
  const requests = useState("app-tour-requests", () => 0);
  const startTour = () => {
    requests.value += 1;
  };
  return { requests, startTour };
};
