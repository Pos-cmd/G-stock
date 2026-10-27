<script setup lang="ts">
const { confirmLabel = "Confirmer", loading = false } = defineProps<{
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
}>();

const emit = defineEmits<{ confirm: [] }>();
const open = defineModel<boolean>("open", { required: true });
</script>

<template>
  <UModal v-model:open="open" :title="title" :description="description">
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" label="Annuler" @click="open = false" />
        <UButton color="error" :label="confirmLabel" :loading="loading" @click="emit('confirm')" />
      </div>
    </template>
  </UModal>
</template>
