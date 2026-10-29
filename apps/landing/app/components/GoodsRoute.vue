<script setup lang="ts">
// Le trajet de la marchandise, dessiné comme une ligne : chaque station montre l'écran de G-stock
// qui la suit. Captures réelles de l'application, sur la base de démonstration.
const STATIONS = [
  {
    alt: "Simulation d'une commande : achat, frais d'approche, prix de revient et vente",
    detail:
      "Avant de commander, saisissez les produits, les prix en RMB, le fret et la douane prévus : G-stock donne le prix de revient de chaque produit et la marge à attendre. Le tout en PDF.",
    id: "simuler",
    focus: [0.86, 0.72] as [number, number],
    image: "/captures/simulation.webp",
    place: "Avant de commander",
    title: "Simuler",
  },
  {
    alt: "Fiche d'une commande fournisseur avec ses produits et ses frais",
    detail:
      "Achat en yuans, paiement en dollars, vente en francs CFA : la commande garde ses taux de change. Les frais d'approche sont répartis sur les produits, au prorata de la valeur, du poids ou à parts égales.",
    id: "commander",
    focus: [0.72, 0.74] as [number, number],
    image: "/captures/commande-fiche.webp",
    place: "Guangzhou",
    title: "Commander",
  },
  {
    alt: "Liste des commandes avec leur statut et ce qui reste à payer",
    detail:
      "Payez le fournisseur en plusieurs fois, chaque versement à son taux du jour. Vous voyez ce qui reste à payer et le gain ou la perte de change.",
    id: "payer",
    focus: [0.84, 0.42] as [number, number],
    image: "/captures/commandes.webp",
    place: "Fournisseur",
    title: "Payer",
  },
  {
    alt: "Liste des produits avec le stock, la couverture et la valeur du stock",
    detail:
      "À la réception, chaque produit entre en stock au coût réel, fret et douane compris. Les ruptures et les stocks bas sont signalés.",
    id: "stocker",
    focus: [0.56, 0.42] as [number, number],
    image: "/captures/produits.webp",
    place: "Port de Lomé",
    title: "Stocker",
  },
  {
    alt: "Formulaire de vente : client, articles, paiement comptant ou à crédit",
    detail:
      "Une vente au comptant ou à crédit, avec acompte. Le coût des lots vendus est connu d'avance : vous voyez la marge avant de valider.",
    id: "vendre",
    focus: [0.84, 0.82] as [number, number],
    image: "/captures/nouvelle-vente.webp",
    place: "Comptoir",
    title: "Vendre",
  },
  {
    alt: "Liste des clients avec leur solde et l'ancienneté de leurs impayés",
    detail:
      "Le solde de chaque client se calcule tout seul et les impayés anciens remontent en alerte. Reçus et fiches en PDF ; le reçu part au client sur WhatsApp.",
    id: "encaisser",
    focus: [0.78, 0.62] as [number, number],
    image: "/captures/clients.webp",
    place: "Caisse",
    title: "Encaisser",
  },
] as const;

const active = ref(0);
const current = computed(() => STATIONS[active.value] ?? STATIONS[0]);
const progress = computed(() => active.value / (STATIONS.length - 1));

// Les stations sont en ligne à partir de 640 px, en colonne en dessous.
const horizontal = ref(true);
onMounted(() => {
  const query = window.matchMedia("(min-width: 640px)");
  horizontal.value = query.matches;
  query.addEventListener("change", (event) => {
    horizontal.value = event.matches;
  });
});

// Clavier : flèches (gauche/droite ou haut/bas) pour passer d'une station à l'autre.
const tabs = useTemplateRef<HTMLButtonElement[]>("tabs");
const onKey = (event: KeyboardEvent) => {
  const step = { ArrowDown: 1, ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1 }[event.key];
  if (!step) {
    return;
  }
  event.preventDefault();
  active.value = (active.value + step + STATIONS.length) % STATIONS.length;
  tabs.value?.[active.value]?.focus();
};
</script>

<template>
  <section id="trajet" class="mx-auto max-w-7xl px-4 py-24 sm:px-8 sm:py-32">
    <h2
      class="max-w-184 text-[clamp(2rem,4vw,3.25rem)]/[1.05] font-semibold tracking-[-0.03em] text-balance"
    >
      Ce calcul, G-stock le fait pour tout votre stock.
    </h2>
    <p class="text-muted mt-4 max-w-152 text-lg text-pretty">
      De la commande en Chine à l'encaissement du client, G-stock suit la marchandise à chaque
      étape. Choisissez une étape pour voir l'écran qui la suit.
    </p>

    <div class="mt-12 pt-2 pb-3">
      <div
        role="tablist"
        aria-label="Étapes du trajet"
        :aria-orientation="horizontal ? 'horizontal' : 'vertical'"
        class="relative grid gap-5 sm:grid-cols-6 sm:gap-0"
        @keydown="onKey"
      >
        <div
          class="bg-accented absolute inset-s-2.75 top-3.25 bottom-3.25 w-1 rounded-full sm:inset-x-[8.33%] sm:top-2.75 sm:bottom-auto sm:h-1 sm:w-auto"
        />
        <div
          class="bg-data absolute inset-s-2.75 top-3.25 h-[calc(100%-26px)] w-1 origin-top rounded-full transition-transform duration-500 ease-in-out-strong max-sm:transform-[scaleY(var(--progress))] sm:inset-s-[8.33%] sm:top-2.75 sm:h-1 sm:w-[83.33%] sm:origin-left sm:transform-[scaleX(var(--progress))]"
          :style="{ '--progress': progress }"
        />
        <button
          v-for="(station, index) in STATIONS"
          :id="`station-${station.id}`"
          ref="tabs"
          :key="station.id"
          type="button"
          role="tab"
          :aria-selected="index === active"
          :aria-controls="`ecran-${station.id}`"
          :tabindex="index === active ? 0 : -1"
          class="group relative flex items-center gap-4 rounded-lg text-start sm:flex-col sm:gap-3 sm:px-1 sm:text-center"
          @click="active = index"
        >
          <span
            class="relative z-10 grid size-6.5 place-items-center rounded-full border-4 transition-[border-color,background-color,transform] duration-300 group-active:scale-90"
            :class="
              index <= active
                ? 'border-data bg-default'
                : 'border-sand-300 bg-default group-hover:border-sand-400'
            "
          >
            <span
              class="bg-data size-2 rounded-full transition-transform duration-300"
              :class="index === active ? 'scale-100' : 'scale-0'"
            />
          </span>
          <span>
            <span
              class="block text-lg font-semibold transition-colors"
              :class="
                index === active ? 'text-highlighted' : 'text-muted group-hover:text-highlighted'
              "
            >
              {{ station.title }}
            </span>
            <span
              class="mt-0.5 block font-mono text-[11px] tracking-[0.06em] uppercase"
              :class="index === active ? 'text-data' : 'text-muted'"
            >
              {{ station.place }}
            </span>
          </span>
        </button>
      </div>
    </div>

    <div
      :id="`ecran-${current.id}`"
      role="tabpanel"
      :aria-labelledby="`station-${current.id}`"
      class="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <div class="bg-elevated rounded-2xl p-1.5 sm:p-2">
        <Transition
          mode="out-in"
          enter-active-class="transition-[opacity,filter] duration-300"
          leave-active-class="transition-[opacity,filter] duration-150"
          enter-from-class="opacity-0 blur-sm"
          leave-to-class="opacity-0"
        >
          <AppCapture
            :key="current.id"
            :src="current.image"
            :alt="current.alt"
            :focus="current.focus"
          />
        </Transition>
      </div>
      <div class="lg:pt-4">
        <p class="text-2xl font-semibold tracking-tight">{{ current.title }}</p>
        <p class="text-muted mt-3 text-[17px]/7 text-pretty">
          {{ current.detail }}
        </p>
        <p class="text-muted mt-6 font-mono text-[11px] tracking-[0.06em] uppercase">
          Capture réelle · données de démonstration
        </p>
      </div>
    </div>
  </section>
</template>
