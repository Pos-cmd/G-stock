<script setup lang="ts">
import ResponsiveModal from "~/components/common/ResponsiveModal.vue";

const MIN_REASON_LENGTH = 3;

const {
  confirmColor = "error",
  confirmLabel = "Confirmer",
  loading = false,
} = defineProps<{
  title: string;
  description: string;
  confirmLabel?: string;
  confirmColor?: "error" | "primary" | "warning";
  loading?: boolean;
}>();

const emit = defineEmits<{ confirm: [reason: string] }>();
const open = defineModel<boolean>("open", { required: true });

const reason = ref("");
const touched = ref(false);
const error = computed(() =>
  touched.value && reason.value.trim().length < MIN_REASON_LENGTH
    ? "Indiquez le motif (3 caractères minimum)"
    : undefined,
);

watch(open, (isOpen) => {
  if (isOpen) {
    reason.value = "";
    touched.value = false;
  }
});

const confirm = () => {
  touched.value = true;
  if (reason.value.trim().length >= MIN_REASON_LENGTH) {
    emit("confirm", reason.value.trim());
  }
};
</script>

<template>
  <ResponsiveModal
    v-model:open="open"
    variant="modal"
    :title="title"
    :description="description"
    :dismissible="confirmColor !== 'error'"
  >
    <template #body>
      <UFormField
        label="Motif"
        required
        :error="error"
        help="Il restera visible dans l'historique."
      >
        <UTextarea v-model="reason" :rows="3" autoresize autofocus class="w-full" />
      </UFormField>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Retour" @click="open = false" />
        <UButton :color="confirmColor" :label="confirmLabel" :loading="loading" @click="confirm" />
      </div>
    </template>
  </ResponsiveModal>
</template>
