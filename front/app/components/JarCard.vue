<script setup lang="ts">
import type { Jar } from '../stores/jars';

const props = defineProps<{ jar: Jar }>();
const emit = defineEmits<{ edit: [jar: Jar]; archive: [jar: Jar] }>();

const rugStyle = computed(() => jarRugStyle(props.jar.color));
const isSavings = computed(() => props.jar.type === 'SAVINGS');
const isNegative = computed(() => Number(props.jar.balance) < 0);
</script>

<template>
  <div
    class="rug min-h-[92px]"
    :style="rugStyle"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="truncate text-[15px] font-extrabold">
          {{ jar.name }}
        </h3>
        <p class="mt-1 text-xs opacity-80">
          {{ formatPercent(jar.defaultPercent) }} от дохода<span v-if="isSavings"> · накопительная</span>
        </p>
      </div>
      <p
        class="shrink-0 text-[22px] font-extrabold tabular-nums"
        :class="isNegative ? 'text-red-200' : ''"
      >
        {{ formatMoney(jar.balance) }}
      </p>
    </div>

    <div class="absolute right-2 bottom-1.5 z-10">
      <UDropdownMenu
        :items="[
          [{ label: 'Изменить', icon: 'i-lucide-pencil', onSelect: () => emit('edit', props.jar) }],
          [{ label: 'Архивировать', icon: 'i-lucide-archive', onSelect: () => emit('archive', props.jar) }],
        ]"
      >
        <UButton
          icon="i-lucide-ellipsis-vertical"
          color="neutral"
          variant="ghost"
          size="xs"
          class="text-white/90"
          aria-label="Действия"
        />
      </UDropdownMenu>
    </div>
  </div>
</template>
