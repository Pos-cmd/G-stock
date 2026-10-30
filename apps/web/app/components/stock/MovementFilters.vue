<script setup lang="ts">
import type { MovementType } from "@G-stock/core/enums";
import { MOVEMENT_TYPE_LABELS } from "@G-stock/core/labels";

import DateRangeField from "~/components/common/DateRangeField.vue";

/** Valeur du sélecteur de type quand aucun filtre n'est appliqué. */
type MovementTypeFilter = MovementType | "all";

/**
 * Filtres communs aux tableaux de mouvements : type d'opération et période. La période porte sur
 * la date de l'opération (vente, réception, ajustement), pas sur la date de saisie.
 * Les deux champs sont des racines séparées, pour que l'appelant puisse les grouper comme il veut.
 */
const type = defineModel<MovementTypeFilter>("type", { default: "all" });
const from = defineModel<string>("from", { default: "" });
const to = defineModel<string>("to", { default: "" });

const { stacked = false } = defineProps<{ stacked?: boolean }>();

const typeItems = [
  { label: "Tous les types", value: "all" },
  ...Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => ({
    label,
    value,
  })),
];
</script>

<template>
  <USelect
    v-model="type"
    :items="typeItems"
    aria-label="Type de mouvement"
    :class="stacked ? 'w-full' : 'w-44'"
  />
  <DateRangeField
    v-model:from="from"
    v-model:to="to"
    :class="stacked ? 'w-full' : 'w-full sm:w-72'"
  />
</template>
