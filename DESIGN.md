---
name: G-stock
description: La gestion du magasin pour les importateurs-revendeurs, du conteneur de Chine au comptoir.
colors:
  ink: "oklch(21% 0.006 60)"
  data: "oklch(58.5% 0.233 277)"
  data-dark: "oklch(67.3% 0.182 276.9)"
  due: "oklch(62% 0.17 58)"
  white: "#ffffff"
  sand-50: "oklch(98.6% 0.003 80)"
  sand-100: "oklch(96.4% 0.005 80)"
  sand-200: "oklch(92.2% 0.007 75)"
  sand-300: "oklch(86.8% 0.009 75)"
  sand-400: "oklch(71% 0.011 70)"
  sand-500: "oklch(55.5% 0.012 65)"
  sand-600: "oklch(44.5% 0.011 65)"
  sand-700: "oklch(37.5% 0.01 60)"
  sand-800: "oklch(27.5% 0.008 60)"
  sand-900: "oklch(21% 0.006 60)"
  sand-950: "oklch(15.5% 0.005 60)"
typography:
  display:
    fontFamily: "Inter, sans-serif"
    fontSize: "clamp(2rem, 4.6vw, 3.6rem)"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.035em"
    fontFeature: '"cv11"'
  headline:
    fontFamily: "Inter, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.25rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.03em"
    fontFeature: '"cv11"'
  title:
    fontFamily: "Inter, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
    fontFeature: '"cv11"'
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
    fontFeature: '"cv11"'
  body-lead:
    fontFamily: "Inter, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
    fontFeature: '"cv11"'
  figure:
    fontFamily: "Inter, sans-serif"
    fontWeight: 600
    letterSpacing: "-0.025em"
    fontFeature: '"tnum", "cv11"'
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "0.08em"
rounded:
  xs: "3px"
  sm: "6px"
  md: "9px"
  lg: "12px"
  xl: "18px"
  2xl: "24px"
  bubble: "1.4rem"
  full: "9999px"
spacing:
  frame: "4px"
  card: "16px"
  card-sm: "20px"
  gutter: "16px"
  gutter-sm: "32px"
  section: "96px"
  section-sm: "128px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-outline:
    backgroundColor: "{colors.white}"
    textColor: "{colors.sand-900}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-outline-hover:
    backgroundColor: "{colors.sand-50}"
  button-cta:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.full}"
    padding: "8px 20px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.sand-900}"
    rounded: "{rounded.md}"
    typography: "{typography.body}"
  card-framed:
    backgroundColor: "{colors.sand-100}"
    rounded: "{rounded.xl}"
    padding: "4px"
  card-framed-inner:
    backgroundColor: "{colors.white}"
    rounded: "14px"
    padding: "16px"
  section-label:
    textColor: "{colors.sand-500}"
    typography: "{typography.label}"
  bubble-received:
    backgroundColor: "{colors.white}"
    textColor: "{colors.sand-900}"
    rounded: "{rounded.bubble}"
    padding: "20px 28px"
  bubble-sent:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.bubble}"
    padding: "12px"
  tabs-pill:
    backgroundColor: "{colors.sand-50}"
    rounded: "{rounded.lg}"
    padding: "2px"
  tabs-pill-active:
    backgroundColor: "{colors.white}"
    textColor: "{colors.sand-900}"
  badge:
    backgroundColor: "{colors.sand-50}"
    textColor: "{colors.sand-600}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
---

# Design System: G-stock

## Overview

**Creative North Star: "Le Registre du comptoir"**

G-stock est le registre que le commerçant tient derrière son comptoir, devenu écran : un papier sable chaud, une encre presque noire pour ce qui engage (valider une vente, écrire au client), des chiffres alignés qui se lisent comme une colonne de cahier, et de petites mentions en mono pour les références, les dates et les intitulés. Rien n'y est décoratif : la couleur ne sort que pour dire quelque chose, l'indigo pour les données, l'ambre pour ce qui reste dû.

Le système est né dans l'application (`apps/web`) et la landing (`apps/landing`) en hérite : même sable, même encre, même Inter, mêmes étiquettes mono, mêmes ombres douces. L'application est dense et posée en couches (un cadre sable porte la barre latérale, le contenu tient dans un panneau blanc posé dessus) ; la landing reprend les mêmes matériaux à plus grande échelle, avec un composant propre au monde du commerçant : la bulle de discussion (reçue blanche, envoyée encre).

Le thème « Encre » est l'identité de la maison. L'application laisse chaque utilisateur choisir un autre thème (Océan, Forêt, Terre cuite, Améthyste, Graphite, Corail) ou régler lui-même couleur principale, gris, accent, arrondi, police et icônes : c'est un réglage personnel, pas la marque. Toute surface publique (landing, documents, captures de présentation) parle en Encre.

**Key Characteristics:**

- Gris chaud « sable » partout, jamais de gris neutre froid.
- Encre (sand-900) pour l'action ; indigo pour les données ; ambre pour le dû.
- Inter avec `cv11`, chiffres tabulaires pour tout montant ; Geist Mono 11 px en capitales pour les intitulés et références.
- Surfaces séparées par un liseré fin et une teinte, ombres à peine perceptibles au repos.
- Mouvement rapide au départ, posé à l'arrivée (`--ease-snappy`), toujours désactivable.

## Colors

Une palette quasi monochrome de sable chaud, tenue par une encre profonde, où deux couleurs seulement ont le droit de parler : l'indigo des données et l'ambre du dû.

### Primary

- **Encre** (`ink`, égale à `sand-900`) : la couleur de l'action et du texte fort. Boutons principaux (`--ui-primary` pointe sur `neutral-900` en clair, `neutral-50` en sombre), titres (`text-highlighted`), bulle envoyée, bande de section sombre de la landing, carré du logo. Dans le thème Encre, la couleur principale de Nuxt UI est le sable lui-même (`primary: "sand"`), d'où une action noire et non colorée.

### Secondary

- **Indigo des données** (`data` ; `data-dark` en mode sombre) : la série principale des graphiques (`--ui-chart-1`), la progression et la station active du trajet de la marchandise, l'anneau de focus et la sélection de texte sur la landing. Dans l'application, cet accent est réglable par l'utilisateur ; indigo est la valeur d'origine.

### Tertiary

- **Ambre du dû** (`due` sur la landing ; la couleur `warning`, ambre Tailwind, dans l'application) : ce qui reste à payer, les alertes de stock bas, les écarts à surveiller. Sur la landing, il marque une seule chose : le « Reste dû » du reçu.

### Neutral

La gamme `sand-50` → `sand-950` (teinte 60 à 80, chroma 0,003 à 0,012) remplace le gris de Nuxt UI (`neutral: "sand"`). Rôles en mode clair :

- **Fond du cadre** (`bg-canvas` = `sand-100`) : le fond de l'application et de la landing ; la barre latérale y est posée sans bordure.
- **Surface** (`bg-default` = blanc) : panneaux, cartes, tableaux, bulle reçue, champs.
- **Surface en retrait** (`bg-muted` = `sand-50`) : en-têtes de tableau, pieds de fenêtre, rail des onglets, badges neutres.
- **Cadre de carte** (`bg-elevated` = `sand-100`) et **survol accentué** (`bg-accented` = `sand-200`).
- **Liserés** (`border-default` = `sand-200`, `border-accented` = `sand-300`).
- **Texte secondaire** (`text-muted`) : `sand-500` dans l'application (valeur Nuxt UI), `sand-600` sur la landing, plus contrasté sur le fond sable.
- **Sur encre** : texte secondaire `sand-300`, traits `sand-700`, survol `sand-800`.
- **Voile des fenêtres** : `sand-950` à 25 % avec un flou de 2 px.

Mode sombre (application seulement) : cadre `sand-950`, surface `sand-900`, surface relevée `sand-800`, liserés `sand-800`, texte fort `sand-50`, action `sand-50`.

Couleurs d'état de l'application : `success` émeraude (encaissé, marge positive), `warning` ambre (dû, stock bas), `error` rouge Nuxt UI (rupture, annulation, perte). Toujours en teinte légère avec liseré (`bg-warning/10 text-warning ring-warning/25`), jamais en aplat plein.

### Named Rules

**The One Ink Rule.** L'action est noire. Aucun bouton n'est indigo ni ambre ; une couleur vive sur un bouton n'apparaît que si l'utilisateur a choisi un autre thème.

**The Color Means Something Rule.** L'indigo est une donnée, l'ambre est un dû. Si une couleur ne porte pas l'un de ces sens, elle est sable.

**The Warm Gray Rule.** Tout gris est du sable. Un `gray`, `zinc` ou `slate` dans le thème d'origine est une erreur, pas une variante.

## Typography

**Display Font:** Inter (avec sans-serif), variante `cv11` activée sur `body` **Body Font:** Inter (avec sans-serif) **Label/Mono Font:** Geist Mono (avec ui-monospace, monospace)

**Character:** Inter tient tout le texte, du chiffre d'affaires au titre de la landing, serré et sûr de lui aux grandes tailles. Geist Mono est réservé à ce qui se lit comme une écriture de registre : intitulés de carte et de colonne, références (`V-2026-02364`), dates et heures.

### Hierarchy

- **Display** (600, `clamp(2rem, 4.6vw, 3.6rem)`, 1,04, -0,035em) : une seule phrase par page, la question d'ouverture de la landing. Équilibrée (`text-balance`).
- **Headline** (600, `clamp(2rem, 4vw, 3.25rem)`, 1,05, -0,03em) : titres de section de la landing, phrases complètes en casse de phrase, colonne de 42 à 46 rem.
- **Title** (600, 1,25 rem / 1,75 rem, `tracking-tight`) : titre de page dans l'application (`PagePanel`) ; sur la landing, titres d'élément de 1,125 à 1,5 rem.
- **Body** (400, 0,875 rem / 1,25 rem) : le texte courant de l'application, dense ; libellés de champ à 13 px.
- **Body-lead** (400, 17 px / 28 px, ou `text-lg`) : paragraphes de la landing, `text-muted`, `text-pretty`, colonne de 36 à 44 rem (environ 65 à 75 caractères).
- **Figure** (600, `tabular-nums`) : tout montant, quantité ou compteur. Montant suivi de « FCFA », milliers séparés par une espace. Le chiffre clé d'un reçu monte à `text-2xl`.
- **Label** (Geist Mono 500, 11 px, 0,06 à 0,08em, capitales) : intitulés de carte (`pageCard` title, 0,08em), en-têtes de tableau (0,06em), références, horodatages, noms d'étape. 10 px dans les menus compacts.

### Named Rules

**The Ledger Label Rule.** Le mono en capitales est le titre d'une carte, d'une colonne ou d'une donnée : il remplace l'intitulé, il ne se pose jamais au-dessus d'un titre comme surtitre.

**The Aligned Figures Rule.** Un nombre affiché se lit en colonne : `tabular-nums`, toujours.

## Layout

**Application.** Coque de tableau de bord Nuxt UI : barre latérale sur le fond `bg-canvas`, sans bordure ; à partir de `lg`, le contenu tient dans un panneau blanc posé dans le cadre avec 8 px de marge (`lg:my-2 lg:me-2`), arrondi `xl`, liseré et ombre de carte. Barre du haut de 3,5 rem, barre d'outils d'au moins 48 px. Cartes : un cadre sable de 4 px (`p-1`) autour d'une surface blanche de 16 px de marge intérieure (20 px dès `sm`). Densité de travail : texte à 14 px, lignes de tableau à 12 px de marge verticale.

**Landing.** Conteneur de 80 rem, gouttières de 16 px (32 px dès `sm`), sections de 96 px de marge verticale (128 px dès `sm`). Les passages de lecture se resserrent : fil de conversation à 54 rem, questions à 56 rem. Les sections alternent le fond sable, une bande blanche bordée (`border-y`) et une bande encre. Ancres décalées de 5 rem sous la barre collante.

**Captures.** Une capture réelle est toujours posée dans un cadre sable (`bg-elevated`, `rounded-2xl`, 6 à 8 px de marge) autour d'une capture blanche cerclée (`rounded-xl ring`). Sur téléphone, la capture n'est pas réduite : elle est montrée à 75 % de sa taille d'origine et cadrée sur un point d'intérêt.

Points de rupture Tailwind par défaut : `sm` 640 px, `md` 768 px, `lg` 1024 px. Sur téléphone, les lignes horizontales (trajet, étapes) deviennent verticales.

## Elevation & Depth

Le système est en couches tonales, pas en ombres : c'est le liseré fin et l'écart de teinte entre sable et blanc qui séparent les surfaces. Les ombres existent, mais au repos elles se devinent à peine ; elles ne prennent de l'ampleur que pour ce qui flotte au-dessus de la page (menus, fenêtres, infobulles, barre de message). Chaque ombre a un décalage vertical et un flou doux, teintée de brun (`rgb(41 37 36)`, `rgb(28 25 23)`), jamais un halo coloré.

### Shadow Vocabulary

- **Tactile** (`0 1px 2px 0 rgb(41 37 36 / 0.06), 0 1px 1px -1px rgb(41 37 36 / 0.06)`) : boutons secondaires, onglet actif, lien actif de la navigation, carte radio cochée. Une touche en relief.
- **Primary** (`inset 0 1px 0 0 rgb(255 255 255 / 0.14), 0 1px 2px 0 rgb(28 25 23 / 0.28), 0 2px 4px -2px rgb(28 25 23 / 0.2)`) : bouton principal, avec un dégradé blanc de 10 % en haut.
- **Card** (`0 1px 2px 0 rgb(41 37 36 / 0.04)`) : cartes, tableaux, panneau de contenu ; toujours avec un liseré `ring-default`.
- **Overlay** (`0 16px 36px -12px rgb(28 25 23 / 0.2), 0 4px 10px -4px rgb(28 25 23 / 0.08)`) : menus, popovers, fenêtres, toasts, infobulles.
- **Bubble** (`0 1px 2px 0 rgb(41 37 36 / 0.05), 0 8px 24px -16px rgb(41 37 36 / 0.25)`) : bulles de discussion reçues sur la landing.
- **Float** (`0 18px 40px -18px rgb(28 25 23 / 0.35), 0 4px 10px -4px rgb(28 25 23 / 0.08)`) : la barre de message de la landing.

En mode sombre, les ombres de l'application passent au noir pur, plus fortes, avec un filet clair intérieur sur les touches.

### Named Rules

**The Hairline First Rule.** Une surface au repos se sépare par un liseré et une teinte ; son ombre ne dépasse pas 2 px de flou. Les grandes ombres sont réservées aux éléments qui flottent.

## Shapes

Arrondis dérivés d'une base unique `--ui-radius` de 0,375 rem (6 px) : `sm` 6 px, `md` 9 px (boutons, champs, infobulles), `lg` 12 px (menus, rail d'onglets, éléments de navigation), `xl` 18 px (cartes, tableaux, fenêtres, panneau de contenu), `2xl` 24 px (cadres de capture). Une carte encadrée garde des arrondis concentriques : l'intérieur vaut `xl` moins 4 px. La base est un réglage utilisateur (0 à 0,75 rem) ; tout arrondi doit en dériver, jamais une valeur fixe.

Formes propres à la landing : la bulle (1,4 rem, avec un coin en queue arrondi `md` du côté de l'émetteur : bas gauche pour reçue, bas droite pour envoyée), les boutons en pilule, la barre de message en pilule. Les points d'étape sont des anneaux de 26 px à bordure de 4 px reliés par un rail de 4 px aux bouts arrondis. Badges et compteurs en pilule.

## Components

### Buttons

Des touches nettes, en léger relief, qui s'enfoncent d'un pixel au clic.

- **Shape:** arrondi `md` (9 px) dans l'application ; pilule sur la landing.
- **Primary:** encre, texte blanc, dégradé blanc de 10 % en haut et ombre Primary ; survol à 90 % d'opacité. Marge horizontale de 12 px (`md`), 14 px (`lg`).
- **Hover / Focus:** transition de couleur, fond, ombre et translation ; `active:translate-y-px`, neutralisé quand le bouton est désactivé.
- **Outline (neutre):** surface blanche, liseré `ring-default`, ombre Tactile ; survol `bg-muted`, appui `bg-elevated`.
- **Subtle / Ghost:** subtle en `bg-muted` avec ombre Tactile ; ghost en `text-toned`, fond `bg-accented/50` au survol.
- **Landing:** CTA en pilule encre (`size="xl"`, icône WhatsApp en fin), CTA secondaire en pilule à liseré ; sur la bande encre, le principal devient blanc à texte encre.

### Chips / Badges

- **Style:** pilule, 11 px en petite taille ; neutre en `bg-muted text-toned ring-default`.
- **State:** les badges d'état reprennent la couleur du sens (`success`, `warning`, `error`) en teinte à 10 % avec liseré à 20 à 25 %. Le compteur de la navigation est un carré arrondi à chiffres tabulaires, réduit à un point de 8 px quand la barre est repliée.

### Cards / Containers

- **Corner Style:** `xl` (18 px), intérieur `xl` moins 4 px.
- **Background:** carte encadrée (`pageCard` subtle) : cadre `bg-elevated` de 4 px autour d'une surface blanche.
- **Shadow Strategy:** ombre Card et liseré `ring-default` (voir Elevation & Depth).
- **Border:** liseré de 1 px, `sand-200`.
- **Internal Padding:** 16 px, 20 px dès `sm`.
- **Title:** intitulé mono en capitales (Label), `text-muted`. Une carte cliquable se fonce d'un ton et se tasse à 98,5 % à l'appui.

### Tables

Surface blanche arrondie `xl` avec liseré et ombre Card ; en-têtes en `bg-muted`, Label mono 11 px à 0,06em ; lignes de 12 px de marge verticale, survol `bg-muted/70`.

### Inputs / Fields

- **Style:** variante outline par défaut, fond blanc (`bg-muted` en sombre), liseré, `shadow-xs`, texte 14 px ; libellés à 13 px.
- **Focus:** un trait gris foncé (`ring-neutral-400`) et un halo de 4 px à 10 % de l'encre, plutôt que le noir plein de la couleur principale.
- **Menus déroulants:** arrondi `lg`, ombre Overlay ; en sombre, fond `bg-elevated/95` avec flou.

### Tabs

Contrôle segmenté : rail `bg-muted` arrondi `lg`, 2 px de marge, liseré ; l'onglet actif est une touche blanche en relief (ombre Tactile, liseré), texte 13 px. À la taille du contenu, calé à gauche, défilant si l'écran est étroit.

### Navigation

- **Application:** navigation verticale en pilules ; lien actif en surface blanche avec ombre Tactile et liseré, survol `bg-accented/50` ; icônes de 18 px en `text-muted`. Fil d'Ariane : parents en `text-muted`, page en cours en `text-highlighted` 500.
- **Landing:** barre collante de 64 px sur `bg-canvas/85` floutée ; liens 15 px en `text-muted`, `text-highlighted` au survol ; logo dans un carré encre arrondi `md` ; un bouton « Nous écrire » en pilule à liseré. Les liens disparaissent sous `md`.

### Overlays

Fenêtres et volets arrondis `xl`, ombre Overlay, pied de fenêtre en `bg-muted`, voile sable à 25 % avec flou de 2 px. Infobulles inversées (fond encre, texte blanc, 28 px de haut) ; infobulles de graphique en surface claire.

### Bulles de discussion (composant signature de la landing)

Reçue : surface blanche, ombre Bubble, arrondi 1,4 rem avec la queue en bas à gauche, nom de l'expéditeur en 13 px `text-muted` au-dessus du message. Envoyée : encre, queue en bas à droite ; elle peut contenir un document (le reçu) posé en surface blanche arrondie `2xl`, avec une légende `sand-300` sous le document. Horodatage centré en Label mono. Le fil se joue une fois à l'arrivée (entrée de 520 ms avec léger flou, indicateur « en train d'écrire »), puis plus jamais ; sans mouvement si l'utilisateur l'a demandé.

### Reçu

Document de vente : référence et date en Label mono 11 px sur une ligne, lignes d'articles avec quantité en `text-muted`, montants alignés à droite en chiffres tabulaires, total et déjà payé en `text-muted` sous un filet, « Reste dû » en ambre `text-2xl` 600.

### Trajet de la marchandise (landing)

Ligne de stations : rail `bg-accented` de 4 px, progression indigo qui s'étend (500 ms, `--ease-in-out-strong`), anneaux de 26 px (indigo une fois atteints, `sand-300` sinon) dont l'actif porte un point indigo. Onglets accessibles au clavier (flèches). Le panneau associé montre une capture réelle et son texte ; il change par fondu et léger flou en 300 ms.

## Do's and Don'ts

### Do:

- **Do** tirer tout gris de la gamme `sand` et toute action de l'encre (`sand-900`, ou `sand-50` en sombre).
- **Do** réserver l'indigo aux données (séries de graphique, progression, position active, focus) et l'ambre à ce qui reste dû ou demande attention.
- **Do** composer tout montant en chiffres tabulaires, suivi de « FCFA », milliers séparés par une espace.
- **Do** titrer les cartes, colonnes et références en Geist Mono 11 px, capitales, 0,06 à 0,08em, `text-muted`.
- **Do** séparer les surfaces au repos par un liseré `ring-default` et la teinte sable/blanc, avec au plus l'ombre Card.
- **Do** dériver chaque arrondi de `--ui-radius` (cartes `xl`, champs et boutons `md`, menus `lg`).
- **Do** animer avec `--ease-snappy` (`cubic-bezier(0.23, 1, 0.32, 1)`), sous 300 ms pour tout ce qui répond à une saisie, et couper le mouvement sous `prefers-reduced-motion`.
- **Do** montrer l'application par de vraies captures de la base de démonstration, dans le cadre sable, avec la mention « données de démonstration ».
- **Do** dessiner les icônes avec Tabler (thème Encre) ; le logo est `i-tabler-packages` dans un carré encre.

### Don't:

- **Don't** colorer un bouton dans le thème Encre : ni indigo, ni ambre, ni dégradé de marque.
- **Don't** présenter un thème utilisateur (Océan, Forêt, Terre cuite, Améthyste, Graphite, Corail) comme l'identité de G-stock.
- **Don't** poser une étiquette mono en capitales au-dessus d'un titre comme surtitre : elle est le titre de la carte ou le nom d'une donnée, pas un chapeau.
- **Don't** utiliser un gris froid (`gray`, `zinc`, `slate`) ou le noir pur `#000` pour le texte et l'encre.
- **Don't** mettre une grande ombre sous une surface au repos : les ombres Overlay et Float sont pour ce qui flotte.
- **Don't** afficher un montant en chiffres proportionnels ni en Geist Mono : le mono est pour les références et les intitulés, Inter tabulaire pour les nombres.
- **Don't** remplir une alerte d'une couleur pleine : teinte à 10 %, texte et liseré de la couleur du sens.
- **Don't** fixer un arrondi en pixels dans l'application : il casse les thèmes à angles vifs ou très arrondis.
