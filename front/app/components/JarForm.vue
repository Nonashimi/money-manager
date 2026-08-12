<script setup lang="ts">
import * as z from 'zod';
import type { FormSubmitEvent } from '@nuxt/ui';
import type { Jar, JarType } from '../stores/jars';

const props = defineProps<{ jar?: Jar | null }>();
const emit = defineEmits<{
  submit: [payload: { name: string; color?: string; type?: JarType; defaultPercent?: number }];
}>();

const COLOR_PALETTE = [
  '#6366f1', // indigo
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#8b5cf6', // violet
  '#14b8a6', // teal
  '#f97316', // orange
  '#ec4899', // pink
  '#94a3b8', // slate
];

const TYPE_OPTIONS: { value: JarType; label: string; description: string; icon: string }[] = [
  { value: 'SPENDING', label: 'Расходная', description: 'Деньги на текущие траты', icon: 'i-lucide-piggy-bank' },
  { value: 'SAVINGS', label: 'Накопительная', description: 'Копим, не тратим', icon: 'i-lucide-vault' },
];

const schema = z.object({
  name: z.string().min(1, 'Введите название'),
  color: z.string().optional(),
  type: z.enum(['SPENDING', 'SAVINGS']).optional(),
  defaultPercent: z.number().min(0).max(100).optional(),
});

type Schema = z.output<typeof schema>;

const state = reactive<Partial<Schema>>({
  name: props.jar?.name,
  color: props.jar?.color ?? COLOR_PALETTE[0],
  type: props.jar?.type ?? 'SPENDING',
  defaultPercent: props.jar ? Number(props.jar.defaultPercent) : undefined,
});

const loading = ref(false);

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true;
  try {
    emit('submit', event.data);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
    <UFormField label="Название" name="name">
      <UInput v-model="state.name" class="w-full" placeholder="Например, Нужды" />
    </UFormField>

    <UFormField label="Тип" name="type">
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="option in TYPE_OPTIONS"
          :key="option.value"
          type="button"
          class="flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors"
          :class="
            state.type === option.value
              ? 'border-primary bg-primary/10'
              : 'border-default hover:border-accented'
          "
          @click="state.type = option.value"
        >
          <span class="flex items-center gap-1.5 text-sm font-medium">
            <UIcon :name="option.icon" class="size-4" />
            {{ option.label }}
          </span>
          <span class="text-xs text-muted">{{ option.description }}</span>
        </button>
      </div>
      <p v-if="state.type === 'SAVINGS'" class="mt-2 text-xs text-muted">
        В накопительную копилку нельзя добавлять расходы и использовать её в долгах — только переливы и доля от
        дохода.
      </p>
    </UFormField>

    <UFormField label="Цвет" name="color">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="color in COLOR_PALETTE"
          :key="color"
          type="button"
          class="size-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
          :style="{ backgroundColor: color }"
          :aria-label="color"
          @click="state.color = color"
        >
          <UIcon v-if="state.color === color" name="i-lucide-check" class="size-4 text-white" />
        </button>
      </div>
    </UFormField>

    <UFormField label="Процент от дохода" name="defaultPercent" hint="Остальные копилки перераспределятся автоматически">
      <UInputNumber v-model="state.defaultPercent" :min="0" :max="100" class="w-full" />
    </UFormField>

    <UButton type="submit" block :loading="loading">{{ jar ? 'Сохранить' : 'Создать копилку' }}</UButton>
  </UForm>
</template>
