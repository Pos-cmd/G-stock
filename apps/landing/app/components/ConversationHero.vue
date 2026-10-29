<script setup lang="ts">
// Ouverture : un client demande ce qu'il doit, G-stock répond par le reçu. Données d'exemple,
// tirées de la base de démonstration.
const { demo, whatsapp } = useContact();

// La barre de message est le vrai formulaire de contact : son texte part tel quel sur WhatsApp.
const message = ref(CONTACT_MESSAGE);
const openWhatsapp = () => {
  window.open(whatsapp(message.value.trim() || CONTACT_MESSAGE), "_blank", "noopener");
};

const RECEIPT = {
  customer: "Boutique Sainte Rita",
  date: "28 oct. 2026",
  lines: [
    { amount: "161 000", label: "Wax hollandais 6 yards", qty: "× 23" },
    { amount: "69 700", label: "Dentelle cordée 5 yards", qty: "× 17" },
  ],
  paid: "100 000",
  reference: "V-2026-02364",
  remaining: "130 700",
  total: "230 700",
};
</script>

<template>
  <section class="relative pb-6">
    <div class="mx-auto flex w-full max-w-216 flex-col gap-4 px-4 pt-4 sm:gap-5 sm:pt-6">
      <p class="play-in text-muted text-center font-mono text-[11px] tracking-[0.08em] uppercase">
        Aujourd'hui · 17:42
      </p>

      <div
        class="play-in bg-default shadow-bubble max-w-160 self-start rounded-[1.4rem] rounded-bl-md px-5 py-4 sm:px-7 sm:py-5"
        style="--at: 120ms"
      >
        <p class="text-muted text-[13px] font-medium">{{ RECEIPT.customer }}</p>
        <h1
          class="mt-1 text-[clamp(2rem,4.6vw,3.6rem)]/[1.04] font-semibold tracking-[-0.035em] text-balance"
        >
          Bonjour, combien je vous dois encore&nbsp;?
        </h1>
      </div>

      <div class="relative flex flex-col items-end">
        <div
          class="typing bg-ink absolute inset-e-0 top-0 flex gap-1.5 rounded-[1.4rem] rounded-br-md px-5 py-4"
          style="--at: 300ms"
          aria-hidden="true"
        >
          <i class="block size-2 rounded-full bg-white" />
          <i class="block size-2 rounded-full bg-white" />
          <i class="block size-2 rounded-full bg-white" />
        </div>

        <figure
          class="play-in bg-ink w-full max-w-132 rounded-[1.4rem] rounded-br-md p-2.5 sm:p-3"
          style="--at: 750ms; --from: bottom right"
        >
          <div class="bg-default rounded-2xl px-5 py-4 sm:px-6">
            <div class="text-muted flex justify-between font-mono text-[11px] tracking-[0.06em]">
              <span>REÇU {{ RECEIPT.reference }}</span>
              <span>{{ RECEIPT.date }}</span>
            </div>
            <dl class="mt-3 text-sm sm:text-[15px]">
              <div
                v-for="line in RECEIPT.lines"
                :key="line.label"
                class="flex items-baseline justify-between gap-4 py-1"
              >
                <dt>
                  {{ line.label }}
                  <span class="text-muted whitespace-nowrap">{{ line.qty }}</span>
                </dt>
                <dd class="font-medium whitespace-nowrap tabular-nums">{{ line.amount }} FCFA</dd>
              </div>
              <div
                class="border-default text-muted mt-2 flex justify-between gap-4 border-t pt-2.5"
              >
                <dt>Total</dt>
                <dd class="tabular-nums">{{ RECEIPT.total }} FCFA</dd>
              </div>
              <div class="text-muted flex justify-between gap-4 py-0.5">
                <dt>Déjà payé</dt>
                <dd class="tabular-nums">{{ RECEIPT.paid }} FCFA</dd>
              </div>
              <div class="flex items-baseline justify-between pt-1">
                <dt class="font-semibold">Reste dû</dt>
                <dd class="text-due text-2xl font-semibold tracking-tight tabular-nums">
                  {{ RECEIPT.remaining }} FCFA
                </dd>
              </div>
            </dl>
          </div>
          <figcaption class="text-sand-300 px-2 pt-2.5 pb-1 text-[13px] text-pretty">
            Exemple tiré des données de démonstration. G-stock envoie le reçu au format téléphone,
            avec le reste dû à jour.
          </figcaption>
        </figure>
      </div>
    </div>

    <div class="mx-auto mt-10 w-full max-w-176 px-4">
      <p class="text-muted mb-3 text-center text-[15px] text-pretty">
        G-stock tient le stock, les ventes à crédit et les commandes de Chine de votre magasin. Je
        l'installe chez vous et je forme votre équipe.
      </p>
      <form
        class="bg-default shadow-float border-default flex flex-col gap-2 rounded-3xl border p-2 sm:flex-row sm:items-center sm:rounded-full sm:py-1.5 sm:ps-5 sm:pe-1.5"
        :action="whatsapp()"
        @submit.prevent="openWhatsapp"
      >
        <label for="hero-message" class="sr-only">Votre message</label>
        <input
          id="hero-message"
          v-model="message"
          class="placeholder:text-muted min-w-0 flex-1 bg-transparent px-3 py-2 text-base outline-none sm:p-0"
          :placeholder="CONTACT_MESSAGE"
        />
        <UButton
          type="submit"
          size="xl"
          color="neutral"
          class="bg-ink justify-center rounded-full px-5"
          trailing-icon="i-tabler-brand-whatsapp"
        >
          Écrire sur WhatsApp
        </UButton>
      </form>
      <p class="text-muted mt-3 text-center text-sm">
        ou
        <NuxtLink
          :to="demo.to"
          :external="demo.external"
          target="_blank"
          rel="noopener"
          class="text-highlighted font-medium underline"
        >
          {{ demo.label.toLowerCase() }}
        </NuxtLink>
      </p>
    </div>
  </section>
</template>
