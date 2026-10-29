# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Monorepo pnpm (Vite+). Application : Nuxt 4 + Nuxt UI 4 (`apps/web`). Guide utilisateur : Docus (`apps/docs`). Landing page : Nuxt + Nuxt UI, rendue en statique (`apps/landing`), choix confirmé par l'utilisateur.

## Users

Importateurs-revendeurs d'Afrique de l'Ouest (exemple de référence : un commerce d'import à Lomé) qui achètent en Chine, paient leurs fournisseurs en dollars et revendent en FCFA, au comptant ou à crédit. Le gérant suit son stock, ses marges et ce que ses clients lui doivent ; un ou deux vendeurs enregistrent les ventes au comptoir. Ce ne sont pas des développeurs.

## Product Purpose

Remplacer le cahier, Excel et le calcul de tête par une seule application : stock par lots, prix de revient réel de chaque produit (marchandise, fret, douane, transit), ventes et créances clients, commandes et paiements fournisseurs, simulation d'une commande avant de la passer. Réussite : le commerçant connaît à tout moment sa vraie marge, son stock et ses impayés.

## Positioning

Conçue par un importateur qui l'utilise lui-même pour son commerce, pour le circuit Chine → Afrique de l'Ouest : devises RMB/USD/FCFA, frais d'approche répartis sur les produits, ventes à crédit et ancienneté des créances, reçus envoyés sur WhatsApp. Fonctionne sur l'ordinateur du magasin, sans connexion internet.

## Operating Context

- L'application tourne en local sur un PC du magasin et s'ouvre dans le navigateur ; les données restent dans un fichier sur ce PC, sauvegardé chaque jour (copie en ligne possible via Google Drive).
- Reçus, fiches de commande et simulations en PDF ; reçu envoyé au client sur WhatsApp.
- Une base de démonstration réaliste (5 ans d'activité fictive) existe : `pnpm demo:seed`, `pnpm dev:demo`.

## Capabilities and Constraints

- Modules : tableau de bord, produits et lots (FIFO), mouvements de stock, ventes (comptant, crédit, acompte, remise, annulation tracée), clients et créances, commandes fournisseurs (frais d'approche, réception, paiements en tranches, gain/perte de change), fournisseurs, simulateur et comparaison, documents PDF, paramètres et sauvegarde.
- Offre commerciale : ce n'est **pas** un logiciel libre. L'auteur installe G-stock chez le client et le forme ; installation, formation et accompagnement sont payants. Les montants ne sont pas fixés (à ne pas inventer).
- Parcours souhaité sur la landing : essayer la démo, ou contacter l'auteur. Ni démo en ligne, ni numéro de contact public ne sont encore fournis : à demander, jamais à inventer.
- Interface en français.

## Brand Commitments

Nom : **G-stock**. Logo : l'icône utilisée dans l'application (`apps/web`, `icons.logo`). Voix : directe, concrète, en français de tous les jours, on parle au commerçant (« vous »), pas au développeur.

## Evidence on Hand

- Captures réelles de l'application sur la base de démo : `apps/docs/public/captures/*.webp` (tableau de bord, produits, ventes, nouvelle vente, clients, commandes, simulation, thèmes, visite guidée, paramètres) ; elles se regénèrent avec `pnpm --filter docs captures`.
- Fait confirmé : l'auteur utilise G-stock pour son propre commerce.
- Absents, à ne pas fabriquer : témoignages, logos de clients, nombre d'utilisateurs, chiffres de résultats, tarifs.

## Product Principles

1. La vraie marge d'abord : chaque chiffre affiché tient compte de tous les frais.
2. Rien ne se perd : annulations, remises et paiements restent tracés avec leur motif.
3. Le magasin reste maître de ses données : local, hors ligne, sauvegardé.
4. Les mots du commerce, pas ceux de l'informatique.
