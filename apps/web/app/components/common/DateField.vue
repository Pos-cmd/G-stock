<script setup lang="ts">
import { parseDate } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";

/**
 * Champ de date : saisie jour / mois / année au clavier, ou choix dans un calendrier.
 * `v-model` est le jour au format AAAA-MM-JJ (celui de `toDateInputValue`), "" si vide.
 */
defineProps<{
  /** Libellé lu par les lecteurs d'écran quand le champ n'a pas de UFormField. */
  ariaLabel?: string;
}>();
const model = defineModel<string>({ default: "" });

const icons = useIcons();
const open = ref(false);
const inputDate = useTemplateRef("inputDate");

const value = computed({
  get: () => (model.value ? parseDate(model.value) : undefined),
  set: (date: DateValue | null | undefined) => {
    model.value = date ? date.toString() : "";
  },
});

// Un jour choisi dans le calendrier referme celui-ci.
const pick = (date: DateValue | null | undefined) => {
  value.value = date;
  open.value = false;
};
</script>

<template>
  <UInputDate ref="inputDate" v-model="value" :aria-label="ariaLabel" :ui="{ trailing: 'pe-1.5' }">
    <template #trailing>
      <UPopover
        v-model:open="open"
        :reference="inputDate?.inputsRef[3]?.$el"
        :content="{ align: 'end', sideOffset: 8 }"
      >
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          :icon="icons.calendar"
          aria-label="Choisir dans le calendrier"
        />
        <template #content>
          <UCalendar
            :model-value="value"
            class="p-2"
            @update:model-value="pick($event as DateValue | undefined)"
          />
        </template>
      </UPopover>
    </template>
  </UInputDate>
</template>
