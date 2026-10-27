<script setup lang="ts">
import PagePanel from "~/components/layout/PagePanel.vue";
import SimulationEditor from "~/components/simulator/SimulationEditor.vue";

useHead({ title: "Nouvelle simulation" });

const editor = useTemplateRef<InstanceType<typeof SimulationEditor>>("editor");

const onSaved = async (id: string) => {
  await navigateTo(`/simulateur/${id}`, { replace: true });
};
</script>

<template>
  <PagePanel id="simulation-new" title="Nouvelle simulation" icon="i-lucide-calculator">
    <template #actions>
      <UButton
        to="/simulateur"
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        label="Simulations"
      />
      <UButton
        type="submit"
        form="simulation-form"
        icon="i-lucide-save"
        label="Enregistrer"
        :loading="editor?.saving"
      />
    </template>

    <SimulationEditor ref="editor" @saved="onSaved" />
  </PagePanel>
</template>
