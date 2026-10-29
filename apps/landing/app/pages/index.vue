<script setup lang="ts">
const { licencePrice } = useContact();

// Le bouton « Demander une licence » choisit la licence dans le formulaire de contact.
const requestKind = ref<RequestKind>("demo");
const askFor = async (kind: RequestKind) => {
  requestKind.value = kind;
  await navigateTo({ hash: "#contact" });
};

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

const LICENCE = [
  {
    text: "Une licence couvre un magasin, sur un ou plusieurs postes. Chaque personne a son compte.",
    title: "Pour tout votre magasin",
  },
  {
    text: "J'installe G-stock sur votre ordinateur, j'entre vos produits avec vous et je forme votre équipe.",
    title: "Installation et formation",
  },
  {
    text: "Les nouvelles versions de G-stock vous sont livrées avec la licence.",
    title: "Mises à jour",
  },
  {
    text: "Une question, un souci : vous m'écrivez ou vous m'appelez.",
    title: "Assistance",
  },
];

const QUESTIONS = computed(() => [
  {
    answer: `Une licence par magasin, payée une fois, sans abonnement. ${licencePrice}. Elle comprend l'installation, la formation de votre équipe, les mises à jour et l'assistance.`,
    label: "Combien coûte G-stock ?",
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
      "Chaque vente à crédit est suivie jusqu'au dernier franc : acompte, paiements, reste dû. Les impayés anciens remontent en alerte, et le reçu part au client sur WhatsApp.",
    label: "Et les ventes à crédit ?",
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
]);
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
        <div class="text-muted hidden items-center gap-7 text-sm md:flex">
          <a href="#trajet" class="hover:text-highlighted">Fonctionnalités</a>
          <a href="#licence" class="hover:text-highlighted">Licence</a>
          <a href="#questions" class="hover:text-highlighted">Questions</a>
        </div>
        <UButton to="#contact" color="neutral" class="bg-ink rounded-full px-4">
          Demander une démo
        </UButton>
      </nav>
    </header>

    <main>
      <MarginCalculation />

      <GoodsRoute />

      <section class="bg-default border-default border-y">
        <div class="mx-auto max-w-7xl px-4 py-24 sm:px-8 sm:py-32">
          <h2
            class="max-w-176 text-[clamp(2rem,4vw,3.25rem)]/[1.05] font-semibold tracking-[-0.03em] text-balance"
          >
            Chaque matin, votre magasin en un coup d'œil.
          </h2>
          <div class="mt-12 flex flex-col gap-10">
            <figure>
              <div class="bg-elevated rounded-2xl p-1.5 sm:p-2">
                <AppCapture
                  src="/captures/tableau-de-bord.webp"
                  alt="Tableau de bord : chiffre d'affaires, marge brute, ventes et créances des 30 derniers jours"
                  :focus="[0.5, 0.24]"
                  :height="0.46"
                />
              </div>
              <figcaption class="text-muted mt-3 font-mono text-[11px] tracking-[0.06em] uppercase">
                Capture réelle · données de démonstration
              </figcaption>
            </figure>
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

      <section id="licence" class="bg-ink text-white">
        <div
          class="mx-auto grid max-w-7xl gap-14 px-4 py-24 sm:px-8 sm:py-32 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"
        >
          <div>
            <h2
              class="text-[clamp(2rem,4vw,3.25rem)]/[1.05] font-semibold tracking-[-0.03em] text-balance"
            >
              Une licence par magasin, sans abonnement.
            </h2>
            <p class="text-sand-300 mt-4 max-w-md text-lg text-pretty">
              Vous payez la licence une fois, sans abonnement. Tout ce qu'il faut pour démarrer est
              compris.
            </p>
            <p
              class="mt-10 text-[clamp(1.75rem,3vw,2.5rem)] font-semibold tracking-tight tabular-nums"
            >
              {{ licencePrice }}
            </p>
            <div class="mt-6 flex flex-wrap gap-3">
              <UButton
                size="xl"
                color="neutral"
                class="text-ink hover:bg-sand-100 rounded-full bg-white px-6"
                @click="askFor('licence')"
              >
                Demander une licence
              </UButton>
              <UButton
                size="xl"
                color="neutral"
                variant="outline"
                class="ring-sand-700 hover:bg-sand-800 rounded-full bg-transparent px-6 text-white"
                @click="askFor('demo')"
              >
                Voir une démo d'abord
              </UButton>
            </div>
          </div>
          <dl class="grid gap-x-10 gap-y-10 sm:grid-cols-2">
            <div v-for="item in LICENCE" :key="item.title" class="border-sand-700 border-t pt-5">
              <dt class="text-lg font-semibold">
                {{ item.title }}
              </dt>
              <dd class="text-sand-300 mt-2 text-pretty">{{ item.text }}</dd>
            </div>
          </dl>
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

      <div class="bg-default border-default border-t">
        <ContactSection v-model:kind="requestKind" />
      </div>
    </main>

    <footer class="border-default border-t">
      <div
        class="text-muted mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm sm:px-8"
      >
        <p>© 2026 G-stock · Conçu par un importateur, pour son propre magasin d'abord.</p>
        <p>Captures et chiffres : application réelle, données de démonstration.</p>
      </div>
    </footer>
  </div>
</template>
