# G-stock

Gestion commerciale pour un importateur-revendeur : achats en Chine (RMB), paiement en USD, ventes en FCFA. Stock par lots avec prix de revient, ventes au comptant ou à crédit, créances clients, achats fournisseurs, simulateur de prix et export PDF.

L'application tourne en local (`http://localhost:3001`), sans connexion internet : un serveur Nuxt et une base SQLite stockée dans un fichier. Les pages sont rendues dans le navigateur (`ssr: false`) ; le serveur Nitro ne sert que l'API et l'authentification.

## Démarrage

```bash
pnpm install
pnpm run dev:web
```

Ouvrez http://localhost:3001 et créez un compte. Au démarrage, le serveur crée la base `local.db` à la racine du dépôt et applique les migrations : aucune commande de base de données n'est nécessaire.

## État des modules

| Module              | État                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Stock & Produits    | ✅ CRUD produits, lots avec coût de revient, entrées, ajustements, ouverture de cartons, historique, alertes de stock bas                      |
| Tableau de bord     | ✅ Stock, CA du jour / de la semaine / du mois, marge brute, créances, meilleures ventes                                                       |
| Paramètres          | ✅ Taux de change RMB → USD → FCFA, seuils d'ancienneté des créances, sauvegarde quotidienne                                                   |
| Achats fournisseurs | ✅ Fournisseurs, commandes en RMB, frais d'approche, prix de revient par ligne, réception en stock                                             |
| Ventes              | ✅ Vente comptant ou à crédit (acompte), sortie FIFO, marge, remise et annulation tracées                                                      |
| Clients             | ✅ Solde, avoir, ancienneté des créances, historique filtrable, achats par produit, paiements                                                  |
| Simulateur          | ✅ Simulations : revient, prix de vente (3 modes), marges, PDF, comparaison avec d'autres simulations et commandes, transformation en commande |
| Documents           | ✅ PDF (reçus, fiches de commande, simulations) rangés dans Documents/G-stock, liste et téléchargement                                         |

## Architecture

```
apps/web/        Application Nuxt 4 (UI Nuxt UI + Tailwind, Pinia, VueUse) et serveur Nitro
packages/core/   Logique pure partagée front/API : devises, formatage, statuts de stock, libellés FR
packages/db/     Schéma Drizzle (SQLite), relations, migrations SQL, migrateur
packages/api/    Procédures oRPC, schémas zod partagés avec les formulaires, services métier
packages/auth/   Authentification Better Auth (e-mail + mot de passe)
```

- **Données serveur** : oRPC + TanStack Query (`$orpc.<module>.<procédure>.queryOptions()`), invalidées après chaque écriture.
- **État client** : Pinia (`app/stores/settings.ts` pour les taux de change).
- **Services métier** (`packages/api/src/services/`) : ils reçoivent la base ou une transaction ; les routeurs ouvrent la transaction. `consumeFifo` (sortie de stock sur les lots les plus anciens) est prête pour le module Ventes.

### Achats : calcul du prix de revient

`computeLandedCosts` (`packages/core/src/purchasing.ts`) est la seule implémentation du calcul : le formulaire l'utilise pour l'aperçu en direct, le serveur pour enregistrer les coûts.

1. Marchandise de chaque ligne, prix **à l'unité** (quantité × prix) ou **à la tonne** (poids × prix par tonne), convertie RMB → USD → FCFA avec les **taux figés sur la commande** (repris des Paramètres à la création, modifiables ensuite).
2. Frais d'approche : CBM × coût par CBM + transport local + autres frais.
3. Répartition des frais entre les lignes : **au prorata des voyages**, **au prorata du poids** ou **à parts égales**. Les parts sont arrondies au FCFA sans perte (leur somme égale toujours le total des frais).
4. Coût de revient unitaire = (marchandise + part des frais) ÷ quantité qui entre en stock, dans l'unité du produit (cartons, rouleaux…). Si le poids de la ligne est connu, le coût par tonne est aussi affiché.

Pour un produit géré en tonnes ou en kg, saisir le poids remplit la quantité de stock automatiquement.

Ces frais de commande sont une **estimation**. La page de réception (`/achats/<id>/reception`) enregistre les **frais réels**, qui la remplacent :

- une liste libre de frais (fret, douane, transit…), chacun en FCFA, USD ou RMB (converti aux taux de la commande) et avec sa propre répartition : voyages, poids, valeur de la marchandise ou parts égales ;
- l'arrivée : date au port, n° de conteneur, n° de BL, transitaire ;
- les quantités reçues : en cas de manquant ou de casse, le coût de la ligne est réparti sur la quantité reçue ; une ligne à 0 ne crée pas de lot.

La saisie peut être enregistrée sans toucher au stock (la douane se note dès qu'elle est payée). La validation fige le coût de revient réel et crée les lots. Une commande reçue affiche ce coût réel et l'écart avec l'estimation.

**Paiement du fournisseur en plusieurs tranches.** Sur la fiche d'une commande, chaque versement est noté en FCFA (ce qui est envoyé), avec le taux obtenu ce jour-là en FCFA pour 1 RMB ; sans taux, c'est celui de la commande (`fcfa_per_usd ÷ rmb_per_usd`). `summarizeSupplierPayments` (`packages/core/src/supplier-payments.ts`) en déduit les RMB payés, le reste à payer et le **coût réel de la marchandise** : versements à leur taux + reste au taux de la commande (une avance au-delà du prix n'est pas comptée). Ce coût remplace la conversion aux taux dans le prix de revient, réparti entre les lignes selon leur valeur en RMB.

À la réception, ce coût est figé dans les lots (`purchase_orders.received_goods_fcfa`). Les versements suivants ne recalculent pas les lots déjà vendus : la fiche affiche un **gain ou une perte de change**. Un versement erroné s'annule avec un motif (il reste visible, barré). La liste des commandes indique le reste à payer, celle des fournisseurs le total dû par fournisseur. Une commande avec des versements ne peut plus être supprimée.

Cycle d'une commande : Brouillon → Commandée → En transit → **Réceptionnée** (un lot par ligne reçue, au coût réel ; la commande est alors verrouillée) ou Annulée. Seuls les brouillons et les commandes annulées peuvent être supprimés. Numérotation automatique : `CF-2026-0001`.

### Ventes et clients

- Une vente a toujours un client. Chaque ligne sort du stock en FIFO (lots les plus anciens d'abord) ; les lots prélevés et leur coût sont figés sur la ligne (`sale_item_lots`), d'où la marge réelle. Le formulaire affiche ce coût à l'avance (`sales.quote`), avec une alerte si un prix est sous le coût de revient (autorisé).
- Comptant : le total est encaissé à la vente. À crédit : un acompte facultatif est encaissé.
- **Remise après la vente** : montant et motif obligatoires, tracée (date, auteur) ; elle réduit le montant net. Sur une vente déjà payée, elle devient un avoir du client.
- **Annulation** : motif obligatoire ; le stock revient dans les lots d'origine, les paiements de la vente sont annulés, la vente reste dans l'historique. Un paiement peut aussi être annulé seul, avec son motif.
- **Solde client** (calculé, jamais stocké) : ventes validées nettes de remises − paiements non annulés. Un paiement rattaché à une vente la règle en priorité ; les autres soldent les ventes les plus anciennes d'abord. L'ancienneté de la plus vieille vente impayée donne le niveau de créance (seuils dans les Paramètres).

### Simulateur et documents

- Une simulation garde ses données (taux, fret CBM, frais libres, lignes, prix de vente) en JSON ; `computeSimulation` (`packages/core/src/simulation.ts`) recalcule tout, à l'écran comme dans le PDF. Le prix de vente d'une ligne se fixe par un % sur le prix de revient, un % du prix de vente, ou un prix saisi ; les deux taux sont toujours affichés.
- « Créer la commande » produit une commande en brouillon : les lignes sans produit du catalogue sont rattachées au produit de même nom, ou le créent avec le prix simulé comme prix conseillé ; les frais libres deviennent des « autres frais ».
- **Comparer** (`/simulateur/comparer?elements=s1,s2,c3`) : jusqu'à 4 simulations et commandes passées côte à côte, la première servant de référence. Vue d'ensemble (marchandise, frais, revient total et par tonne, fret par CBM, taux, CA et marge prévus), puis produit par produit (rapprochés par produit du catalogue ou par nom) et frais par frais. Une commande reçue est comparée sur ses coûts réels, une commande en cours sur son estimation.
- Les PDF sont générés côté serveur (`packages/api/src/pdf/`, pdfmake 0.3) avec une charte commune, écrits dans le dossier des documents (Paramètres, par défaut `Documents/G-stock`) : `Ventes/`, `Simulations/`, `Commandes/<référence>/`. Regénérer un document remplace son fichier. Le reçu remis au client ne montre ni coût ni marge.
- **Reçu sur WhatsApp** (bouton « WhatsApp » d'une vente) : reçu au format téléphone (`Recu-V-….pdf`, page étroite et aussi longue que nécessaire) et message prêt (`receiptMessage`, `packages/core/src/whatsapp.ts`). Sur un téléphone, le PDF part directement par le partage du système (choisir WhatsApp ; nécessite HTTPS). Sur PC, le PDF est téléchargé et WhatsApp s'ouvre sur la discussion du client (`wa.me`), il reste à y glisser le fichier. Les numéros saisis sans indicatif reçoivent l'**indicatif téléphonique** des Paramètres.
- `GET /api/documents/<id>` sert un PDF (connexion requise) ; `?telecharger` le propose en téléchargement.

### Conventions de données

- Identifiants : UUID v7 en texte (`uuidv7()`, `packages/core/src/ids.ts`), générés sans compteur, donc sans doublon possible même entre plusieurs postes, et triés par date de création. Les codes de lot prennent la fin aléatoire de l'UUID (`LOT-20261027-1BAF8D`).
- Numéros lisibles (`CF-2026-0001`, `V-2026-00001`) : un compteur par série et par année (`reference_sequences`) qui ne recule jamais ; le numéro d'une commande supprimée n'est pas réutilisé.
- Montants en FCFA : entiers. Prix en RMB et taux de change : décimaux. Quantités : décimales (kg, mètres), arrondies au millième.
- Le stock d'un produit est la somme des `qty_remaining` de ses lots. Toute variation passe par une transaction qui écrit aussi une ligne `stock_movements`.
- **Ouvrir des cartons** (vente au détail exceptionnelle) : un produit peut indiquer ses pièces par unité (`pieces_per_unit`, ex. 5 fils par carton). « Ouvrir des cartons » sort les cartons en FIFO et crée, dans le produit « <nom> (pièce) » (créé à la première ouverture puis lié par `piece_product_id`), un lot de pièces par lot de cartons ouvert, au coût du carton divisé par le nombre de pièces. Les mouvements sont tracés (`reference_type = unpack`).
- Un produit qui a un historique de stock s'archive au lieu de se supprimer.
- Le solde dû d'un client est calculé (ventes à crédit − paiements), il n'est pas stocké.

## Base de données

Le schéma est dans `packages/db/src/schema/` (un fichier par domaine). Après une modification du schéma :

```bash
pnpm run db:generate --name <description>   # génère une migration SQL dans packages/db/src/migrations/
```

La migration est appliquée au prochain démarrage du serveur. `pnpm run db:studio` ouvre Drizzle Studio pour explorer la base.

### Sauvegarde et restauration

Tant que le serveur tourne, il vérifie toutes les heures que la dernière sauvegarde a moins de 24 h, sinon il en fait une : une copie cohérente de la base (`VACUUM INTO`) nommée `gstock-AAAA-MM-JJ-HHMMSS.db`. Le dossier et le nombre de copies conservées (30 par défaut) se règlent dans **Paramètres → Sauvegarde**, qui affiche aussi la dernière sauvegarde, un bouton « Sauvegarder maintenant » et le téléchargement des copies. Le tableau de bord avertit si la sauvegarde échoue ou date de plus de deux jours.

Avec [Google Drive pour ordinateur](https://www.google.com/drive/download/), choisissez un dossier dans « Mon Drive » (proposé automatiquement s'il est détecté) : chaque copie part aussi en ligne. Sans Drive, les copies vont dans `Documents/G-stock/Sauvegardes`.

Pour restaurer, arrêtez G-stock puis :

```bash
pnpm db:restore "G:\Mon Drive\G-stock\Sauvegardes\gstock-2026-10-27-090000.db"
```

La base actuelle est gardée à côté (`local.db.avant-restauration-<date>`) ; le script refuse de tourner tant que le serveur garde la base ouverte.

## Qualité

```bash
pnpm run check                       # formatage, lint, types de tous les paquets
pnpm --filter @G-stock/core test     # tests unitaires (devises, stock, prix de revient, créances)
pnpm --filter @G-stock/api test      # tests d'intégration (stock, achats, ventes, simulations, PDF) sur des bases temporaires
```

Le lint suit le preset Ultracite (`oxlint.config.ts`), avec deux dérogations ciblées : l'ordre des colonnes du schéma Drizzle n'est pas trié alphabétiquement, et les noms de fichiers suivent les conventions Nuxt.

## Configuration

Les variables d'environnement sont décrites dans `apps/web/.env.schema` (Varlock) : `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. Lancez `pnpm run env:generate` après avoir modifié un schéma d'environnement.
