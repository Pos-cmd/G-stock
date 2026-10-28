<script setup lang="ts">
import { parseDate } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";

/**
 * Période (du… au…) : saisie au clavier, ou choix dans un calendrier de deux mois avec des
 * raccourcis (aujourd'hui, ce mois…). `v-model:from` et `v-model:to` sont au format AAAA-MM-JJ,
 * "" quand la borne est libre.
 */
const from = defineModel<string>("from", { default: "" });
const to = defineModel<string>("to", { default: "" });

const icons = useIcons();
const open = ref(false);
const isDesktop = useMediaQuery("(min-width: 768px)");

interface Range {
  start: DateValue | undefined;
  end: DateValue | undefined;
}

const range = computed<Range>({
  get: () => ({
    end: to.value ? parseDate(to.value) : undefined,
    start: from.value ? parseDate(from.value) : undefined,
  }),
  set: (value) => {
    from.value = value.start ? value.start.toString() : "";
    to.value = value.end ? value.end.toString() : "";
  },
});

// Le calendrier émet aussi la sélection en cours (début choisi, fin pas encore) : on ne ferme
// qu'une fois les deux bornes posées.
const pickRange = (value: unknown) => {
  const next = (value ?? {}) as Partial<Range>;
  range.value = { end: next.end ?? undefined, start: next.start ?? undefined };
  if (next.start && next.end) {
    open.value = false;
  }
};

const applyPreset = (preset: (now: Date) => readonly [Date, Date]) => {
  const [start, end] = preset(new Date());
  from.value = toDateInputValue(start);
  to.value = toDateInputValue(end);
  open.value = false;
};

const clear = () => {
  from.value = "";
  to.value = "";
};
</script>

<template>
  <UInputDate
    :model-value="range"
    range
    aria-label="Période"
    :ui="{ trailing: 'pe-1.5 gap-0.5' }"
    @update:model-value="pickRange"
  >
    <template #trailing>
      <UButton
        v-if="from || to"
        color="neutral"
        variant="ghost"
        size="xs"
        :icon="icons.close"
        aria-label="Effacer la période"
        @click="clear"
      />
      <UPopover v-model:open="open" :content="{ align: 'end', sideOffset: 8 }">
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          :icon="icons.calendar"
          aria-label="Choisir la période dans le calendrier"
        />
        <template #content>
          <div class="flex flex-col sm:flex-row">
            <ul
              class="border-default flex gap-1 border-b p-2 sm:flex-col sm:border-e sm:border-b-0"
            >
              <li v-for="preset in PERIOD_PRESETS" :key="preset.label">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  block
                  :label="preset.label"
                  class="justify-start"
                  @click="applyPreset(preset.range)"
                />
              </li>
            </ul>
            <UCalendar
              :model-value="range"
              range
              :number-of-months="isDesktop ? 2 : 1"
              class="p-2"
              @update:model-value="pickRange"
            />
          </div>
        </template>
      </UPopover>
    </template>
  </UInputDate>
</template>
