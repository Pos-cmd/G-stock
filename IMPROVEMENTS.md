# G-Stock - Améliorations Futures

_Liste des features et améliorations à implémenter - Mise à jour: 2026-10-30_

---

## 🌐 Internationalisation & Accessibilité

### Badges avec Explications

- [ ] Ajouter des tooltips/hover sur chaque badge (relancer, état critique, etc.)
- [ ] Expliquer l'information retransmise par chaque badge
- **Proposition**: Installer `i18n` pour rendre les textes dynamiques et maintenables
- **Exemple**: Badge "Relancer" → hover affiche "La relance est nécessaire pour ce client dans les `{{jours}}` prochains"

---

## 📊 Page Détails Client

### Recherche & Filtrage dans le Tableau

- [ ] Ajouter recherche dans la barre de recherche principale (pas seulement dans le filtre)
- [ ] Permettre la recherche de produits directement depuis le tableau (le sélecteur existe, mais la barre doit aussi chercher)
- [ ] Problème observé: Quand on sélectionne un élément dans le filtre, d'autres éléments s'affichent aussi

### Actions de Filtrage

- [ ] Ajouter bouton "Réinitialiser filtres" rapide (dans la barre, pas dans le bouton filtre)
- [ ] Afficher les filtres appliqués actuellement (chip/tags)
- [ ] Faciliter la réinitialisation au lieu de faire un par un
- **Note**: À auditer ensuite avec `data-display-and-selection`, `impeccable` et `wcag-accessibility`

### Tableau Paiements

- [ ] Créer tableau dédié pour les paiements
- [ ] Ajouter filtres par date
- [ ] Ajouter filtres par vente
- [ ] Pouvoir chercher une date spécifique pour retrouver un paiement

---

## 🎯 Pages Détails Générales

### Actions Flottantes (Sticky Actions)

- [ ] Créer composant bouton flottant pour les actions (comme NaiveUI FloatButton)
- [ ] Le bouton apparaît quand l'en-tête avec les actions scroll hors de vue
- [ ] Permet un accès facile aux actions sans scroller jusqu'en haut
- **Référence**: https://www.naiveui.com/en-US/components/float-button

---

## 💰 Page Créanciers en Cours

### Barre de Stats

- [ ] Ajouter barre de progression pour les créanciers
- [ ] Afficher la vente totale cible
- [ ] Afficher la progression actuelle vers l'objectif
- [ ] Visualiser le pourcentage complété
- **Type de composant**: Chart/Stats bar

---

## 📦 Page Produits

### Gestion de l'Archive

- [ ] Quand un produit est archivé, identifier lequel a changé d'état
- [ ] Ajouter une colonne "État" (Actif/Archivé)
- [ ] OU Ajouter un filtre pour voir uniquement les produits archivés
- [ ] Problème actuel: On ne sait pas quel produit vient d'être archivé

### Multiselect dans Tableaux

- [ ] Permettre la sélection multiple dans les sélecteurs du tableau

---

## 🔄 Page Détails Produits - Mouvement

### Filtrage & Recherche

- [ ] Ajouter filtre par date
- [ ] Ajouter filtre par période
- [ ] Ajouter recherche par nom de client (testé, ne fonctionne pas actuellement)

### Tri dans l'En-tête (Inline Sort)

- [ ] Déplacer le tri/filtre du bouton "Filtrer" vers l'en-tête du tableau
- [ ] Cliquer sur une colonne → affiche un menu avec les options de tri
- [ ] **Exemple**: Colonne "Type" → checkbox pour chaque type disponible
- [ ] Généraliser au datatable partagé, pas seulement à cette page
- **Note**: Meilleure UX/UI que le filtre traditionnel en haut

---

## 🔍 Moteur de Recherche Global

### Intégration Typesense / Meilisearch

- [ ] Remplacer la recherche actuelle par une solution plus robuste
- [ ] Problème actuel: "glaciere" (sans accent) ou "claciere" (faute de frappe) ne trouve pas "glacière"
- [ ] Support de la recherche floue (fuzzy search)
- [ ] Amélioration des performances pour grandes listes
- [ ] Gestion des accents et variantes
- **Candidats**: Typesense, Meilisearch, Algolia

---

## 📈 Dashboard & Landing

### Stats sur le Dashboard

- [ ] Reprendre les stats de l'en-tête de la landing page
- [ ] Les intégrer à plusieurs endroits du dashboard
- [ ] Afficher les KPI principaux en évidence

---

## 💱 Devise explicite sur les champs de montant

### Principe

- [ ] Tout champ de prix ou de frais doit **dire dans quelle devise il est saisi** et permettre de la choisir
- [ ] Aujourd'hui, plusieurs champs ont la devise figée jusque dans le nom de la colonne (`referencePriceRmb`, `freightRatePerCbmFcfa`, `otherFeesFcfa`…) : impossible d'enregistrer un prix fournisseur en USD ou un fret en RMB
- [ ] Le modèle à suivre existe déjà : `purchase_order_fees` stocke `amount` + `currency` + `amountFcfa` (conversion aux taux de la commande), et l'écran de réception propose déjà un sélecteur de devise par frais
- **Priorité**: Moyenne-haute — la devise est au cœur du circuit Chine → Afrique de l'Ouest (cf. `PRODUCT.md`)

### Endroits concernés

| Écran | Champ | Aujourd'hui | À faire |
| --- | --- | --- | --- |
| Produits | Prix d'achat de référence (`referencePriceRmb`) | RMB figé, aide en FCFA | Devise au choix (RMB / USD / FCFA) |
| Produits | Prix de vente conseillé (`suggestedSalePriceFcfa`) | FCFA figé | FCFA par défaut, devise modifiable |
| Commande fournisseur | Coût par CBM (`freightRatePerCbmFcfa`) | FCFA entier seulement, alors que le fret se paie en USD | FCFA / USD / RMB |
| Commande fournisseur | Transport local, Autres frais (`localTransportFcfa`, `otherFeesFcfa`) | FCFA figé | Devise au choix |
| Commande fournisseur | Prix de ligne + base (`/ unité`, `/ tonne`) | Devise de la commande, mais le couple input/select est un `flex gap-1` | Reprendre le couple dans un `UFieldGroup` |
| Simulateur | Coût par CBM et frais libres | FCFA, incohérent avec l'écran de réception qui gère déjà les devises | Aligner sur le même composant |

### Composant & UX (Nuxt UI 4)

- [ ] Utiliser `UFieldGroup` pour coupler le sélecteur de devise et le champ numérique dans **un seul contrôle visuel**
- [ ] Structure : un seul `UFormField` (un label, un message d'erreur) contenant `UFieldGroup` → `USelect` (devise, largeur fixe, ex. `w-24`) + `UInputNumber` (`min-w-0 flex-1`)
- [ ] Le select porte un `aria-label` explicite (« Devise du prix de référence ») : le sens ne doit pas dépendre de la seule couleur ou position
- [ ] Aide sous le champ : **montant converti en FCFA avec le taux employé** (« ≈ 1 209 600 FCFA au taux 7,2 RMB/USD · 620 FCFA/USD »), ce qui remplace le texte actuel de `ProductFormModal`
- [ ] Placeholder cohérent : le placeholder ne doit plus afficher un symbole de devise (« 16,80 » et non « 16,80 $ »), puisque la devise est choisie juste à côté
- [ ] Changer la devise **convertit la valeur** au lieu de la remettre à zéro, et ne perd jamais la saisie
- [ ] Désactiver le sélecteur quand la devise est déjà figée par l'historique (même logique que `currencyLocked` sur une commande qui a des versements)
- [ ] Réutiliser les formats existants (`FCFA_FORMAT`, `RMB_FORMAT`, `supplierPriceFormat`) pour les séparateurs et les décimales

### Données & schéma

- [ ] Suivre le modèle de `purchase_order_fees` : montant d'origine + devise + montant converti + taux utilisé ; ne jamais stocker un montant nu
- [ ] Garder la colonne FCFA comme **valeur canonique calculée**, et ajouter `currency` + `amount` d'origine aux tables concernées (`products`, `purchase_orders`)
- [ ] Attention à `referencePriceOf()` dans `PurchaseOrderForm.vue` : le prix de référence pré-remplit une ligne de commande, il devra être converti dans la devise de la commande (aujourd'hui il ne pré-remplit que les commandes en RMB)
- [ ] Migration Drizzle + snapshot, puis mise à jour du seed de démo (`packages/api/scripts/seed-demo.ts`)

### Critères d'acceptation

- [ ] On peut enregistrer un prix de référence en RMB, en USD ou en FCFA
- [ ] Le champ affiche la conversion en FCFA avec le taux utilisé
- [ ] Changer de devise deux fois de suite donne le même montant FCFA (pas de dérive d'arrondi)
- [ ] Les commandes déjà enregistrées conservent leur devise et leurs montants
- [ ] Erreur de validation portée par le groupe, focus clavier visible, libellé unique pour les lecteurs d'écran
- [ ] Vérifié avec : valeur vide, `0`, très grand montant, devise changée en cours de saisie
- **Note**: à auditer ensuite avec `form-design`, `component-family-consistency` et `wcag-accessibility`

---

## 🧾 Dépenses de commande (au-delà des frais d'approche)

### Constat

- [ ] Aujourd'hui une commande ne connaît que deux choses : l'**estimation** (`freightCbm`, `freightRatePerCbmFcfa`, `localTransportFcfa`, `otherFeesFcfa`) et les **frais réels** saisis à la réception (`purchase_order_fees`)
- [ ] Tout le reste de l'argent réellement sorti pour la commande n'existe nulle part : frais de virement TT et commission de change, frais de dossier bancaire, transport fournisseur → entrepôt Yiwu, inspection qualité, surestaries et entreposage au port, honoraires du transitaire, assurance, déplacements, emballage
- [ ] Conséquence : la marge affichée est trop belle. La promesse « la vraie marge d'abord » (`PRODUCT.md`) n'est pas tenue sur ces montants
- **Priorité**: Haute — c'est de l'argent dépensé qu'on ne retrouve pas

### Modèle proposé

- [ ] Créer une entité **dépense de commande** : date de dépense, libellé, catégorie, montant + devise, taux appliqué et montant converti en FCFA, bénéficiaire, moyen de paiement, référence de la pièce (reçu, facture)
- [ ] Catégories de départ : `Frais bancaires`, `Transport amont`, `Inspection`, `Assurance`, `Entreposage / surestaries`, `Transitaire`, `Déplacement`, `Autre`
- [ ] Chaque dépense porte un drapeau **« incorporer au prix de revient »** : oui = elle entre dans le coût des lots, non = c'est une charge de l'opération, visible dans la marge mais pas dans la valeur du stock
- [ ] Une dépense ne se supprime jamais : elle s'**annule** avec un motif, comme les versements fournisseurs (`supplier_payments.cancelledAt` / `cancelReason`)
- [ ] Option : rattacher les frais bancaires directement à un **versement** (`supplier_payments`) plutôt que de les saisir à part
- **Note technique** : soit une nouvelle table `purchase_order_expenses`, soit unifier frais + dépenses dans `purchase_order_costs` avec un champ `kind` (`fee` | `expense`). L'unification évite deux écrans qui se ressemblent et un risque de double saisie — à trancher avant la migration.

### Règles à ne pas casser

- [ ] **Pas de double comptage** avec `purchase_order_fees` : un frais est par définition incorporé au coût ; une dépense ne l'est que si le drapeau est coché. Avertir si un libellé et un montant identiques existent déjà dans les deux listes
- [ ] Les lots sont **figés à la réception** (`received_goods_fcfa`) : une dépense incorporable saisie _après_ la réception ne peut plus modifier le coût unitaire. Dans ce cas : soit la saisie devient une charge, soit elle crée un ajustement de valeur explicite (mouvement de stock), jamais un recalcul silencieux
- [ ] Toute dépense en USD ou en RMB est convertie avec le **taux de la commande**, comme les frais de réception
- [ ] Une dépense saisie mais non payée doit être distinguable d'une dépense réglée (à prévoir, sinon le total « dépensé » mentirait)

### Écrans

- [ ] Fiche commande : deux blocs distincts, « Frais d'approche (dans le prix de revient) » et « Dépenses de la commande (hors stock) », avec le total de chacun
- [ ] Carte de synthèse : prix de revient du stock **+** dépenses non incorporées **=** coût complet de l'opération, et la marge nette qui en découle
- [ ] Une dépense peut être ajoutée à tout moment de la vie de la commande (avant la commande, pendant le transit, après la réception)
- [ ] Plus tard : vue « dépenses par catégorie » sur le dashboard, et liste filtrable dans la fiche commande

### Critères d'acceptation

- [ ] Je peux enregistrer les frais de virement de mon TT et ils apparaissent dans le coût complet sans toucher au coût unitaire du stock
- [ ] Une dépense incorporable saisie avant la réception augmente bien le coût unitaire des lots
- [ ] Une dépense saisie après la réception est refusée en mode « incorporer » avec un message qui explique pourquoi
- [ ] Le total « coût complet » ne compte jamais deux fois le même montant
- [ ] Chaque dépense est traçable : qui l'a saisie, quand, avec quelle pièce justificative

---

## 🔀 Répartition des frais visible à la réception

### Constat

- [ ] La réception permet déjà de choisir une répartition **par frais** (`allocationMethod` sur chaque ligne) et affiche déjà « Part des frais », « Coût unitaire » (avec l'estimé) et « Valeur en stock » par produit
- [ ] Mais le choix global vient de la commande : il n'est pas repris ni modifiable en un geste dans la réception, et il n'y a pas de « appliquer à tous les frais »
- [ ] On ne voit **pas comment** le montant est réparti : quelle base est utilisée (voyages, poids, valeur), quel poids pèse chaque ligne, quel pourcentage et quel montant il reçoit, et si l'arrondi tombe juste
- [ ] Impossible de **comparer** deux répartitions avant de valider : on valide à l'aveugle sur l'impact réel du coût unitaire
- [ ] Le dialogue « Valider la réception ? » n'affiche qu'un nombre de lots et une valeur globale, pas les prix de revient produit par produit
- **Priorité**: Moyenne-haute — c'est le dernier écran avant que le coût soit figé dans le stock

### Choix de la répartition

- [ ] Bloc « Répartition » en haut de la réception : sélecteur global (au prorata des voyages / parts égales / au prorata du poids / au prorata de la valeur) + bouton **« Appliquer à tous les frais »**
- [ ] Pré-remplir avec la répartition de la commande, en indiquant clairement l'origine (« reprise de la commande »)
- [ ] Conserver l'override par frais, avec un badge « personnalisé » sur les lignes qui ne suivent pas le choix global
- [ ] Afficher, pour chaque frais, la base retenue en clair (« réparti au prorata des voyages : 500 et 50 »)
- [ ] Bloquer le choix « au prorata du poids » tant que toutes les lignes n'ont pas de poids (l'alerte existe déjà, la rendre bloquante plutôt qu'avertissante)

### Aperçu du calcul (avant validation)

- [ ] Tableau dépliable par frais : base, poids de chaque ligne, pourcentage, montant FCFA attribué, et **total = montant du frais** (contrôle visuel de l'arrondi au franc près)
- [ ] Vue « Prix de revient final » par produit : marchandise / part des frais / total / coût unitaire sur la quantité reçue / valeur du lot, avec colonne **estimé** et **écart** en FCFA et en pourcentage
- [ ] Bandeau d'écart global : réel vs estimé à la commande, et contribution de chaque frais à l'écart
- [ ] Petit comparateur : le coût unitaire de chaque produit sous deux répartitions, côte à côte, sans enregistrer
- [ ] Dialogue « Valider la réception ? » : lister **chaque produit avec son coût unitaire final et la valeur du lot**, plus le total, avant le bouton « Mettre en stock »
- [ ] Garde-fous avant validation : frais avec libellé mais montant à 0, ligne reçue à 0, écart de quantité important — avertir, sans bloquer ce qui est légitime

### Contraintes techniques

- [ ] L'aperçu doit continuer d'utiliser la **même fonction que le serveur** (`computeLandedCostsFromFees` dans `packages/core/src/purchasing.ts`) : ce qui est affiché doit être exactement ce qui sera enregistré
- [ ] La répartition par frais est déjà stockée (`purchase_order_fees.allocation_method`) : pas de migration nécessaire pour ce point
- [ ] Ne pas perdre la saisie en cours lors d'un rafraîchissement de la commande (le formulaire est déjà initialisé une seule fois)
- [ ] Rappeler dans l'interface qu'après validation le coût est figé et que les écarts se corrigent par un ajustement de lot

### Critères d'acceptation

- [ ] Je choisis « au prorata de la valeur » et tous les frais basculent, sauf ceux que j'avais personnalisés
- [ ] Je vois, pour chaque frais, la somme des parts par ligne égale au montant du frais
- [ ] Je vois les coûts unitaires finaux des deux produits dans le dialogue de confirmation
- [ ] Changer de répartition met à jour l'aperçu sans rien enregistrer, et quitter la page sans valider ne fige rien
- [ ] Le montant total mis en stock après validation est identique au total affiché dans l'aperçu

---

## 🛠️ Achats : corriger une commande déjà réceptionnée

### Constat

- [ ] Après « Mettre en stock », la commande est figée : une date d'entrée en stock erronée, un frais oublié ou une quantité mal saisie ne se corrigeaient qu'à la main en base
- [ ] Le seul contournement était l'ajustement de lot, qui corrige la quantité mais **pas** la date d'entrée en stock, **pas** les frais, donc pas le coût de revient déjà réparti sur les lots
- [ ] La commande affichait donc une date d'entrée en stock qui contredisait les mouvements de stock du produit — un même fait raconté deux fois, différemment
- **Priorité**: Haute — une erreur de saisie à la réception contamine le coût de revient, le FIFO et tous les écrans de stock

### À faire

- [ ] Écran de correction accessible depuis la commande réceptionnée, reprenant la réception (date, quantités reçues, frais, répartition) avec un **motif obligatoire**
- [ ] Recalculer la répartition des frais et réécrire **lots et mouvements d'entrée** correspondants (quantité, date, coût unitaire), sans toucher au stock vendu
- [ ] Journal des corrections sur la commande : date, auteur, motif, récapitulatif lisible

### Contraintes techniques

- [ ] La base de répartition reste `receivedGoodsFcfa` (marchandise figée à la réception) : on re-répartit les frais et les quantités **sur** cette valeur, sans réinventer le coût d'achat
- [ ] Une quantité corrigée ne peut pas passer **sous** ce qui est déjà sorti des lots (refus explicite, avec le restant consommé)
- [ ] Le coût d'une vente déjà enregistrée reste gelé (`sale_item_lots.unit_cost_fcfa`) : corriger une commande ne réécrit pas la marge passée
- [ ] Une correction de date **réordonne** les lots pour les prochaines sorties FIFO : c'est voulu, mais l'interface doit le dire

### Critères d'acceptation

- [ ] Je corrige la date d'entrée en stock du 31 oct au 5 juil : les mouvements de stock de la commande portent la bonne date
- [ ] J'ajoute un frais oublié de 1 000 000 FCFA : les coûts unitaires des lots suivent, les mouvements aussi
- [ ] La correction est refusée en dessous de la quantité déjà vendue, avec un message clair
- [ ] La marge d'une vente antérieure ne bouge pas d'un franc
- [ ] Je relis le motif et le récapitulatif dans le journal de la commande

### État livré (v1)

- [x] `purchases.correct` : frais, quantités reçues, date d'entrée en stock, motif — les lots et les mouvements d'entrée sont réécrits, le stock vendu n'est pas touché
- [x] Journal `purchase_revisions` (date, auteur, motif, récapitulatif « 5 lots · 5 mouvements mis à jour · 1 350 000 FCFA ») sur la fiche commande
- [x] La page de réception fait aussi écran de correction quand la commande est déjà réceptionnée : bandeau d'avertissement, motif obligatoire, date pré-remplie avec la date enregistrée
- [x] Garde-fous : quantité refusée sous le déjà-vendu, commande annulée refusée, commande non réceptionnée refusée
- [ ] Reste à faire : corriger une ligne oubliée sur une réception multi-produits sans repasser par tout le formulaire (ajout rapide depuis la commande), et joindre une pièce justificative à la correction

---

## ✏️ Ventes : modifier après enregistrement

### Constat

- [ ] Une vente enregistrée n'est plus modifiable : `createSale` sait seulement créer, `cancelSale` annule **en totalité** (lignes rendues aux lots, paiements annulés, statut `cancelled`, motif tracé)
- [ ] En pratique on vend, puis on s'aperçoit qu'on a oublié une ligne, ou qu'une quantité est fausse. Aujourd'hui la seule issue est d'annuler et de refaire : on perd la référence, le reçu déjà remis au client et l'ordre réel des opérations
- [ ] Les briques existent déjà : `sale_item_lots` garde le lot et le coût exact de chaque ligne, `consumeFifo` pour ajouter, `returnToLots` pour retirer
- **Priorité**: Haute — besoin quotidien au comptoir

### Ce qui doit être possible

- [ ] **Compléter une vente** : ajouter une ligne oubliée (produit, quantité, prix) → nouveau `sale_item` + prélèvement FIFO, total et dû recalculés
- [ ] **Corriger une ligne** : changer la quantité ou le prix unitaire ; seule la **différence** bouge en stock (le complément sort des lots, ou y retourne)
- [ ] **Retirer une ligne** : la quantité revient dans **ses** lots d'origine (`returnToLots`), pas dans le lot le plus récent
- [ ] **Modifier l'en-tête** : client, date, note, type de paiement
- [ ] Le **coût de revient d'une ligne reste celui des lots prélevés** : on ne réécrit pas l'histoire du stock pour faire joli

### Traçabilité (obligatoire)

- [ ] Aucune modification silencieuse : chaque opération écrit un **motif** et laisse une trace datée et nominative (comme `sale_discounts` et `sales.cancel_reason`)
- [ ] Conserver l'état **avant / après** de chaque version de la vente (table `sale_revisions` : date, auteur, motif, récapitulatif des lignes) — cohérent avec la promesse « rien ne se perd »
- [ ] Les mouvements de stock générés portent la référence de la vente et un motif explicite (« Complément vente V-2026-0012 : 2 × Grillage galvanisé »), pour les retrouver dans `stock_movements`
- [ ] Le reçu PDF régénéré remplace le fichier existant : prévoir d'indiquer la **date de dernière modification** sur le reçu, et prévenir si un reçu a déjà été envoyé au client

### Garde-fous

- [ ] Vente **annulée** = figée, aucune modification
- [ ] Vente ayant déjà une **reprise** : les quantités modifiables sont plafonnées à ce qui reste réellement vendu
- [ ] Ajouter une ligne sans stock suffisant : refus explicite (le message FIFO existant suffit)
- [ ] Un paiement ou un acompte qui **dépasse** le nouveau total : bloquer, en proposant un remboursement ou un avoir
- [ ] Une remise déjà accordée qui dépasse le nouveau total : refuser et expliquer
- [ ] Produit archivé : interdit à l'ajout (déjà le cas à la création)
- [ ] Recalculer les agrégats : `invalidateLedgers()` + invalidation des caches de vente, de stock et du dashboard

### Écrans

- [ ] Fiche vente : bouton **« Modifier »** (ou « Compléter la vente ») dans les actions, à côté de « Annuler la vente »
- [ ] Réutiliser le formulaire de vente existant, en mode édition, avec un bandeau « Vente du … — modification »
- [ ] Après enregistrement : récapitulatif des différences (« + 2 carte louvre 7B · total 12 000 → 27 600 FCFA · dû client 5 000 → 20 600 FCFA »)
- [ ] Historique des modifications visible sur la fiche vente

### Critères d'acceptation

- [ ] J'ajoute une ligne oubliée à une vente existante : le stock baisse de la bonne quantité, le total et le dû suivent
- [ ] Je corrige 10 → 12 unités : seules 2 unités sortent des lots
- [ ] Je passe 10 → 8 unités : 2 unités retournent dans le lot d'origine, au coût d'origine
- [ ] Chaque modification est datée, motivée et attribuée à un utilisateur
- [ ] Une vente annulée ne peut plus être modifiée
- **Note technique** : `sales.update` / `sales.addLines` côté API ; la difficulté n'est pas le stock mais la cohérence du dû (ventes − remises − reprises − paiements) et des documents déjà émis

### État livré (v1)

- [x] `sales.update` : lignes ajoutées, quantités corrigées, lignes retirées, prix, date, note — seule la **différence** bouge en stock (`consumeFifo` pour le complément, `returnToLots` pour le retrait), coût de revient recalculé depuis les lots restants
- [x] Motif obligatoire et journal `sale_revisions` (date, auteur, motif, récapitulatif « + 1 Bazin · total 3 000 → 3 900 FCFA ») affiché sur la fiche vente
- [x] Garde-fous : vente annulée refusée, stock insuffisant refusé, remises supérieures au nouveau total refusées, produit archivé refusé
- [x] Écran **Modifier la vente** depuis les actions de la fiche, avec total actuel, nouveau total et écart
- [ ] Reste à faire : changer le client d'une vente, régénérer le reçu PDF avec la date de dernière modification, KPI « ventes modifiées »
- **Écart assumé** : la vente est bien corrigée (quantités réduites) plutôt que conservée intacte avec une pièce annexe. C'est ce qui garde **tous** les agrégats justes d'un coup — tableau de bord, marge produit, ventes par période — sans dupliquer chaque calcul ; la trace avant/après vit dans `sale_revisions` et le détail du retour dans `sale_returns`

---

## ↩️ Reprises (retours partiels d'une vente)

### Constat

- [ ] Le client rapporte une partie seulement de ce qu'il a acheté (5 galva sur 10). Aujourd'hui : soit on annule toute la vente (faux, et ça efface une vente réelle), soit on ne saisit rien et le stock devient faux
- [ ] Rien dans le schéma ne représente une reprise : `SALE_STATUSES = ["active", "cancelled"]` ne connaît que tout ou rien
- [ ] Le coût de revient est justement traçable au lot près (`sale_item_lots`), donc une reprise peut remettre la marchandise **exactement là d'où elle est sortie** : c'est la bonne base
- **Priorité**: Haute — un retour non saisi casse à la fois le stock et la marge

### Modèle proposé

- [ ] Nouvelle entité **reprise** rattachée à une vente, avec ses lignes : date, motif (obligatoire), produit, quantité, prix de reprise, montant total, auteur
- [ ] La vente d'origine **n'est jamais réécrite** : elle reste affichée avec ses quantités vendues, la reprise apparaît en dessous (même logique que `sale_discounts`)
- [ ] Plafond par ligne : `quantité reprise ≤ quantité vendue − quantités déjà reprises` (cumulable sur plusieurs reprises)
- [ ] **État de la marchandise** : `revendable` (retour au stock) ou `abîmée` (aucun retour au stock, tracée comme perte) — un article revenu cassé ne doit pas réapparaître en stock
- [ ] Retour au stock dans les **lots d'origine**, au coût d'origine (`returnToLots` existe déjà et fait exactement ça)
- [ ] Traitement financier au choix : **avoir** (réduction du dû client), **remboursement** (sortie d'espèces / mobile money / banque), ou **échange** (avoir + nouvelle vente liée)
- [ ] Le montant repris se calcule **au prix de ligne** ; ne pas répartir automatiquement une remise antérieure, sauf choix explicite (à trancher, sinon les comptes deviennent faux)

### Traçabilité

- [ ] Nouveau type de mouvement de stock pour les reprises : `MOVEMENT_TYPES` et `MOVEMENT_REFERENCE_TYPES` n'ont pas de valeur dédiée (`in` / `sale` servent déjà à l'annulation, on ne saurait pas distinguer une reprise d'une annulation)
- [ ] La page **Mouvements** doit pouvoir filtrer « reprises » et remonter à la vente d'origine
- [ ] Le solde du client intègre les reprises : aujourd'hui il est calculé (ventes − remises − paiements) via `saleDiscountSql` ; il faut son pendant `saleReturnSql`
- [ ] La marge de la vente et du produit doit refléter la reprise (CA et coût diminuent de la même quantité)
- [ ] Ajouter « Bon de reprise » aux types de documents (`DOCUMENT_TYPES`), imprimable et envoyable sur WhatsApp comme le reçu

### Règles à ne pas casser

- [ ] Une reprise **ne supprime jamais** une ligne de vente ni un paiement : elle crée un mouvement inverse et, si besoin, un avoir
- [ ] Une vente **annulée** ne peut pas recevoir de reprise ; une vente **avec reprise** ne devrait plus être annulable en totalité (ou l'annulation doit d'abord remettre la reprise en cause — à trancher explicitement)
- [ ] Reprise d'un produit vendu à la pièce (carton ouvert) : convertir avec `piecesPerUnit` et rendre au bon lot
- [ ] Refuser une quantité supérieure au restant vendu, avec un message clair (« 5 déjà repris sur 10 »)
- [ ] Reprise d'un produit depuis archivé : autorisée (c'est un retour, pas une vente)

### Écrans

- [ ] Fiche vente : bouton **« Reprise »**, et un bloc « Reprises » listant chaque retour (date, lignes, montant, motif, avoir ou remboursement)
- [ ] Formulaire de reprise : lignes pré-remplies avec le restant reprisable, quantité, état (revendable / abîmée), montant, mode de règlement, motif obligatoire
- [ ] Aperçu avant validation : impact stock, impact dû client, impact marge (« le client doit 8 000 → 4 000 FCFA »)
- [ ] Vue client : les reprises apparaissent dans le relevé, avec le motif
- [ ] Vue produit : les reprises apparaissent dans les mouvements, distinguées des ventes
- [ ] Dashboard : KPI « reprises de la période », en valeur et en quantité, pour voir si un produit revient trop souvent

### Critères d'acceptation

- [ ] Je vends 10 galva, je reprends 5 revendables : le stock remonte de 5 dans le lot d'origine, la vente affiche 10 vendus puis 5 repris, le dû client baisse d'autant
- [ ] Je reprends 5 abîmés : le stock ne bouge pas, la perte est tracée avec son motif
- [ ] Une deuxième reprise sur la même ligne est plafonnée à 5
- [ ] Le montant de la reprise se retrouve dans le relevé du client et dans les mouvements de stock
- [ ] Annuler une vente qui a une reprise produit un comportement explicite, jamais un stock négatif ou doublé
- [ ] Le bon de reprise est généré en PDF et contient la référence de la vente d'origine

### Découpage conseillé

1. Compléter une vente (ajouter une ligne) — le besoin le plus fréquent
2. Corriger quantité / prix avec motif et historique
3. Reprise revendable, retour au lot d'origine, avoir sur le dû
4. Reprise d'articles abîmés + perte tracée
5. Bon de reprise PDF et envoi WhatsApp

### État livré (v1)

- [x] Tables `sale_returns` (date, motif, montant, mode de règlement, auteur) et `sale_return_items` (article, quantité, prix de ligne, remise en stock ou non)
- [x] `sales.return` : reprise partielle ou totale, plafonnée au restant vendu, cumulable sur plusieurs reprises ; la marchandise revient dans ses **lots d'origine au coût d'origine**, ou reste dehors quand elle est abîmée (`restocked: false`)
- [x] Règlement au choix : **avoir** gardé pour le client (`credit`, la vente baisse et le crédit apparaît) ou **argent rendu** (`cash`, `mobile_money`, `bank`) — le remboursement sort alors des encaissements du client, en priorité sur les paiements de la vente concernée
- [x] Écran **Reprendre des articles** depuis la fiche vente : quantités par ligne, interrupteur « remettre en stock », date, motif, mode de règlement, montant repris et reste dû après reprise
- [x] Bloc **Reprises** sur la fiche vente, ligne **Reprise …** dans les mouvements de stock (client résolu comme pour une vente) et entrée dans le journal des modifications
- [x] Raccourci **Vendre à un autre client** : ouvre `/ventes/nouvelle` avec les articles repris déjà remplis
- [x] `cancelSale` reste juste après une reprise : les allocations ont été réduites, donc l'annulation ne rend que ce qui est encore vendu
- [ ] Reste à faire : type de mouvement dédié (`sale_return`), filtre « reprises » sur la page Mouvements, bon de reprise PDF, KPI dashboard
- **Écart assumé** : pas d'échange en une seule opération — le raccourci « Vendre à un autre client » fait le travail en deux écrans, sans inventer une écriture comptable que personne ne relira

---

## 🕒 Date de l'opération, pas seulement date d'enregistrement

### Constat

- [ ] Les **ventes** font déjà bien les choses : `sales.saleDate` porte la date réelle, et la liste est triée **et** filtrée dessus (`saleConditions`, `SALE_SORT_SQL`) — pas `created_at`
- [ ] Les **mouvements de stock**, eux, n'ont que `createdAt` : `stock_movements` ne contient aucune date métier. Le filtre `from` / `to` de [`listMovements`](C:/Users/Yass/Desktop/Coding/gstock/G-stock/packages/api/src/services/stock.ts:281) compare `createdAt`, le tri par défaut est `createdAt`, et la colonne « Date » du tableau affiche `createdAt`
- [ ] Conséquence concrète : une vente saisie le lundi avec la date du samedi apparaît dans les mouvements du **lundi**, et une sortie de la semaine dernière est absente du filtre « semaine dernière ». Les chiffres par période et l'historique du produit racontent alors autre chose que la réalité du magasin
- [ ] D'autres tables ont déjà la bonne date et servent de modèle : `stock_lots.receivedAt`, `payments.paymentDate`, `sale_discounts.discountDate`, `purchase_orders.orderDate`, `supplier_payments.paymentDate`
- **Priorité**: Haute — sans cela, tout filtre par période sur le stock est faux dès qu'une saisie est faite en différé

### Règle

- [ ] Deux dates, deux rôles, jamais confondus : **date de l'opération** (métier, saisissable, prioritaire) et **date d'enregistrement** (`createdAt`, lecture seule, pour l'audit)
- [ ] Tri, filtres, regroupements, totaux par période, graphiques et KPI : **date de l'opération**
- [ ] Journal d'activité et traçabilité « qui a saisi quoi et quand » : **date d'enregistrement**, conservée partout
- [ ] Quand les deux diffèrent, l'interface le dit : colonne secondaire « enregistré le … » ou infobulle, jamais une date qui ment en silence

### À faire, endroit par endroit

| Table / écran | Aujourd'hui | À faire |
| --- | --- | --- |
| `stock_movements` | `createdAt` seul | Ajouter `occurred_at` (date de l'opération), indexée, avec `created_at` conservé |
| Page **Mouvements de stock** | colonne « Date » = `createdAt`, filtre et tri dessus | Colonne « Date » = `occurred_at`, filtre et tri dessus, colonne « Enregistré le » quand c'est différent |
| Création de **vente** | mouvements estampillés `createdAt = now` | Passer `saleDate` aux mouvements générés (`consumeFifo` prend une date d'opération) |
| **Annulation** de vente | mouvements datés du jour de l'annulation | Date de l'annulation, mais liés à la vente d'origine (`referenceId` déjà en place) |
| **Réception** commande | lots datés de `receivedAt`, mouvements de `createdAt` | Aligner les mouvements sur `receivedAt` |
| Ajustement de lot / ouverture de carton | date implicite du jour | Proposer la date de l'opération, avec aujourd'hui par défaut |
| Reprises (voir la section ↩️) | — | Reprise datée du jour du retour, pas de la vente d'origine |
| `documents` | `createdAt` seul | Tri et filtre par la date de la vente / commande référencée |
| Page **Documents** | tri par date de génération | Trier et filtrer par date du document d'origine |
| Ventes, commandes, paiements, remises | déjà sur la bonne date | Vérifier seulement la cohérence (aucun écran ne doit retomber sur `createdAt`) |

### Impacts à surveiller

- [ ] **Le FIFO ne change pas** : l'ordre des lots reste déterminé par `receivedAt` et l'identifiant du lot, pas par la date d'opération. Une sortie antidatée continue de prélever les lots les plus anciens — sinon le coût de revient changerait rétroactivement
- [ ] Date d'opération **antérieure à la réception du lot** : avertir, sans bloquer (cas réel des saisies en différé), et le mentionner dans le mouvement
- [ ] Les **agrégats par période** (dashboard, activité, tendances, résumé produit) doivent basculer sur la date d'opération et rester cohérents entre eux : une même vente ne doit pas compter dans deux semaines différentes selon l'écran
- [ ] Les **lots** restent triés et affichés par `receivedAt` : ne pas confondre la date d'entrée en stock et la date de la commande fournisseur
- [ ] **Migration** : remplir `occurred_at` avec `created_at` pour l'existant (aucun changement de comportement pour l'historique), puis indexer `(product_id, occurred_at)` et `occurred_at`
- [ ] **Fuseau horaire** : une date saisie au formulaire est un jour local. Suivre la convention existante (`DateField`, `fromDateInputValue`) pour éviter qu'une vente du 1er à 00 h 30 se retrouve au 31 du mois précédent
- [ ] Les **tests** existants de stock et de ventes doivent rester verts : ils vérifient des quantités et des coûts, pas des dates, mais l'ajout d'une colonne obligatoire touche tous les `insert` de `stockMovements`

### Critères d'acceptation

- [ ] Je saisis une vente datée du samedi : le mouvement de sortie porte la date du samedi et apparaît dans le filtre « cette semaine-là »
- [ ] Le filtre de la page Mouvements donne le même total que le résumé de ventes sur la même période
- [ ] Je vois, pour un mouvement, sa date d'opération **et** sa date d'enregistrement quand elles diffèrent
- [ ] Une sortie antidatée prélève toujours les lots les plus anciens, au même coût qu'avant
- [ ] L'historique déjà en base n'est pas modifié par la migration (date d'opération = date d'enregistrement)
- [ ] Aucun écran de liste ne trie par `createdAt` en prétendant afficher une date métier
- **Note technique** : le gros du travail est le paramétrage de la date dans les helpers de stock (`consumeFifo`, `returnToLots`, `createLot`), puis la propagation depuis les services appelants (vente, réception, annulation, reprise)

---

## 👤 Tiers concerné dans les mouvements de stock

### Constat

- [ ] La colonne **Motif** d'un mouvement ([MovementsTable.vue](C:/Users/Yass/Desktop/Coding/gstock/G-stock/apps/web/app/components/stock/MovementsTable.vue:100)) n'affiche qu'un texte tronqué à deux lignes (`line-clamp-2 max-w-64`) : « Vente V-2026-00012 », « Annulation V-2026-00009 : erreur de saisie », « Commande CF-2026-0004 »
- [ ] On a donc la **référence** mais pas **pour qui** : impossible de répondre d'un coup d'œil à « ce rouleau est sorti pour quel client ? » ou « cette entrée vient de quel fournisseur ? » sans ouvrir la vente
- [ ] La donnée existe pourtant à un saut : `stock_movements.reference_type` + `reference_id` pointent vers la vente (`sales` → `customers`) ou la commande (`purchase_orders` → `suppliers`), et l'index `stock_movements_reference_idx` est déjà là
- [ ] La recherche de la page ne couvre que produit, lot et motif : chercher un nom de client ne donne rien
- **Priorité**: Moyenne-haute — c'est la question la plus fréquente sur cet écran

### Ce qu'on veut voir

- [ ] Sous le motif, une **seconde ligne avec le tiers** : nom du client pour une vente, son annulation ou une reprise ; nom du fournisseur pour une réception ou une entrée de commande ; rien pour un ajustement manuel ou une ouverture de carton
- [ ] Cette ligne est un **lien** vers la vente ou la commande concernée (`/ventes/{id}`, `/achats/{id}`) : un clic mène au document
- [ ] Le tout **dans la colonne Motif**, sans nouvelle colonne : on garde la largeur du tableau et l'information reste groupée
- [ ] Motif sur une ligne, tiers en dessous en petit et discret (`text-dimmed text-xs`), la référence de la vente devenant elle aussi cliquable
- [ ] Le texte complet du motif en infobulle (`title`), pour ne plus perdre la fin des motifs longs

### Données à exposer

- [ ] Ajouter au retour de [`listMovements`](C:/Users/Yass/Desktop/Coding/gstock/G-stock/packages/api/src/services/stock.ts:281) : `partyName` et `partyKind` (`customer` / `supplier` / `null`)
- [ ] Résolution en **deuxième requête** groupée par `referenceType` (une requête pour les ventes, une pour les commandes), plutôt qu'en multipliant les `leftJoin` conditionnels : la page fait 25 lignes, c'est moins coûteux et plus lisible qu'un `or` de jointures
- [ ] Le type web (`StockMovementRow`, dérivé des `Outputs` oRPC dans [types/api.ts](C:/Users/Yass/Desktop/Coding/gstock/G-stock/apps/web/app/types/api.ts:9)) suivra automatiquement ; vérifier que `showProduct` et la page produit n'affichent pas deux fois la même information
- [ ] Étendre la **recherche** au nom du client et du fournisseur : sous-requête `exists` sur `sales`/`customers` et `purchase_orders`/`suppliers` filtrée par `reference_id`, en gardant le `instr(lower(...))` comme convention
- [ ] Même traitement pour la **page produit** (onglet mouvements) et pour la fiche vente, qui réutilisent le même composant

### Garde-fous

- [ ] Un mouvement **manuel** (ajustement, ouverture de carton) n'a pas de tiers : ne rien afficher, pas de line vide ni de tiret parasite
- [ ] Vente ou commande **supprimée ou annulée** : le nom doit rester lisible si la ligne existe encore ; si la référence a disparu, dégrader proprement sans casser la page
- [ ] Les libellés longs (raison sociale complète d'un fournisseur chinois) ne doivent pas déformer la ligne : troncature à une ligne avec infobulle
- [ ] Le tiers ne doit pas **remplacer** le motif : la référence de la pièce reste visible, c'est la trace comptable
- [ ] Pas de requête par ligne (N+1) : une seule requête de résolution pour toute la page

### Critères d'acceptation

- [ ] Sur un mouvement de vente, je lis « Vente V-2026-00012 » puis le nom du client en dessous, et le clic mène à la vente
- [ ] Sur une réception, je lis le nom du fournisseur et le clic mène à la commande
- [ ] Sur un ajustement manuel, aucune ligne de tiers
- [ ] Je tape un nom de client dans la recherche et je retrouve ses sorties de stock
- [ ] L'écran reste lisible sur mobile : le motif et le tiers ne provoquent pas de retour à la ligne en cascade

---

## 🔧 Backoffice (Nouveau)

### Architecture Achat/Licence

- [ ] Créer un backoffice pour gérer le système achat/licence
- [ ] Repenser la structure du système (actuellement basée sur ventes)
- [ ] Gérer les licences, les renouvellements, les clients-clés
- [ ] Permissions et rôles administrateurs
- **Priorité**: Élevée - La plateforme change de modèle

---

## 🏢 Organisation, Multi-Boutique & Rôles

### Gestion des Membres

- [ ] Section "Membres" dans les paramètres de l'organisation
- [ ] Inviter un membre (e-mail, lien ou code d'invitation)
- [ ] Changer son rôle, le désactiver, le retirer
- [ ] Voir sa dernière connexion / dernière activité
- [ ] Plus tard : journal d'activité (qui a fait quoi, quand)

### Multi-Boutique (multi-tenant)

- [ ] Le propriétaire peut posséder plusieurs boutiques et les gérer différemment
- [ ] Créer / renommer / archiver une boutique depuis l'application
- [ ] Sélecteur de boutique active, avec mémorisation du dernier choix
- [ ] Vue globale consolidée : ventes, marges, stock et créances de toutes les boutiques
- [ ] Isolation stricte des données : aucune fuite d'une boutique vers une autre
- [ ] Paramètres par boutique (devise, taux de change, catalogue, clients, licence)
- [ ] Un membre peut être rattaché à une ou plusieurs boutiques
- **État actuel**: mono-magasin. Aucune notion d'organisation/boutique dans le schéma Drizzle (`packages/db/src/schema`) → prévoir `organizationId` / `storeId` sur les tables métier et une boutique active dans la session.

### Vue Globale Propriétaire (multi-organisations)

- [ ] Le propriétaire peut posséder plusieurs organisations, chacune avec ses propres boutiques
- [ ] Console propriétaire : vue consolidée de toutes ses organisations (ventes, marges, stock, créances)
- [ ] Filtres par organisation, par boutique et par période, avec comparaison entre entités
- [ ] Passer d'une organisation à l'autre sans se reconnecter (sélecteur d'organisation)
- [ ] Chaque organisation conserve ses membres, ses paramètres et sa licence
- [ ] Hiérarchie à clarifier : Propriétaire → Organisations → Boutiques (une organisation = une société/entité)
- [ ] Rôle « propriétaire » distinct du rôle « admin d'organisation » : seul le propriétaire voit l'agrégat de toutes ses organisations

### Rôles & Permissions

- [ ] Rôles de base : propriétaire, gérant, vendeur, caissier, comptable (lecture seule)
- [ ] Permissions fines par module (ventes, produits, clients, paiements, paramètres, licence)
- [ ] Rôles personnalisés, éventuellement différents selon la boutique
- [ ] Portée par boutique : un vendeur ne voit que la boutique où il travaille
- [ ] Contrôle côté serveur (API) en plus de l'interface : masquer un bouton ne suffit pas
- **Proposition technique**: Better Auth est déjà en place (`packages/auth`, tables `user`/`session`/`account`) mais sans plugin. Activer `organization()` + `admin()` + `access-control` évite de réinventer invitations, membres et rôles.

---

## 💳 Licence, Abonnement & Modules

### Modèle commercial

- [ ] Passer de la licence unique par magasin (cf. `PRODUCT.md`) à des plans et/ou des modules débloquables
- [ ] Définir les plans (ex. Solo, Boutique, Réseau) : nombre de boutiques, de membres, modules inclus
- [ ] Définir les modules activables à l'unité (multi-boutique, IA, exports, créances avancées…)
- [ ] Appliquer les limites du plan (ex. une seule boutique en Solo)
- [ ] Essai, période de grâce, expiration, et comportement quand la licence expire
- [ ] Activation hors ligne : licence signée (fichier/clé), le produit tourne sans internet
- [ ] Impact marketing : la landing affiche « licence, pas d'abonnement » → à mettre à jour
- [ ] Lien avec le backoffice : émission, renouvellement et suivi des licences par organisation

---

## 🤖 Intelligence Artificielle (plus tard)

### Import assisté par IA

- [ ] À l'import d'un fichier (Excel/CSV), l'IA détecte le type (produits, clients, ventes, fournisseurs) et propose le mapping des colonnes
- [ ] Pré-remplir les champs correspondants, avec écran de confirmation avant import
- [ ] Gérer les cas sales : en-têtes libres, colonnes manquantes, unités, devises, accents
- [ ] Repli sans IA : assistant de mapping manuel, utile même sans clé API
- **Statut**: à réfléchir, pas pour tout de suite

---

## 🔔 Rappels & Relances de Créances

### Rappel programmé dès la vente

- [ ] Au moment de la vente à crédit, noter la date de paiement promise par le client
- [ ] Programmer un rappel qui prévient **l'utilisateur** (pas seulement le client) : « Client X devait payer Y aujourd'hui »
- [ ] Depuis le rappel : appeler, envoyer un message, ou encaisser directement
- [ ] Reporter / mettre en pause un rappel quand le client demande un délai

### Rappels récurrents

- [ ] Le client s'engage sur un rythme : « je paie chaque vendredi »
- [ ] Générer les rappels selon la récurrence jusqu'à épuisement de la somme due
- [ ] Décrémenter automatiquement le solde à chaque paiement et arrêter la série quand la créance est soldée
- [ ] Gérer les échéances manquées : marquer « en retard » et enchaîner sur le rappel suivant
- [ ] Autoriser plusieurs récurrences sur une même vente (acompte puis échéancier)

### Relance du client

- [ ] Modèle de message WhatsApp pré-rempli : nom, montant restant, date promise
- [ ] Historique des relances par client (date, canal, résultat)
- [ ] Plus tard : relance automatique si aucune action après N jours
- **Contrainte technique**: l'app tourne hors ligne → prévoir un planificateur local (contrôle au démarrage + intervalle) et une table `reminders` ; en mode cloud, un job serveur peut envoyer les relances.

---

## 💡 Propositions Complémentaires

_Non validées — à discuter, classées par intérêt._

1. **Journal d'activité (audit log)** — indispensable dès qu'il y a plusieurs membres et des permissions : qui a annulé la vente, changé un prix, encaissé. Cohérent avec la promesse « rien ne se perd ».
2. **Local-first puis synchronisation** — les boutiques travaillent hors ligne (cf. `PRODUCT.md`). Le multi-boutique et la vue globale supposent une synchro : SQLite local par boutique, envoi des changements vers un serveur, résolution des conflits (horodatage + identifiants ULID). À trancher avant de toucher au schéma.
3. **Recherche globale Cmd/Ctrl+K** — palette de commandes (produits, clients, ventes, pages) en complément de la recherche floue.
4. **Relances programmées** — détaillé dans la section 🔔 Rappels & Relances de Créances : date promise à la vente, récurrence hebdomadaire, arrêt automatique quand la créance est soldée.
5. **Assistant IA en français** — questions comme « combien me doit X ? » ou « ma marge sur les glacières ce mois-ci ? ». À faire après l'i18n et la recherche.
6. **Import/export générique CSV/Excel** — écran d'import avec mapping des colonnes, aperçu et rapport d'erreurs, indépendant de l'IA ; c'est la base sur laquelle l'IA se branche ensuite.
7. **Multi-devise par boutique** — RMB/USD/FCFA avec taux saisi au moment de la vente : deux boutiques peuvent ne pas travailler avec les mêmes fournisseurs.
8. **Sauvegarde et export par boutique** — étendre la sauvegarde existante au périmètre boutique et ajouter un export comptable (CSV/PDF).
9. **Assistant de création de boutique** — devise, catalogue de départ, import, invitation des vendeurs, licence, en un seul parcours.
10. **Corbeille / restauration** — vérifier l'existant : proposer une restauration en un clic plutôt qu'une suppression définitive.

---

## 📋 Prochaines Étapes

1. **Audit UX/UI** → skills `dembrandt`, `data-display-and-selection`, `impeccable`, `wcag-accessibility`
2. **Organisation & multi-boutique** → membres, boutique active, vue globale propriétaire, isolation des données (avant tout le reste, ça conditionne le schéma)
3. **Rôles & permissions** → plugin Better Auth `organization` + `admin` + `access-control`
4. **Rappels & relances** → date promise à la vente, récurrences, relance WhatsApp
5. **Licence & modules** → plans, limites, activation hors ligne, cohérence avec le backoffice
6. **Typesense/Meilisearch** → Recherche floue, accents et fautes de frappe
7. **Backoffice** → Architecture achat/licence et rôles
8. **Actions flottantes** → Accès aux actions des pages détail sans remonter en haut
9. **I18n** → Textes dynamiques, tooltips de badges maintenables
10. **Filtres & tri** → Recherche dans la barre, chips de filtres actifs, reset rapide, tri inline dans le datatable partagé
11. **IA** → Import assisté (détection de type de fichier), puis assistant en français

---

_Dernière mise à jour: 2026-10-30_ _Statut: Notes enregistrées pour implémentation ultérieure_
