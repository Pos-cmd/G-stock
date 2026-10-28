<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";

// Cloche de la barre du haut : ce qui demande une action (stock, créances, sauvegarde).
const icons = useIcons();
const { $orpc } = useNuxtApp();

const summary = useQuery($orpc.stock.summary.queryOptions());
const sales = useQuery($orpc.sales.summary.queryOptions());
const backupWarning = useBackupWarning();

interface Alert {
  id: string;
  icon: string;
  color: "error" | "warning";
  title: string;
  description: string;
  to: string;
}

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

const alerts = computed<Alert[]>(() => {
  const list: Alert[] = [];
  const stock = summary.data.value;
  const criticalDebtors = sales.data.value?.criticalDebtorCount ?? 0;
  if (stock && stock.outCount > 0) {
    list.push({
      color: "error",
      description: "Plus aucune unité en stock.",
      icon: icons.stockOut,
      id: "out",
      title: `${plural(stock.outCount, "produit")} en rupture`,
      to: "/produits?statut=out",
    });
  }
  if (stock && stock.lowCount > 0) {
    list.push({
      color: "warning",
      description: "Au niveau ou sous le seuil d'alerte.",
      icon: icons.stockLow,
      id: "low",
      title: `${plural(stock.lowCount, "produit")} à réapprovisionner`,
      to: "/produits?statut=low",
    });
  }
  if (criticalDebtors > 0) {
    list.push({
      color: "error",
      description: "Créances anciennes à relancer.",
      icon: icons.receivablesCritical,
      id: "debtors",
      title: `${plural(criticalDebtors, "client")} en retard critique`,
      to: "/clients?debiteurs",
    });
  }
  if (backupWarning.value) {
    list.push({
      color: "warning",
      description: backupWarning.value,
      icon: icons.backup,
      id: "backup",
      title: "Sauvegarde à vérifier",
      to: "/parametres",
    });
  }
  return list;
});

const open = ref(false);
const tileColors = {
  error: "bg-error/10 text-error ring-error/20",
  warning: "bg-warning/10 text-warning ring-warning/20",
} as const;
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'end', sideOffset: 8 }">
    <UChip :show="alerts.length > 0" color="error" size="sm" inset>
      <UButton
        color="neutral"
        variant="outline"
        :icon="icons.notifications"
        :aria-label="alerts.length > 0 ? `Alertes (${alerts.length})` : 'Alertes'"
      />
    </UChip>

    <template #content>
      <div class="w-80">
        <p
          class="text-muted border-default border-b px-3 py-2.5 font-mono text-[11px] font-medium tracking-[0.08em] uppercase"
        >
          À traiter
        </p>
        <ul v-if="alerts.length > 0" class="p-1">
          <li v-for="alert in alerts" :key="alert.id">
            <NuxtLink
              :to="alert.to"
              class="hover:bg-muted flex gap-3 rounded-md p-2 transition-colors"
              @click="open = false"
            >
              <span
                class="flex size-7 shrink-0 items-center justify-center rounded-md ring ring-inset"
                :class="tileColors[alert.color]"
              >
                <UIcon :name="alert.icon" class="size-4" />
              </span>
              <span class="min-w-0">
                <span class="text-highlighted block text-sm font-medium">{{ alert.title }}</span>
                <span class="text-muted block text-xs">{{ alert.description }}</span>
              </span>
            </NuxtLink>
          </li>
        </ul>
        <div v-else class="flex flex-col items-center gap-1.5 px-3 py-6 text-center">
          <UIcon :name="icons.success" class="text-success size-5" />
          <p class="text-highlighted text-sm font-medium">Rien à signaler</p>
          <p class="text-muted text-xs">Stock, créances et sauvegarde sont en ordre.</p>
        </div>
      </div>
    </template>
  </UPopover>
</template>
