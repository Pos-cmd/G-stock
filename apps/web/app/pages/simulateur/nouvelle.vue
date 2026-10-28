<script setup lang="ts">
import PagePanel from "~/components/layout/PagePanel.vue";
import SimulationEditor from "~/components/simulator/SimulationEditor.vue";

const icons = useIcons();

useHead({ title: "Nouvelle simulation" });

const editor = useTemplateRef<InstanceType<typeof SimulationEditor>>("editor");

const onSaved = async (id: string) => {
  await navigateTo(`/simulateur/${id}`, { replace: true });
};
</script>

<template>
  <PagePanel id="simulation-new" title="Nouvelle simulation" :icon="icons.simulations">
    <template #actions>
      <UButton
        to="/simulateur"
        color="neutral"
        variant="ghost"
        :icon="icons.arrowLeft"
        label="Simulations"
      />
      <UButton
        type="submit"
        form="simulation-form"
        :icon="icons.save"
        label="Enregistrer"
        :loading="editor?.saving"
      />
    </template>

    <SimulationEditor ref="editor" @saved="onSaved" />
  </PagePanel>
</template>
