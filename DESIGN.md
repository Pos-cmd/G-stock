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
    fontSize: "clamp(2.4rem, 5.6vw, 4.75rem)"
    fontWeight: 600
    lineHeight: 1.02
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
  figure-term:
    fontFamily: "Inter, sans-serif"
    fontSize: "clamp(1.6rem, 2.4vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.5
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
    padding: "8px 24px"
  button-cta-outline:
    backgroundColor: "{colors.white}"
    textColor: "{colors.sand-900}"
    rounded: "{rounded.full}"
    padding: "8px 24px"
  button-cta-on-ink:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "8px 24px"
  button-cta-on-ink-hover:
    backgroundColor: "{colors.sand-100}"
  button-nav:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.full}"
    padding: "6px 16px"
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
  form-panel:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.2xl}"
    padding: "32px"
  section-label:
    textColor: "{colors.sand-500}"
    typography: "{typography.label}"
  calculation-term:
    textColor: "{colors.sand-900}"
    typography: "{typography.figure-term}"
  calculation-margin:
    textColor: "{colors.data}"
    typography: "{typography.figure-term}"
  stacked-bar:
    backgroundColor: "{colors.sand-200}"
    rounded: "{rounded.full}"
    height: "16px"
  tabs-pill:
    backgroundColor: "{colors.sand-50}"
    rounded: "{rounded.lg}"
    padding: "2px"
  tabs-pill-active:
    backgroundColor: "{colors.white}"
    textColor: "{colors.sand-900}"
  segmented-pill:
    backgroundColor: "{colors.sand-100}"
    rounded: "{rounded.full}"
    padding: "4px"
  segmented-pill-active:
    backgroundColor: "{colors.white}"
    textColor: "{colors.sand-900}"
    rounded: "{rounded.full}"
    padding: "8px 16px"
  badge:
    backgroundColor: "{colors.sand-50}"
    textColor: "{colors.sand-600}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
---

# Design System: G-stock

## Overview

**Creative North Star: "Le Registre du comptoir"**

G-stock est le registre que le commerçant tient derrière son comptoir, devenu écran : un papier sable chaud, une encre presque noire pour ce qui engage (valider une vente, demander une démo), des chiffres alignés qui se lisent comme une colonne de cahier, et de petites mentions en mono pour les références, les dates et les intitulés. Rien n'y est décoratif : la couleur ne sort que pour dire quelque chose, l'indigo pour les données et la marge, l'ambre pour ce qui reste dû.

Le système est né dans l'application (`apps/web`) et la landing (`apps/landing`) en hérite : même sable, même encre, même Inter, mêmes étiquettes mono, mêmes ombres douces. L'application est dense et posée en couches (un cadre sable porte la barre latérale, le contenu tient dans un panneau blanc posé dessus) ; la landing reprend les mêmes matériaux à plus grande échelle, avec un composant propre au registre : la ligne de calcul, des termes chiffrés en grand reliés par des opérateurs, qui pose la vraie marge d'un produit comme on la poserait au bas d'une colonne de cahier.

Le thème « Encre » est l'identité de la maison. L'application laisse chaque utilisateur choisir un autre thème (Océan, Forêt, Terre cuite, Améthyste, Graphite, Corail) ou régler lui-même couleur principale, gris, accent, arrondi, police et icônes : c'est un réglage personnel, pas la marque. Toute surface publique (landing, documents, captures de présentation) parle en Encre.

**Key Characteristics:**

- Gris chaud « sable » partout, jamais de gris neutre froid.
- Encre (sand-900) pour l'action ; indigo pour les données et la marge ; ambre pour le dû.
- Inter avec `cv11`, chiffres tabulaires pour tout montant ; Geist Mono 11 px en capitales pour les intitulés et références.
- Surfaces séparées par un liseré fin et une teinte, ombres à peine perceptibles au repos ; un total se pose sous un filet d'encre.
- Mouvement rapide au départ, posé à l'arrivée (`--ease-snappy`), toujours désactivable.

## Colors

Une palette quasi monochrome de sable chaud, tenue par une encre profonde, où deux couleurs seulement ont le droit de parler : l'indigo des données et l'ambre du dû.

### Primary

- **Encre** (`ink`, égale à `sand-900`) : la couleur de l'action et du texte fort. Boutons principaux (`--ui-primary` pointe sur `neutral-900` en clair, `neutral-50` en sombre), titres (`text-highlighted`), bande de section sombre de la landing (licence), filet au-dessus d'un total ou d'un élément de liste titrée, carré du logo. Dans le thème Encre, la couleur principale de Nuxt UI est le sable lui-même (`primary: "sand"`), d'où une action noire et non colorée.

### Secondary

- **Indigo des données** (`data` ; `data-dark` en mode sombre) : la série principale des graphiques (`--ui-chart-1`), la marge dans la ligne de calcul et son segment dans la barre empilée, la progression et la station active du trajet de la marchandise, l'anneau de focus et la sélection de texte sur la landing. Dans l'application, cet accent est réglable par l'utilisateur ; indigo est la valeur d'origine.

### Tertiary

- **Ambre du dû** (`due` sur la landing ; la couleur `warning`, ambre Tailwind, dans l'application) : ce qui reste à payer, les alertes de stock bas, les écarts à surveiller. Sur la landing, il est réservé à un montant dû ; la page actuelle n'en affiche aucun.

### Neutral

La gamme `sand-50` → `sand-950` (teinte 60 à 80, chroma 0,003 à 0,012) remplace le gris de Nuxt UI (`neutral: "sand"`). Rôles en mode clair :

- **Fond du cadre** (`bg-canvas` = `sand-100`) : le fond de l'application et de la landing ; la barre latérale y est posée sans bordure.
- **Surface** (`bg-default` = blanc) : panneaux, cartes, tableaux, champs, panneau du formulaire de contact, bandes blanches de la landing.
- **Surface en retrait** (`bg-muted` = `sand-50`) : en-têtes de tableau, pieds de fenêtre, rail des onglets, badges neutres.
- **Cadre de carte** (`bg-elevated` = `sand-100`) et **survol accentué** (`bg-accented` = `sand-200`, aussi le rail du trajet et le fond de la barre empilée).
- **Liserés** (`border-default` = `sand-200`, `border-accented` = `sand-300`).
- **Texte secondaire** (`text-muted`) : `sand-500` dans l'application (valeur Nuxt UI), `sand-600` sur la landing, plus contrasté sur le fond sable.
- **Catégories sans sens** : dans la barre empilée, la marchandise en `sand-700` et les frais en `sand-400` ; seule la marge prend une couleur.
- **Sur encre** : texte secondaire `sand-300`, traits `sand-700`, survol `sand-800`.
- **Voile des fenêtres** : `sand-950` à 25 % avec un flou de 2 px.

Mode sombre (application seulement) : cadre `sand-950`, surface `sand-900`, surface relevée `sand-800`, liserés `sand-800`, texte fort `sand-50`, action `sand-50`.

Couleurs d'état de l'application : `success` émeraude (encaissé, marge positive), `warning` ambre (dû, stock bas), `error` rouge Nuxt UI (rupture, annulation, perte). Toujours en teinte légère avec liseré (`bg-warning/10 text-warning ring-warning/25`), jamais en aplat plein. Seule exception de sens : sur la landing, quand le prix de vente passe sous le revient, la marge devient « Perte » en `error`, chiffre et segment de barre compris.

### Named Rules

**The One Ink Rule.** L'action est noire. Aucun bouton n'est indigo ni ambre ; une couleur vive sur un bouton n'apparaît que si l'utilisateur a choisi un autre thème.

**The Color Means Something Rule.** L'indigo est une donnée ou une marge, l'ambre est un dû, le rouge est une perte. Si une couleur ne porte pas l'un de ces sens, elle est sable.

**The Warm Gray Rule.** Tout gris est du sable. Un `gray`, `zinc` ou `slate` dans le thème d'origine est une erreur, pas une variante.

## Typography

**Display Font:** Inter (avec sans-serif), variante `cv11` activée sur `body` **Body Font:** Inter (avec sans-serif) **Label/Mono Font:** Geist Mono (avec ui-monospace, monospace)

**Character:** Inter tient tout le texte, du chiffre d'affaires au titre de la landing, serré et sûr de lui aux grandes tailles. Geist Mono est réservé à ce qui se lit comme une écriture de registre : intitulés de carte, de colonne et de terme, références (`V-2026-02364`, `CF-2026-0028`), dates et heures, mentions de provenance.

### Hierarchy

- **Display** (600, `clamp(2.4rem, 5.6vw, 4.75rem)`, 1,02, -0,035em) : une seule phrase par page, l'affirmation d'ouverture de la landing, sur 62 rem au plus. Équilibrée (`text-balance`).
- **Headline** (600, `clamp(2rem, 4vw, 3.25rem)`, 1,05, -0,03em) : titres de section de la landing, phrases complètes en casse de phrase, colonne de 44 à 46 rem.
- **Title** (600, 1,25 rem / 1,75 rem, `tracking-tight`) : titre de page dans l'application (`PagePanel`) ; sur la landing, titres d'élément de 1,125 à 1,5 rem (liste titrée, question, station, panneau du trajet).
- **Body** (400, 0,875 rem / 1,25 rem) : le texte courant de l'application, dense ; libellés de champ à 13 px.
- **Body-lead** (400, 17 px / 28 px, ou `text-lg`) : paragraphes de la landing, `text-muted`, `text-pretty`, colonne de 38 à 42 rem (environ 65 à 75 caractères), 28 rem sur la bande encre.
- **Figure** (600, `tabular-nums`) : tout montant, quantité ou compteur. Montant suivi de « FCFA », milliers séparés par une espace. Le prix de la licence monte à `clamp(1.75rem, 3vw, 2.5rem)`.
- **Figure-term** (600, `clamp(1.6rem, 2.4vw, 2.25rem)`, interligne 1,5, `tracking-tight`, `tabular-nums`, sans retour à la ligne) : les termes de la ligne de calcul. L'unité (« FCFA ») suit à 0,5em, 500, `text-muted`, interlettrage normal ; le champ du prix de vente reprend exactement cette taille.
- **Label** (Geist Mono 500, 11 px, 0,06 à 0,08em, capitales) : intitulés de carte (`pageCard` title, 0,08em), de terme de calcul (0,07em), en-têtes de tableau (0,06em), références, horodatages, mention « Capture réelle · données de démonstration » sous une capture. 10 px dans les menus compacts.

### Named Rules

**The Ledger Label Rule.** Le mono en capitales est le titre d'une carte, d'une colonne ou d'une donnée : il remplace l'intitulé, il ne se pose jamais au-dessus d'un titre comme surtitre.

**The Aligned Figures Rule.** Un nombre affiché se lit en colonne : `tabular-nums`, toujours.

## Layout

**Application.** Coque de tableau de bord Nuxt UI : barre latérale sur le fond `bg-canvas`, sans bordure ; à partir de `lg`, le contenu tient dans un panneau blanc posé dans le cadre avec 8 px de marge (`lg:my-2 lg:me-2`), arrondi `xl`, liseré et ombre de carte. Barre du haut de 3,5 rem, barre d'outils d'au moins 48 px. Cartes : un cadre sable de 4 px (`p-1`) autour d'une surface blanche de 16 px de marge intérieure (20 px dès `sm`). Densité de travail : texte à 14 px, lignes de tableau à 12 px de marge verticale.

**Landing.** Conteneur de 80 rem, gouttières de 16 px (32 px dès `sm`), sections de 96 px de marge verticale (128 px dès `sm`) ; l'ouverture est plus serrée (40 px en haut, 56 px dès `sm`, 80 px en bas) pour que la ligne de calcul, sa barre et les deux boutons tiennent dans le premier écran. Les passages de lecture se resserrent : questions à 56 rem. Les sections alternent le fond sable, une bande blanche bordée (`border-y`) et une bande encre. Ancres décalées de 5 rem sous la barre collante.

**Ligne de calcul.** À partir de `lg`, une grille de 7 colonnes où les termes (`1fr`) alternent avec des colonnes d'opérateur de 2,5 rem ; deux opérations se lisent l'une sous l'autre (revient, puis marge), la seconde décalée pour que son premier terme tombe sous le deuxième de la première ; 40 px entre les lignes. Sous `lg`, une colonne de registre : opérateur dans une colonne de 2 rem à gauche, terme à droite, 20 px entre les termes.

**Listes titrées.** Trois ou quatre éléments en grille (`md:grid-cols-3` sur blanc, `sm:grid-cols-2` sur encre), 32 à 40 px d'écart ; chaque élément commence par un filet (voir Shapes), puis un titre et un texte `text-muted`. C'est la mise en page des contenus parallèles, à la place de cartes.

**Captures.** Une capture réelle est toujours posée dans un cadre sable (`bg-elevated`, `rounded-2xl`, 6 à 8 px de marge) autour d'une capture blanche cerclée (`rounded-xl ring`), avec la mention de provenance en Label dessous ou à côté. Sur grand écran, une capture peut n'être montrée que dans sa partie haute ; sur téléphone, elle n'est pas réduite : elle est montrée à 75 % de sa taille d'origine et cadrée sur un point d'intérêt.

Points de rupture Tailwind par défaut : `sm` 640 px, `md` 768 px, `lg` 1024 px. Sur téléphone, les lignes horizontales (trajet, calcul) deviennent verticales.

## Elevation & Depth

Le système est en couches tonales, pas en ombres : c'est le liseré fin et l'écart de teinte entre sable et blanc qui séparent les surfaces. Les ombres existent, mais au repos elles se devinent à peine ; elles ne prennent de l'ampleur que pour ce qui flotte au-dessus de la page (menus, fenêtres, infobulles). Chaque ombre a un décalage vertical et un flou doux, teintée de brun (`rgb(41 37 36)`, `rgb(28 25 23)`), jamais un halo coloré.

### Shadow Vocabulary

- **Tactile** (`0 1px 2px 0 rgb(41 37 36 / 0.06), 0 1px 1px -1px rgb(41 37 36 / 0.06)`) : boutons secondaires, onglet actif, lien actif de la navigation, carte radio cochée. Une touche en relief.
- **Primary** (`inset 0 1px 0 0 rgb(255 255 255 / 0.14), 0 1px 2px 0 rgb(28 25 23 / 0.28), 0 2px 4px -2px rgb(28 25 23 / 0.2)`) : bouton principal, avec un dégradé blanc de 10 % en haut.
- **Card** (`0 1px 2px 0 rgb(41 37 36 / 0.04)`) : cartes, tableaux, panneau de contenu ; toujours avec un liseré `ring-default`.
- **Overlay** (`0 16px 36px -12px rgb(28 25 23 / 0.2), 0 4px 10px -4px rgb(28 25 23 / 0.08)`) : menus, popovers, fenêtres, toasts, infobulles.
- **Bubble** (`--shadow-bubble` : `0 1px 2px 0 rgb(41 37 36 / 0.05), 0 8px 24px -16px rgb(41 37 36 / 0.25)`) : la pastille blanche choisie d'un sélecteur en pilule sur la landing (type de demande). Le flou est large mais l'ombre est rentrée de 16 px : elle ne déborde pas d'une petite commande.

En mode sombre, les ombres de l'application passent au noir pur, plus fortes, avec un filet clair intérieur sur les touches.

### Named Rules

**The Hairline First Rule.** Une surface au repos se sépare par un liseré et une teinte ; son ombre ne dépasse pas 2 px de flou. Les grandes ombres sont réservées aux éléments qui flottent ; un panneau de la landing (formulaire, capture) n'a qu'un liseré ou un cadre sable.

## Shapes

Arrondis dérivés d'une base unique `--ui-radius` de 0,375 rem (6 px) : `sm` 6 px, `md` 9 px (boutons, champs, infobulles), `lg` 12 px (menus, rail d'onglets, éléments de navigation), `xl` 18 px (cartes, tableaux, fenêtres, panneau de contenu), `2xl` 24 px (cadres de capture, panneau du formulaire de contact). Une carte encadrée garde des arrondis concentriques : l'intérieur vaut `xl` moins 4 px. La base est un réglage utilisateur (0 à 0,75 rem) ; tout arrondi doit en dériver, jamais une valeur fixe.

Formes propres à la landing : les boutons en pilule, le sélecteur en pilule, la barre empilée en pilule de 16 px de haut (ses segments sont coupés net, seule la barre est arrondie). Les points d'étape sont des anneaux de 26 px à bordure de 4 px reliés par un rail de 4 px aux bouts arrondis. Badges et compteurs en pilule.

**Filets.** Les traits sont horizontaux et pleine largeur, jamais une bordure latérale colorée. Filet d'encre de 1 px au-dessus d'un total dans la colonne de registre ; filet d'encre de 2 px au-dessus de chaque élément d'une liste titrée sur fond blanc, `sand-700` de 1 px sur la bande encre ; liseré `border-default` de 1 px sous chaque question.

## Components

### Buttons

Des touches nettes, en léger relief, qui s'enfoncent d'un pixel au clic.

- **Shape:** arrondi `md` (9 px) dans l'application ; pilule sur la landing.
- **Primary:** encre, texte blanc, dégradé blanc de 10 % en haut et ombre Primary ; survol à 90 % d'opacité. Marge horizontale de 12 px (`md`), 14 px (`lg`).
- **Hover / Focus:** transition de couleur, fond, ombre et translation ; `active:translate-y-px`, neutralisé quand le bouton est désactivé.
- **Outline (neutre):** surface blanche, liseré `ring-default`, ombre Tactile ; survol `bg-muted`, appui `bg-elevated`.
- **Subtle / Ghost:** subtle en `bg-muted` avec ombre Tactile ; ghost en `text-toned`, fond `bg-accented/50` au survol.
- **Landing:** pilules de taille `xl` à 24 px de marge horizontale, par paires : principal encre (« Demander une démo », flèche en fin), secondaire à liseré `border-accented` sur surface blanche, survol `bg-elevated` (« Voir la licence »). Sans dégradé ni ombre Primary : la pilule reste plate. Sur la bande encre, le principal devient blanc à texte encre (survol `sand-100`) et le secondaire passe en liseré `sand-700`, texte blanc, survol `sand-800`. Une icône de fin ne nomme que le canal réel de l'action (WhatsApp, e-mail) ou une direction (flèche).

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
- **Landing:** pas de rangée de cartes ; les contenus parallèles sont des listes titrées sous filet (voir Layout). Le seul panneau est le formulaire de contact : surface blanche, liseré de 1 px, arrondi `2xl`, 20 px de marge intérieure (32 px dès `sm`), sans ombre.

### Tables

Surface blanche arrondie `xl` avec liseré et ombre Card ; en-têtes en `bg-muted`, Label mono 11 px à 0,06em ; lignes de 12 px de marge verticale, survol `bg-muted/70`.

### Inputs / Fields

- **Style:** variante outline par défaut, fond blanc (`bg-muted` en sombre), liseré, `shadow-xs`, texte 14 px ; libellés à 13 px. Sur la landing, champs de taille `xl`, pleine largeur, libellé au-dessus, astérisque des champs requis.
- **Focus:** un trait gris foncé (`ring-neutral-400`) et un halo de 4 px à 10 % de l'encre, plutôt que le noir plein de la couleur principale.
- **Error:** message sous le champ en `error`, affiché seulement après une tentative d'envoi ; il nomme ce qui manque (« Indiquez votre nom. »).
- **Menus déroulants:** arrondi `lg`, ombre Overlay ; en sombre, fond `bg-elevated/95` avec flou.

### Tabs

Contrôle segmenté : rail `bg-muted` arrondi `lg`, 2 px de marge, liseré ; l'onglet actif est une touche blanche en relief (ombre Tactile, liseré), texte 13 px. À la taille du contenu, calé à gauche, défilant si l'écran est étroit.

Variante de la landing, pour un choix exclusif dans un formulaire : rail `bg-elevated` en pilule, 4 px de marge, sans liseré ; options en pilule de 14 px, 500, `text-muted` (survol `text-highlighted`) ; l'option choisie est une pastille blanche à ombre Bubble. Ce sont de vrais boutons radio masqués : le focus clavier dessine un contour indigo de 2 px sur la pastille.

### Navigation

- **Application:** navigation verticale en pilules ; lien actif en surface blanche avec ombre Tactile et liseré, survol `bg-accented/50` ; icônes de 18 px en `text-muted`. Fil d'Ariane : parents en `text-muted`, page en cours en `text-highlighted` 500.
- **Landing:** barre collante de 64 px sur `bg-canvas/85` floutée ; logo dans un carré encre arrondi `md` ; liens 14 px en `text-muted`, `text-highlighted` au survol, espacés de 28 px ; à droite, « Demander une démo » en pilule encre de taille par défaut. Les liens disparaissent sous `md`, le bouton reste.

### Overlays

Fenêtres et volets arrondis `xl`, ombre Overlay, pied de fenêtre en `bg-muted`, voile sable à 25 % avec flou de 2 px. Infobulles inversées (fond encre, texte blanc, 28 px de haut) ; infobulles de graphique en surface claire.

### Ligne de calcul (composant signature de la landing)

Une opération posée comme au cahier : des termes reliés par des opérateurs (`≈`, `+`, `=`, `−`, `=`). Chaque terme a trois lignes : l'intitulé en Label mono (le nom de la donnée, « Prix usine », « Frais d'approche »), le chiffre en Figure-term avec son unité réduite, puis une note de 14 px en `text-muted` qui dit d'où vient le chiffre (taux de change, « calculé ci-dessus »). Les opérateurs sont en `text-muted`, graisse 300, à la taille des chiffres et calés sur leur ligne ; ils sont décoratifs pour les lecteurs d'écran. Un terme repris d'une ligne précédente passe en `text-muted`. Le total final, la marge, est en indigo, intitulé compris (en `error` et intitulé « Perte » sous le revient), annoncé poliment aux lecteurs d'écran quand il change.

Un terme est modifiable : le prix de vente, un champ numérique à la taille des chiffres (56 px de haut, 13 rem au plus, boutons de pas empilés) ; tout se recalcule à la saisie. En colonne de registre (sous `lg`), chaque total se pose sous un filet d'encre de 1 px avec 12 px d'air.

Sous la ligne, la **barre empilée** découpe le prix de vente (ou le revient, quand on vend à perte) : marchandise `sand-700`, frais `sand-400`, marge `data` (ou `error`), sur un fond `bg-accented` ; les largeurs glissent en 500 ms (`--ease-snappy`). La légende suit en 14 px : pastille de 10 px, nom, montant tabulaire en `text-muted` ; puis la source des chiffres en `text-muted`.

À l'arrivée, le titre, puis chaque terme et chaque opérateur se posent un à un (entrée de 520 ms avec translation de 14 px, échelle 0,98 et flou de 4 px, décalées de 40 à 120 ms), une seule fois ; sans mouvement, tout est là d'emblée.

### Trajet de la marchandise (landing)

Ligne de stations : rail `bg-accented` de 4 px, progression indigo qui s'étend (500 ms, `--ease-in-out-strong`), anneaux de 26 px (indigo une fois atteints, `sand-300` sinon) dont l'actif porte un point indigo ; titre de station 18 px 600, `text-highlighted` une fois actif. Onglets accessibles au clavier (flèches). Le panneau associé montre une capture réelle et son texte ; il change par fondu et léger flou en 300 ms.

### Questions

Liste de `details` natifs séparés par un liseré `border-default` : question en 18 px 600 sur 20 px de marge verticale, signe `+` de 20 px en `text-muted` à droite qui tourne de 45° à l'ouverture (200 ms) ; réponse en 17 px / 28 px `text-muted`, 44 rem au plus.

### Contacts directs

Colonne de 20 rem à côté du formulaire : icône Tabler de 20 px en `text-muted`, canal en 14 px `text-muted` au-dessus, valeur en 500 (chiffres tabulaires pour le téléphone), soulignée au survol.

## Do's and Don'ts

### Do:

- **Do** tirer tout gris de la gamme `sand` et toute action de l'encre (`sand-900`, ou `sand-50` en sombre).
- **Do** réserver l'indigo aux données (séries de graphique, marge, progression, position active, focus) et l'ambre à ce qui reste dû ou demande attention.
- **Do** composer tout montant en chiffres tabulaires, suivi de « FCFA », milliers séparés par une espace.
- **Do** titrer les cartes, colonnes, termes et références en Geist Mono 11 px, capitales, 0,06 à 0,08em, `text-muted`.
- **Do** séparer les surfaces au repos par un liseré `ring-default` et la teinte sable/blanc, avec au plus l'ombre Card.
- **Do** poser un total ou un élément de liste sous un filet horizontal d'encre, comme au bas d'une colonne de registre.
- **Do** dériver chaque arrondi de `--ui-radius` (cartes `xl`, champs et boutons `md`, menus `lg`).
- **Do** animer avec `--ease-snappy` (`cubic-bezier(0.23, 1, 0.32, 1)`), sous 300 ms pour tout ce qui répond à une saisie, et couper le mouvement sous `prefers-reduced-motion`.
- **Do** montrer l'application par de vraies captures et de vrais chiffres de la base de démonstration, dans le cadre sable, avec la mention « données de démonstration » et la référence d'origine quand il y en a une.
- **Do** dessiner les icônes avec Tabler (thème Encre) ; le logo est `i-tabler-packages` dans un carré encre.

### Don't:

- **Don't** colorer un bouton dans le thème Encre : ni indigo, ni ambre, ni dégradé de marque.
- **Don't** présenter un thème utilisateur (Océan, Forêt, Terre cuite, Améthyste, Graphite, Corail) comme l'identité de G-stock.
- **Don't** poser une étiquette mono en capitales au-dessus d'un titre comme surtitre : elle est le titre de la carte ou le nom d'une donnée, pas un chapeau.
- **Don't** utiliser un gris froid (`gray`, `zinc`, `slate`) ou le noir pur `#000` pour le texte et l'encre.
- **Don't** mettre une grande ombre sous une surface au repos : l'ombre Overlay est pour ce qui flotte.
- **Don't** afficher un montant en chiffres proportionnels ni en Geist Mono : le mono est pour les références et les intitulés, Inter tabulaire pour les nombres.
- **Don't** remplir une alerte d'une couleur pleine : teinte à 10 %, texte et liseré de la couleur du sens.
- **Don't** fixer un arrondi en pixels dans l'application : il casse les thèmes à angles vifs ou très arrondis.
