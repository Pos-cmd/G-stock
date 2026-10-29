<script setup lang="ts">
// Sélecteur de thème de la barre du haut : thèmes prêts à l'emploi, puis chaque réglage à la main.
const icons = useIcons();
const colorMode = useColorMode();
const { activePreset, applyPreset, randomize, reset, settings } = useAppTheme();

const radiusFormat = new Intl.NumberFormat("fr-FR");
const radiusLabel = (radius: number) => radiusFormat.format(radius);

const modes = [
  { icon: icons.light, label: "Clair", value: "light" },
  { icon: icons.dark, label: "Sombre", value: "dark" },
  { icon: icons.system, label: "Système", value: "system" },
] as const;

// Aperçu de chaque bibliothèque : trois icônes de l'application.
const ICON_SAMPLES = ["package", "shopping-cart", "settings"] as const;
const sampleIcon = (name: string, library: IconLibrary) => {
  if (library === "lucide") {
    return LUCIDE_ICONS[name] ?? `i-tabler-${name}`;
  }
  return library === "phosphor" ? (PHOSPHOR_ICONS[name] ?? `i-tabler-${name}`) : `i-tabler-${name}`;
};

// L'icône du bouton « au hasard » fait un tour à chaque tirage.
const spinning = ref(false);
const shuffle = () => {
  randomize();
  spinning.value = false;
  requestAnimationFrame(() => {
    spinning.value = true;
  });
};

const sectionTitle = "text-muted font-mono text-[10px] font-medium tracking-[0.08em] uppercase";
</script>

<template>
  <UPopover :content="{ align: 'end', sideOffset: 8 }" :ui="{ content: 'w-[22rem]' }">
    <UTooltip text="Thème">
      <UButton color="neutral" variant="outline" :icon="icons.palette" aria-label="Thème" />
    </UTooltip>

    <template #content>
      <div class="max-h-[min(42rem,80vh)] space-y-5 overflow-y-auto p-4">
        <div class="flex items-center justify-between gap-2">
          <div>
            <p class="text-highlighted text-sm font-semibold">Thème</p>
            <p class="text-muted text-xs">
              {{ activePreset ? activePreset.description : "Thème personnalisé." }}
            </p>
          </div>
          <UFieldGroup size="sm">
            <UTooltip text="Thème au hasard">
              <UButton
                color="neutral"
                variant="outline"
                :icon="icons.shuffle"
                aria-label="Thème au hasard"
                :ui="{ leadingIcon: spinning ? 'spin-once' : '' }"
                @click="shuffle"
                @animationend="spinning = false"
              />
            </UTooltip>
            <UTooltip text="Revenir au thème d'origine">
              <UButton
                color="neutral"
                variant="outline"
                :icon="icons.undo"
                aria-label="Revenir au thème d'origine"
                @click="reset"
              />
            </UTooltip>
          </UFieldGroup>
        </div>

        <!-- Thèmes prêts à l'emploi -->
        <section class="space-y-2">
          <p :class="sectionTitle">Thèmes</p>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="preset in THEME_PRESETS"
              :key="preset.id"
              type="button"
              class="ring-default hover:bg-muted flex items-center gap-2.5 rounded-lg p-2 text-left ring transition-[background-color,transform] duration-150 ease-(--ease-snappy) active:scale-[0.97]"
              :class="activePreset?.id === preset.id ? 'bg-muted ring-inverted ring-2' : ''"
              :aria-pressed="activePreset?.id === preset.id"
              @click="applyPreset(preset)"
            >
              <span class="flex -space-x-1">
                <span
                  class="ring-default size-4 rounded-full ring-2"
                  :style="{ background: themeSwatch(preset.settings.primary) }"
                />
                <span
                  class="ring-default size-4 rounded-full ring-2"
                  :style="{
                    background: themeSwatch(preset.settings.neutral, 300),
                  }"
                />
                <span
                  class="ring-default size-4 rounded-full ring-2"
                  :style="{ background: themeSwatch(preset.settings.accent) }"
                />
              </span>
              <span
                class="text-highlighted truncate text-[13px] font-medium"
                :style="{ fontFamily: `'${preset.settings.font}', sans-serif` }"
              >
                {{ preset.label }}
              </span>
            </button>
          </div>
        </section>

        <!-- Couleur principale -->
        <section class="space-y-2">
          <p :class="sectionTitle">Couleur principale</p>
          <div class="flex flex-wrap gap-1.5">
            <UTooltip v-for="color in PRIMARY_COLORS" :key="color" :text="colorLabel(color)">
              <button
                type="button"
                class="ring-offset-default size-6 rounded-full ring-offset-2 transition-transform hover:scale-110"
                :class="settings.primary === color ? 'ring-inverted ring-2' : ''"
                :style="{ background: themeSwatch(color) }"
                :aria-label="colorLabel(color)"
                :aria-pressed="settings.primary === color"
                @click="settings.primary = color"
              />
            </UTooltip>
          </div>
        </section>

        <!-- Gris -->
        <section class="space-y-2">
          <p :class="sectionTitle">Gris des fonds et textes</p>
          <div class="flex flex-wrap gap-1.5">
            <UButton
              v-for="color in NEUTRAL_COLORS"
              :key="color"
              size="xs"
              color="neutral"
              :variant="settings.neutral === color ? 'subtle' : 'ghost'"
              :class="settings.neutral === color ? 'ring-inverted' : ''"
              @click="settings.neutral = color"
            >
              <span class="size-3 rounded-full" :style="{ background: themeSwatch(color, 400) }" />
              {{ colorLabel(color) }}
            </UButton>
          </div>
        </section>

        <!-- Graphiques -->
        <section class="space-y-2">
          <p :class="sectionTitle">Couleur des graphiques</p>
          <div class="flex flex-wrap gap-1.5">
            <UTooltip v-for="color in ACCENT_COLORS" :key="color" :text="colorLabel(color)">
              <button
                type="button"
                class="ring-offset-default size-5 rounded-md ring-offset-2 transition-transform hover:scale-110"
                :class="settings.accent === color ? 'ring-inverted ring-2' : ''"
                :style="{ background: themeSwatch(color) }"
                :aria-label="colorLabel(color)"
                :aria-pressed="settings.accent === color"
                @click="settings.accent = color"
              />
            </UTooltip>
          </div>
        </section>

        <!-- Arrondi -->
        <section class="space-y-2">
          <p :class="sectionTitle">Arrondi</p>
          <UFieldGroup size="sm" class="w-full">
            <UButton
              v-for="radius in RADII"
              :key="radius"
              color="neutral"
              :variant="settings.radius === radius ? 'subtle' : 'outline'"
              :label="radiusLabel(radius)"
              class="flex-1 justify-center tabular-nums"
              :aria-pressed="settings.radius === radius"
              @click="settings.radius = radius"
            />
          </UFieldGroup>
        </section>

        <!-- Police -->
        <section class="space-y-2">
          <p :class="sectionTitle">Police</p>
          <div class="grid grid-cols-3 gap-1.5">
            <UButton
              v-for="font in FONTS"
              :key="font"
              size="sm"
              color="neutral"
              :variant="settings.font === font ? 'subtle' : 'outline'"
              :label="font"
              class="justify-center"
              :style="{ fontFamily: `'${font}', sans-serif` }"
              :aria-pressed="settings.font === font"
              @click="settings.font = font"
            />
          </div>
        </section>

        <!-- Icônes -->
        <section class="space-y-2">
          <p :class="sectionTitle">Icônes</p>
          <div class="grid grid-cols-3 gap-1.5">
            <UButton
              v-for="library in ICON_LIBRARIES"
              :key="library"
              size="sm"
              color="neutral"
              :variant="settings.icons === library ? 'subtle' : 'outline'"
              class="flex-col justify-center gap-1 py-2"
              :aria-pressed="settings.icons === library"
              @click="settings.icons = library"
            >
              <span class="flex items-center gap-1.5">
                <UIcon
                  v-for="sample in ICON_SAMPLES"
                  :key="sample"
                  :name="sampleIcon(sample, library)"
                  class="size-4"
                />
              </span>
              <span class="text-xs">{{ ICON_LIBRARY_LABELS[library] }}</span>
            </UButton>
          </div>
        </section>

        <!-- Apparence -->
        <section class="space-y-2">
          <p :class="sectionTitle">Apparence</p>
          <UFieldGroup size="sm" class="w-full">
            <UButton
              v-for="mode in modes"
              :key="mode.value"
              color="neutral"
              :variant="colorMode.preference === mode.value ? 'subtle' : 'outline'"
              :icon="mode.icon"
              :label="mode.label"
              class="flex-1 justify-center"
              :aria-pressed="colorMode.preference === mode.value"
              @click="colorMode.preference = mode.value"
            />
          </UFieldGroup>
        </section>
      </div>
    </template>
  </UPopover>
</template>
