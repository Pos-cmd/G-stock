/**
 * Captures de la documentation : la page, ce qu'on y fait avant la capture, et les éléments à
 * annoter. `find` est une expression évaluée dans la page, avec ces aides :
 * - `text(t)` : le plus petit élément dont le texte vaut exactement `t` ;
 * - `starts(t)` : le plus petit élément dont le texte commence par `t` ;
 * - `label(l)` : l'élément dont `aria-label` vaut `l` ;
 * - `tour(id)` : le repère `data-tour` de la visite guidée.
 * `before` s'exécute avant la capture (puis la page se recharge si `reload`), `after` juste avant.
 * Une note n'est gardée que si son élément est à l'écran (sinon le script le signale).
 */
export const SHOTS = [
  {
    alt: "Tableau de bord : cartes de chiffres, ventes du jour et meilleures ventes du mois",
    name: "tableau-de-bord",
    notes: [
      {
        find: `text("Marge brute · 30 j").closest(".rounded-xl").parentElement`,
        text: "**Cartes de chiffres** : les 30 derniers jours, comparés aux 30 précédents.",
      },
      {
        find: `starts("Ventes du jour").closest(".rounded-xl")`,
        text: "**Ventes du jour**, en direct : le cumul heure par heure, comparé à hier.",
      },
      {
        find: `starts("Meilleures ventes du mois").closest(".rounded-xl")`,
        text: "Les **meilleures ventes du mois**.",
      },
      {
        find: `tour("alerts")`,
        text: "**Alertes** : ruptures, stocks bas, clients en retard.",
      },
    ],
    path: "/",
    wait: "Ventes du jour",
  },
  {
    alt: "Liste des produits avec ventes, tendance, stock et couverture",
    name: "produits",
    notes: [
      {
        find: `text("Ruptures").closest("[role=tablist]")`,
        text: "Filtrer d'un clic : tous, en stock, stock bas, ruptures.",
      },
      {
        find: `document.querySelector('input[placeholder^="Produit"]').parentElement`,
        text: "**Recherche** (touche ++slash++), sans tenir compte des accents.",
      },
      {
        find: `text("13 sem.").parentElement`,
        text: "**Période** des ventes et de la tendance.",
      },
      {
        find: `label("Colonnes : afficher et réordonner")`,
        text: "**Colonnes** : les afficher, les masquer, les réordonner.",
      },
      {
        find: `text("Rupture")`,
        text: "**État du stock** de chaque produit.",
      },
    ],
    path: "/produits",
    wait: "Ruptures",
  },
  {
    alt: "Fiche d'un produit : informations, ventes mois par mois et lots",
    from: {
      link: 'tbody a[href^="/produits/"]',
      path: "/produits",
      wait: "Ruptures",
    },
    name: "produit-fiche",
    notes: [
      {
        find: `tour("page-actions")`,
        text: "**Modifier**, archiver, ou enregistrer une **entrée de stock**.",
      },
      {
        find: `starts("Informations").closest(".rounded-xl")`,
        text: "**Informations** : référence, prix conseillé, seuil d'alerte.",
      },
      {
        find: `starts("Mois par mois").closest(".rounded-xl")`,
        text: "Chiffre d'affaires, marge ou quantité, **mois par mois**.",
      },
    ],
    wait: "Informations",
  },
  {
    alt: "Historique des ventes avec ses totaux",
    name: "ventes",
    notes: [
      {
        find: `text("Chiffre d'affaires").closest(".rounded-xl").parentElement`,
        text: "**Totaux** de la sélection : ils suivent les filtres.",
      },
      {
        find: `text("Par produit").parentElement`,
        text: "Voir les ventes **une à une** ou **par produit**.",
      },
      {
        find: `text("Filtres").closest("button")`,
        text: "**Filtres** : période, produit, statut, paiement.",
      },
      {
        find: `text("Reste dû")`,
        text: "Ce que le client **doit encore** sur cette vente.",
      },
    ],
    path: "/ventes",
    wait: "Par produit",
  },
  {
    alt: "Formulaire de nouvelle vente",
    before: `text("Nouvelle vente").closest("button,a").click()`,
    name: "nouvelle-vente",
    notes: [
      {
        find: `label("Ouvrir en pleine page")`,
        text: "**Pleine page** : le même formulaire, sur toute la fenêtre.",
      },
      {
        find: `text("À crédit").closest("label, button, [role=radio]") ?? text("À crédit")`,
        text: "**Comptant** ou **à crédit**, avec un acompte.",
      },
    ],
    path: "/ventes",
    settle: 1500,
    wait: "Par produit",
  },
  {
    alt: "Détail d'une vente : montants, remises et paiements",
    from: {
      link: 'tbody a[href^="/ventes/"]',
      path: "/ventes",
      wait: "Par produit",
    },
    name: "vente-fiche",
    notes: [
      {
        find: `tour("page-actions")`,
        text: "**Reçu PDF**, envoi par **WhatsApp**, et autres actions.",
      },
      {
        find: `starts("Montants").closest(".rounded-xl")`,
        text: "**Montants** : total, remises, marge.",
      },
    ],
    wait: "Paiements de cette vente",
  },
  {
    alt: "Liste des clients avec leurs achats et leur solde",
    name: "clients",
    notes: [
      {
        find: `text("Débiteurs").closest("[role=tablist]")`,
        text: "**Débiteurs** : seulement les clients qui doivent de l'argent.",
      },
      {
        find: `label("Trier par Solde")`,
        text: "**Solde** : ce que le client doit, toutes ventes confondues.",
      },
    ],
    path: "/clients",
    wait: "Débiteurs",
  },
  {
    alt: "Commandes fournisseurs avec leur statut et leur paiement",
    name: "commandes",
    notes: [
      {
        find: `text("Tous les statuts").closest("[data-slot=root], button")`,
        text: "Filtrer par **statut** ou par **fournisseur**.",
      },
      {
        find: `label("Trier par Prix de revient")`,
        text: "**Prix de revient** : marchandise et frais d'approche.",
      },
      {
        find: `label("Trier par Paiement")`,
        text: "Ce qui est **payé au fournisseur**, et ce qui reste.",
      },
    ],
    path: "/achats",
    wait: "Tous les statuts",
  },
  {
    alt: "Fiche d'une commande : produits, frais d'approche et prix de revient",
    from: {
      link: 'tbody a[href^="/achats/0"]',
      path: "/achats",
      wait: "Tous les statuts",
    },
    name: "commande-fiche",
    notes: [
      {
        find: `tour("page-actions")`,
        text: "**Statut** de la commande, **fiche PDF**, **réception** en stock.",
      },
      {
        find: `starts("Produits commandés").closest(".rounded-xl")`,
        text: "**Produits commandés**, dans la devise du fournisseur.",
      },
    ],
    wait: "Frais d'approche",
  },
  {
    alt: "Simulation : achat, frais d'approche, prix de revient et vente",
    from: {
      link: 'tbody a[href^="/simulateur/0"]',
      path: "/simulateur",
      wait: "Nouvelle simulation",
    },
    name: "simulation",
    notes: [
      {
        find: `tour("page-actions")`,
        text: "**Créer la commande** à partir de la simulation, ou l'exporter en **PDF**.",
      },
      {
        find: `text("Achat").closest(".rounded-xl")`,
        text: "**Achat** : produits, quantités, prix en devise.",
      },
    ],
    wait: "Frais d'approche",
  },
  {
    after: `document.activeElement?.blur()`,
    alt: "Menu des thèmes : thèmes prêts à l'emploi, couleurs, police et icônes",
    before: `tour("theme").querySelector("button").click()`,
    name: "themes",
    notes: [
      {
        find: `text("Thèmes").parentElement`,
        text: "**Thèmes** prêts à l'emploi, ou un thème **au hasard**.",
      },
    ],
    path: "/",
    settle: 900,
    wait: "Ventes du jour",
  },
  {
    alt: "Choix des colonnes d'un tableau, à cocher et à glisser",
    before: `label("Colonnes : afficher et réordonner").click()`,
    name: "colonnes",
    notes: [
      {
        find: `document.querySelector('[role="dialog"] ul')`,
        text: "**Cocher** pour afficher, **glisser** pour réordonner (ou ++alt+up++ / ++alt+down++).",
      },
    ],
    path: "/produits",
    settle: 900,
    wait: "Ruptures",
  },
  {
    after: `for (let step = 0; step < 2; step++) window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))`,
    alt: "Visite guidée : l'étape « Le stock » et son repère éclairé",
    before: `localStorage.removeItem("gstock-tour-done")`,
    name: "visite-guidee",
    notes: [],
    path: "/",
    reload: true,
    settle: 2800,
    wait: "Ventes du jour",
  },
  {
    alt: "Paramètres : taux de change, créances, entreprise et sauvegarde",
    name: "parametres",
    notes: [
      {
        find: `text("Taux de change").closest(".rounded-xl")`,
        text: "**Taux de change** des devises fournisseurs.",
      },
    ],
    path: "/parametres",
    wait: "Taux de change",
  },
];
