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
  <PagePanel
    id="simulation-new"
    title="Nouvelle simulation"
    description="Chiffrez un achat avant de le commander : coût de revient, prix de vente et marge."
    :icon="icons.simulations"
    :parents="[{ label: 'Simulations', to: '/simulateur' }]"
  >
    <template #actions>
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
