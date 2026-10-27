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

| Module                                 | État                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Stock & Produits                       | ✅ CRUD produits, lots avec coût de revient, entrées, ajustements, historique, alertes de stock bas |
| Tableau de bord                        | 🟡 Indicateurs de stock ; CA, marges et créances arriveront avec les ventes                         |
| Paramètres                             | ✅ Taux de change RMB → USD → FCFA, seuils d'ancienneté des créances                                |
| Achats fournisseurs                    | ✅ Fournisseurs, commandes en RMB, frais d'approche, prix de revient par ligne, réception en stock  |
| Ventes, Clients, Simulateur, Documents | ⏳ Schéma en base prêt, écrans « Bientôt disponible »                                               |

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

Cycle d'une commande : Brouillon → Commandée → En transit → **Réceptionnée** (un lot par ligne, au coût calculé ; la commande est alors verrouillée) ou Annulée. Seuls les brouillons et les commandes annulées peuvent être supprimés. Numérotation automatique : `CF-2026-0001`.

### Conventions de données

- Montants en FCFA : entiers. Prix en RMB et taux de change : décimaux. Quantités : décimales (kg, mètres), arrondies au millième.
- Le stock d'un produit est la somme des `qty_remaining` de ses lots. Toute variation passe par une transaction qui écrit aussi une ligne `stock_movements`.
- Un produit qui a un historique de stock s'archive au lieu de se supprimer.
- Le solde dû d'un client est calculé (ventes à crédit − paiements), il n'est pas stocké.

## Base de données

Le schéma est dans `packages/db/src/schema/` (un fichier par domaine). Après une modification du schéma :

```bash
pnpm run db:generate --name <description>   # génère une migration SQL dans packages/db/src/migrations/
```

La migration est appliquée au prochain démarrage du serveur. `pnpm run db:studio` ouvre Drizzle Studio pour explorer la base.

## Qualité

```bash
pnpm run check                       # formatage, lint, types de tous les paquets
pnpm --filter @G-stock/core test     # tests unitaires (devises, statuts de stock, prix de revient)
pnpm --filter @G-stock/api test      # tests d'intégration (stock, achats) sur des bases SQLite temporaires
```

Le lint suit le preset Ultracite (`oxlint.config.ts`), avec deux dérogations ciblées : l'ordre des colonnes du schéma Drizzle n'est pas trié alphabétiquement, et les noms de fichiers suivent les conventions Nuxt.

## Configuration

Les variables d'environnement sont décrites dans `apps/web/.env.schema` (Varlock) : `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. Lancez `pnpm run env:generate` après avoir modifié un schéma d'environnement.
