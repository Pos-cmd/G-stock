<script setup lang="ts">
/**
 * Demande de démonstration ou de licence. Sans serveur : le formulaire compose le message et
 * l'ouvre dans WhatsApp ou dans la messagerie. Les contacts directs restent à côté.
 */
const { email, mail, phone, phoneHref, whatsapp } = useContact();

const kind = defineModel<RequestKind>("kind", { default: "demo" });
const KINDS = [
  { label: "Une démonstration", value: "demo" },
  { label: "Une licence", value: "licence" },
] satisfies { label: string; value: RequestKind }[];

const form = reactive({ message: "", name: "", phone: "", shop: "" });
const tried = ref(false);
const errors = computed(() => ({
  name: form.name.trim() ? "" : "Indiquez votre nom.",
  phone: form.phone.trim() ? "" : "Indiquez un numéro où vous joindre.",
}));
const valid = computed(() => !errors.value.name && !errors.value.phone);

const text = computed(() =>
  [
    `Bonjour, je voudrais ${REQUEST_LABELS[kind.value]} de G-stock.`,
    `Nom : ${form.name.trim()}`,
    form.shop.trim() ? `Magasin : ${form.shop.trim()}` : "",
    `Téléphone : ${form.phone.trim()}`,
    form.message.trim(),
  ]
    .filter(Boolean)
    .join("\n"),
);

const send = (channel: "email" | "whatsapp") => {
  tried.value = true;
  if (!valid.value) {
    return;
  }
  const subject = `G-stock : demande d'${kind.value === "demo" ? "une démonstration" : "une licence"}`;
  const url = channel === "whatsapp" ? whatsapp(text.value) : mail(subject, text.value);
  window.open(url, channel === "whatsapp" ? "_blank" : "_self", "noopener");
};
</script>

<template>
  <section id="contact" class="mx-auto max-w-[80rem] px-4 py-24 sm:px-8 sm:py-32">
    <h2
      class="max-w-[44rem] text-[clamp(2rem,4vw,3.25rem)]/[1.05] font-semibold tracking-[-0.03em] text-balance"
    >
      Demandez une démonstration ou votre licence.
    </h2>
    <p class="text-muted mt-4 max-w-[38rem] text-lg text-pretty">
      Je vous réponds moi-même : une démonstration sur vos produits, ou la licence pour votre
      magasin.
    </p>

    <div class="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <form
        class="bg-default border-default grid gap-5 rounded-2xl border p-5 sm:grid-cols-2 sm:p-8"
        novalidate
        @submit.prevent="send('whatsapp')"
      >
        <fieldset class="sm:col-span-2">
          <legend class="text-sm font-medium">Vous voulez</legend>
          <div class="bg-elevated mt-2 inline-flex rounded-full p-1">
            <label
              v-for="option in KINDS"
              :key="option.value"
              class="has-focus-visible:outline-data cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors has-focus-visible:outline-2"
              :class="
                kind === option.value
                  ? 'bg-default shadow-bubble'
                  : 'text-muted hover:text-highlighted'
              "
            >
              <input
                v-model="kind"
                type="radio"
                name="kind"
                :value="option.value"
                class="sr-only"
              />
              {{ option.label }}
            </label>
          </div>
        </fieldset>

        <UFormField label="Votre nom" required :error="tried && errors.name ? errors.name : false">
          <UInput v-model="form.name" autocomplete="name" size="xl" class="w-full" />
        </UFormField>
        <UFormField
          label="Téléphone"
          required
          :error="tried && errors.phone ? errors.phone : false"
        >
          <UInput v-model="form.phone" type="tel" autocomplete="tel" size="xl" class="w-full" />
        </UFormField>
        <UFormField label="Magasin et ville" class="sm:col-span-2">
          <UInput
            v-model="form.shop"
            autocomplete="organization"
            placeholder="Ets Mensah, Lomé"
            size="xl"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Ce que vous vendez, vos questions" class="sm:col-span-2">
          <UTextarea v-model="form.message" :rows="3" autoresize size="xl" class="w-full" />
        </UFormField>

        <div class="flex flex-wrap items-center gap-3 sm:col-span-2">
          <UButton
            type="submit"
            size="xl"
            color="neutral"
            class="bg-ink rounded-full px-6"
            trailing-icon="i-tabler-brand-whatsapp"
          >
            Envoyer sur WhatsApp
          </UButton>
          <UButton
            size="xl"
            color="neutral"
            variant="outline"
            class="bg-default rounded-full px-6"
            trailing-icon="i-tabler-mail"
            @click="send('email')"
          >
            Envoyer par e-mail
          </UButton>
          <p v-if="tried && !valid" class="text-error text-sm" role="alert">
            Il manque votre nom ou votre téléphone.
          </p>
        </div>
      </form>

      <div>
        <p class="font-semibold">Ou directement</p>
        <ul class="mt-4 flex flex-col gap-4">
          <li>
            <a
              :href="whatsapp('Bonjour, je voudrais en savoir plus sur G-stock.')"
              target="_blank"
              rel="noopener"
              class="group flex items-center gap-3"
            >
              <UIcon name="i-tabler-brand-whatsapp" class="text-muted size-5" />
              <span>
                <span class="text-muted block text-sm">WhatsApp</span>
                <span class="font-medium tabular-nums group-hover:underline">{{ phone }}</span>
              </span>
            </a>
          </li>
          <li>
            <a :href="phoneHref" class="group flex items-center gap-3">
              <UIcon name="i-tabler-phone" class="text-muted size-5" />
              <span>
                <span class="text-muted block text-sm">Téléphone</span>
                <span class="font-medium tabular-nums group-hover:underline">{{ phone }}</span>
              </span>
            </a>
          </li>
          <li>
            <a :href="`mailto:${email}`" class="group flex items-center gap-3">
              <UIcon name="i-tabler-mail" class="text-muted size-5" />
              <span class="min-w-0">
                <span class="text-muted block text-sm">E-mail</span>
                <span class="block truncate font-medium group-hover:underline">{{ email }}</span>
              </span>
            </a>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
