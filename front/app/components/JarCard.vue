<script setup lang="ts">
import type { Jar } from '../stores/jars';

const props = defineProps<{ jar: Jar; fill?: number }>();
const emit = defineEmits<{ edit: [jar: Jar]; archive: [jar: Jar] }>();

const accentColor = computed(() => props.jar.color || '#6366f1');
const isSavings = computed(() => props.jar.type === 'SAVINGS');
const isNegative = computed(() => Number(props.jar.balance) < 0);
const fillPercent = computed(() => {
  if (Number(props.jar.balance) <= 0) return 0;
  return Math.max(4, Math.min(100, Math.round((props.fill ?? 0) * 100)));
});
</script>

<template>
  <div class="rounded-xl border border-default bg-elevated p-4">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="size-2.5 shrink-0 rounded-full" :style="{ backgroundColor: accentColor }" />
          <h3 class="truncate font-semibold text-highlighted">{{ jar.name }}</h3>
          <UBadge v-if="isSavings" color="neutral" variant="subtle" size="sm">Накопительная</UBadge>
        </div>
        <p class="mt-0.5 text-xs text-muted">{{ formatPercent(jar.defaultPercent) }} от дохода</p>
      </div>

      <UDropdownMenu
        :items="[
          [{ label: 'Изменить', icon: 'i-lucide-pencil', onSelect: () => emit('edit', props.jar) }],
          [{ label: 'Архивировать', icon: 'i-lucide-archive', onSelect: () => emit('archive', props.jar) }],
        ]"
      >
        <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" size="sm" aria-label="Действия" />
      </UDropdownMenu>
    </div>

    <p
      class="mt-3 text-2xl font-bold tracking-tight tabular-nums"
      :class="isNegative ? 'text-error' : 'text-highlighted'"
    >
      {{ formatMoney(jar.balance) }}
    </p>

    <div class="jar-track mt-3" role="presentation">
      <span :style="{ width: `${fillPercent}%`, backgroundColor: accentColor }" />
    </div>
  </div>
</template>
