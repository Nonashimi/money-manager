<script setup lang="ts">
import type { Jar } from '../stores/jars';

const props = defineProps<{ jar: Jar }>();
const emit = defineEmits<{ edit: [jar: Jar]; archive: [jar: Jar] }>();

const accentColor = computed(() => props.jar.color || '#6366f1');
const isSavings = computed(() => props.jar.type === 'SAVINGS');
const icon = computed(() => (isSavings.value ? 'i-lucide-vault' : 'i-lucide-piggy-bank'));
</script>

<template>
  <UCard class="relative overflow-hidden">
    <div class="absolute inset-y-0 left-0 w-1" :style="{ backgroundColor: accentColor }" />
    <div class="flex items-start justify-between gap-2 pl-2">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span
            class="flex size-8 items-center justify-center rounded-lg shrink-0"
            :style="{ backgroundColor: `${accentColor}26` }"
          >
            <UIcon :name="icon" class="size-4" :style="{ color: accentColor }" />
          </span>
          <h3 class="font-medium truncate text-highlighted">{{ jar.name }}</h3>
          <UBadge v-if="isSavings" color="neutral" variant="subtle" size="sm">Накопительная</UBadge>
        </div>
        <p class="text-3xl font-semibold mt-3 tabular-nums">{{ formatMoney(jar.balance) }}</p>
        <p class="text-sm text-muted mt-1">{{ formatPercent(jar.defaultPercent) }} от дохода</p>
      </div>

      <UDropdownMenu
        :items="[
          [{ label: 'Изменить', icon: 'i-lucide-pencil', onSelect: () => emit('edit', props.jar) }],
          [{ label: 'Архивировать', icon: 'i-lucide-archive', onSelect: () => emit('archive', props.jar) }],
        ]"
      >
        <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" size="sm" />
      </UDropdownMenu>
    </div>
  </UCard>
</template>
