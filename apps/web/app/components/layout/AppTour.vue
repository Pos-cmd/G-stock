<script setup lang="ts">
import TourSpotlight from "~/components/layout/TourSpotlight.vue";

/**
 * Visite guidée (useTour de Nuxt UI) : une seule fenêtre qui passe de repère en repère. Lancée
 * d'elle-même à la première visite sur grand écran, puis depuis le menu du profil.
 */
const AUTO_START_DELAY_MS = 1500;

const icons = useIcons();
const { requests } = useAppTour();

// Seules les étapes dont le repère est affiché (barre réduite, téléphone, page sans action…).
const steps = ref<AppTourStep[]>([]);
const isShown = (selector: string | null) => {
  if (!selector) {
    return true;
  }
  const rect = document.querySelector(selector)?.getBoundingClientRect();
  return Boolean(rect && rect.width > 0 && rect.height > 0);
};

const tour = useTour(steps, {
  scrollIntoView: { behavior: "smooth", block: "center" },
});
const { current, hasNext, hasPrev, index, open, reference, total } = tour;
const step = computed(() => current.value as AppTourStep | undefined);

const markDone = () => {
  try {
    localStorage.setItem(TOUR_DONE_KEY, "1");
  } catch {
    // Navigateur sans stockage : la visite pourra revenir, sans gêner.
  }
};
const begin = () => {
  steps.value = APP_TOUR_STEPS.filter((item) => isShown(item.target));
  tour.start(0);
};
const close = () => {
  tour.finish();
  markDone();
};
const forward = () => {
  if (hasNext.value) {
    tour.next();
  } else {
    close();
  }
};

watch(requests, begin);

onMounted(() => {
  let seen = false;
  try {
    seen = localStorage.getItem(TOUR_DONE_KEY) !== null;
  } catch {
    seen = true;
  }
  if (!seen && window.matchMedia("(min-width: 1024px)").matches) {
    setTimeout(begin, AUTO_START_DELAY_MS);
  }
});

// Clavier pendant la visite : ← → pour naviguer, Échap pour quitter.
useEventListener(window, "keydown", (event: KeyboardEvent) => {
  if (!open.value) {
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    close();
  } else if (event.key === "ArrowRight") {
    forward();
  } else if (event.key === "ArrowLeft" && hasPrev.value) {
    tour.prev();
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <TourSpotlight v-if="open && step" :target="step.target" />
    </Transition>
  </Teleport>

  <UPopover
    :open="open"
    :reference="reference"
    :dismissible="false"
    :modal="false"
    :content="{
      side: step?.side ?? 'bottom',
      sideOffset: step?.target ? 16 : -80,
      collisionPadding: 16,
      onOpenAutoFocus: (event: Event) => event.preventDefault(),
    }"
    :ui="{ content: 'z-50 w-80 p-4' }"
  >
    <template #content>
      <div v-if="step" class="space-y-3" role="dialog" :aria-label="step.title">
        <div class="flex items-center justify-between gap-3">
          <span class="text-dimmed font-mono text-[11px] tracking-[0.08em] uppercase tabular-nums">
            Étape {{ index + 1 }} / {{ total }}
          </span>
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            :icon="icons.close"
            aria-label="Quitter la visite"
            @click="close"
          />
        </div>
        <div class="space-y-1">
          <p class="text-highlighted font-semibold">{{ step.title }}</p>
          <p class="text-muted text-sm text-pretty">{{ step.body }}</p>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex flex-1 gap-1" aria-hidden="true">
            <span
              v-for="dot in total"
              :key="dot"
              class="h-1 flex-1 rounded-full transition-colors duration-200"
              :class="dot - 1 <= index ? 'bg-primary' : 'bg-accented'"
            />
          </div>
          <UButton
            v-if="hasPrev"
            color="neutral"
            variant="ghost"
            size="sm"
            label="Retour"
            @click="tour.prev()"
          />
          <UButton size="sm" :label="hasNext ? 'Suivant' : 'Terminer'" @click="forward" />
        </div>
      </div>
    </template>
  </UPopover>
</template>
