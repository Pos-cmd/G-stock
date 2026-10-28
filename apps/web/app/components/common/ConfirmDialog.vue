<script setup lang="ts">
import ResponsiveModal from "~/components/common/ResponsiveModal.vue";

const {
  confirmColor = "error",
  confirmLabel = "Confirmer",
  loading = false,
} = defineProps<{
  title: string;
  description: string;
  confirmLabel?: string;
  /** Rouge par défaut (action destructive). */
  confirmColor?: "error" | "primary" | "success";
  loading?: boolean;
}>();

const emit = defineEmits<{ confirm: [] }>();
const open = defineModel<boolean>("open", { required: true });
</script>

<template>
  <ResponsiveModal
    v-model:open="open"
    variant="modal"
    :title="title"
    :description="description"
    :dismissible="confirmColor !== 'error'"
  >
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Annuler" @click="open = false" />
        <UButton
          :color="confirmColor"
          :label="confirmLabel"
          :loading="loading"
          @click="emit('confirm')"
        />
      </div>
    </template>
  </ResponsiveModal>
</template>
