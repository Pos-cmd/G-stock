<script setup lang="ts">
const { demo, whatsapp } = useContact();

const DAILY = [
  {
    text: "Le chiffre d'affaires et le nombre de ventes des 30 derniers jours, comparés aux 30 précédents.",
    title: "Ce que vous avez vendu",
  },
  {
    text: "La marge brute et son taux, calculés sur le coût réel des lots vendus, frais compris.",
    title: "Ce que vous avez gagné",
  },
  {
    text: "Ce que vos clients vous doivent, combien sont débiteurs, et qui est en retard critique.",
    title: "Qui vous doit",
  },
];

const STEPS = [
  {
    text: "Vous voyez G-stock avec cinq ans de ventes fictives, sur les écrans que vous utiliserez.",
    title: "La démonstration",
  },
  {
    text: "Vous me parlez de votre magasin : vos produits, vos fournisseurs, vos vendeurs.",
    title: "On en parle sur WhatsApp",
  },
  {
    text: "J'installe G-stock sur votre ordinateur, j'entre vos produits et je forme votre équipe sur place.",
    title: "Installation et formation",
  },
  {
    text: "Une question, un souci : je reste joignable, et les sauvegardes protègent vos données.",
    title: "Je reste là",
  },
];

const QUESTIONS = [
  {
    answer:
      "L'installation et la formation sont payantes. Le devis dépend de votre magasin : nombre de produits, de postes et de personnes à former. Écrivez-moi sur WhatsApp pour le recevoir.",
    label: "Combien ça coûte ?",
  },
  {
    answer:
      "Non. G-stock fonctionne sur l'ordinateur du magasin et s'ouvre dans le navigateur. Internet ne sert qu'à envoyer un reçu sur WhatsApp ou la copie de sauvegarde en ligne.",
    label: "Faut-il une connexion internet ?",
  },
  {
    answer:
      "Elles restent dans un fichier sur votre ordinateur, pas chez quelqu'un d'autre. G-stock en fait une copie chaque jour, et peut l'envoyer dans votre Google Drive.",
    label: "Où sont mes données ?",
  },
  {
    answer:
      "Oui. Tissus, quincaillerie, électricité, plastiques : G-stock gère toutes les unités (pièce, carton, rouleau, kg, mètre) et peut ouvrir un carton pour vendre à la pièce.",
    label: "Je ne vends pas que du tissu, ça marche ?",
  },
  {
    answer:
      "Oui. Chaque personne a son compte. Les ventes, remises et annulations restent tracées avec leur auteur et leur motif.",
    label: "Mes vendeurs peuvent-ils l'utiliser ?",
  },
];
</script>

<template>
  <div>
    <header class="bg-canvas/85 sticky top-0 z-20 backdrop-blur-md">
      <nav class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
        <NuxtLink
          to="/"
          class="flex items-center gap-2.5 font-semibold"
          aria-label="G-stock, accueil"
        >
          <span class="bg-ink grid size-7 place-items-center rounded-md text-white">
            <UIcon name="i-tabler-packages" class="size-4" />
          </span>
          G-stock
        </NuxtLink>
        <div class="text-muted hidden items-center gap-7 text-[15px] md:flex">
          <a href="#trajet" class="hover:text-highlighted">Ce que fait G-stock</a>
          <a href="#installation" class="hover:text-highlighted">Comment ça se passe</a>
          <a href="#questions" class="hover:text-highlighted">Questions</a>
        </div>
        <UButton
          :to="whatsapp()"
          target="_blank"
          rel="noopener"
          color="neutral"
          variant="outline"
          trailing-icon="i-tabler-brand-whatsapp"
          class="bg-default rounded-full px-4"
        >
          Nous écrire
        </UButton>
      </nav>
    </header>

    <main>
      <ConversationHero />

      <GoodsRoute />

      <section class="bg-default border-default border-y">
        <div class="mx-auto max-w-7xl px-4 py-24 sm:px-8 sm:py-32">
          <h2
            class="max-w-176 text-[clamp(2rem,4vw,3.25rem)]/[1.05] font-semibold tracking-[-0.03em] text-balance"
          >
            Chaque matin, votre magasin en un coup d'œil.
          </h2>
          <div class="mt-12 flex flex-col gap-10">
            <div class="bg-elevated rounded-2xl p-1.5 sm:p-2">
              <AppCapture
                src="/captures/tableau-de-bord.webp"
                alt="Tableau de bord : chiffre d'affaires, marge brute, ventes et créances des 30 derniers jours"
                :focus="[0.5, 0.24]"
                :height="0.46"
              />
            </div>
            <dl class="grid gap-8 md:grid-cols-3 md:gap-10">
              <div v-for="item in DAILY" :key="item.title" class="border-ink border-t-2 pt-4">
                <dt class="text-xl font-semibold tracking-tight">
                  {{ item.title }}
                </dt>
                <dd class="text-muted mt-2 text-pretty">{{ item.text }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section id="installation" class="bg-ink text-white">
        <div class="mx-auto max-w-7xl px-4 py-24 sm:px-8 sm:py-32">
          <h2
            class="max-w-2xl text-[clamp(2rem,4vw,3.25rem)]/[1.05] font-semibold tracking-[-0.03em] text-balance"
          >
            Je viens l'installer chez vous.
          </h2>
          <p class="text-sand-300 mt-4 max-w-xl text-lg text-pretty">
            Pas de logiciel à télécharger ni à configurer seul. L'installation et la formation sont
            payantes, avec un devis selon votre magasin.
          </p>
          <ol class="relative mt-16 grid gap-10 md:grid-cols-4 md:gap-6">
            <div
              class="bg-sand-700 absolute top-2.75 hidden h-1 rounded-full md:inset-x-[12.5%] md:block"
              aria-hidden="true"
            />
            <li v-for="(step, index) in STEPS" :key="step.title" class="relative md:text-center">
              <span
                class="border-data bg-ink relative z-10 mb-5 grid size-6.5 place-items-center rounded-full border-4 md:mx-auto"
                aria-hidden="true"
              >
                <span v-if="index === 0" class="bg-data size-2 rounded-full" />
              </span>
              <p class="text-lg font-semibold">{{ step.title }}</p>
              <p class="text-sand-300 mt-2 text-pretty">{{ step.text }}</p>
            </li>
          </ol>
          <div class="mt-16 flex flex-wrap gap-3 md:justify-center">
            <UButton
              :to="demo.to"
              :external="demo.external"
              target="_blank"
              rel="noopener"
              size="xl"
              color="neutral"
              class="text-ink hover:bg-sand-100 rounded-full bg-white px-6"
            >
              {{ demo.label }}
            </UButton>
            <UButton
              :to="whatsapp()"
              target="_blank"
              rel="noopener"
              size="xl"
              color="neutral"
              variant="outline"
              trailing-icon="i-tabler-brand-whatsapp"
              class="ring-sand-700 hover:bg-sand-800 rounded-full bg-transparent px-6 text-white"
            >
              Écrire sur WhatsApp
            </UButton>
          </div>
        </div>
      </section>

      <section id="questions" class="mx-auto max-w-4xl px-4 py-24 sm:px-8 sm:py-32">
        <h2 class="text-[clamp(2rem,4vw,3.25rem)]/[1.05] font-semibold tracking-[-0.03em]">
          Vos questions
        </h2>
        <div class="mt-10">
          <details
            v-for="question in QUESTIONS"
            :key="question.label"
            class="group border-default border-b"
          >
            <summary
              class="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-semibold [&::-webkit-details-marker]:hidden"
            >
              {{ question.label }}
              <UIcon
                name="i-tabler-plus"
                class="text-muted size-5 shrink-0 transition-transform duration-200 group-open:rotate-45"
              />
            </summary>
            <p class="text-muted max-w-176 pb-6 text-[17px]/7 text-pretty">
              {{ question.answer }}
            </p>
          </details>
        </div>
      </section>

      <section class="mx-auto max-w-216 px-4 pb-28 sm:px-8">
        <div class="flex flex-col gap-4">
          <div
            class="bg-default shadow-bubble max-w-xl self-start rounded-[1.4rem] rounded-bl-md px-6 py-5"
          >
            <p class="text-[clamp(1.6rem,3.4vw,2.5rem)]/[1.08] font-semibold tracking-[-0.03em]">
              Parlons de votre magasin.
            </p>
          </div>
          <UButton
            :to="whatsapp()"
            target="_blank"
            rel="noopener"
            size="xl"
            color="neutral"
            trailing-icon="i-tabler-brand-whatsapp"
            class="bg-ink self-end rounded-[1.4rem] rounded-br-md px-6 py-4 text-base"
          >
            {{ CONTACT_MESSAGE }}
          </UButton>
        </div>
      </section>
    </main>

    <footer class="border-default border-t">
      <div
        class="text-muted mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm sm:px-8"
      >
        <p>© 2026 G-stock · Conçu par un importateur, pour son propre magasin d'abord.</p>
        <p>Captures : application réelle, données de démonstration.</p>
      </div>
    </footer>
  </div>
</template>
