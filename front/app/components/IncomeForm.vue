<script setup lang="ts">
import * as z from 'zod';
import type { FormSubmitEvent } from '@nuxt/ui';

const jarsStore = useJarsStore();
const toast = useToast();
const emit = defineEmits<{ created: [] }>();
const api = useApi();

const schema = z.object({
  amount: z.number().positive('Введите сумму'),
  description: z.string().optional(),
  source: z.string().optional(),
});
type Schema = z.output<typeof schema>;

const state = reactive<Partial<Schema>>({ amount: undefined, description: undefined, source: undefined });
const loading = ref(false);
const useCustomSplit = ref(false);
const customPercents = reactive<Record<string, number>>({});

watch(useCustomSplit, (on) => {
  if (on) {
    for (const jar of jarsStore.activeJars) customPercents[jar.id] = Number(jar.defaultPercent);
  }
});

const customTotal = computed(() =>
  jarsStore.activeJars.reduce((sum, jar) => sum + (customPercents[jar.id] ?? 0), 0),
);
const isCustomValid = computed(() => !useCustomSplit.value || Math.abs(customTotal.value - 100) < 0.01);

// Live preview of how the income will split across jars — default percents, or the
// in-progress manual split. Normalized against whatever the segments currently sum to, so
// the bar always renders as a full strip even while the manual total is mid-edit / invalid.
interface PreviewSegment {
  jarId: string;
  name: string;
  color: string;
  percent: number;
}

const previewSegments = computed<PreviewSegment[]>(() =>
  jarsStore.activeJars
    .map((jar) => ({
      jarId: jar.id,
      name: jar.name,
      color: jar.color || '#6366f1',
      percent: useCustomSplit.value ? (customPercents[jar.id] ?? 0) : Number(jar.defaultPercent),
    }))
    .filter((seg) => seg.percent > 0),
);
const previewTotal = computed(() => previewSegments.value.reduce((sum, seg) => sum + seg.percent, 0));

function segmentWidth(percent: number): number {
  return previewTotal.value > 0 ? (percent / previewTotal.value) * 100 : 0;
}

function segmentAmount(percent: number): number {
  return state.amount && previewTotal.value > 0 ? (state.amount * percent) / previewTotal.value : 0;
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!isCustomValid.value) return;
  loading.value = true;
  try {
    const body: Record<string, unknown> = { ...event.data };
    if (useCustomSplit.value) {
      body.allocations = jarsStore.activeJars.map((jar) => ({
        jarId: jar.id,
        percent: customPercents[jar.id] ?? 0,
      }));
    }
    await api('/incomes', { method: 'POST', body });
    await jarsStore.fetchJars();
    state.amount = undefined;
    state.description = undefined;
    state.source = undefined;
    toast.add({ title: 'Доход добавлен', color: 'success' });
    emit('created');
  } catch (error: any) {
    toast.add({
      title: 'Не удалось добавить доход',
      description: error?.data?.message ?? undefined,
      color: 'error',
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
    <UFormField label="Сумма" name="amount">
      <MoneyInput v-model="state.amount" :min="0" class="w-full" />
    </UFormField>

    <div v-if="previewSegments.length" class="space-y-2">
      <p class="text-sm font-medium">
        {{ useCustomSplit ? 'Как распределится' : 'Распределение по умолчанию' }}
      </p>
      <div class="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-elevated">
        <div
          v-for="seg in previewSegments"
          :key="seg.jarId"
          class="h-full transition-all"
          :style="{ width: segmentWidth(seg.percent) + '%', backgroundColor: seg.color }"
        />
      </div>
      <div class="flex flex-wrap gap-x-4 gap-y-1">
        <div v-for="seg in previewSegments" :key="seg.jarId" class="flex items-center gap-1.5 text-sm">
          <span class="size-2 rounded-full shrink-0" :style="{ backgroundColor: seg.color }" />
          <span class="text-muted">{{ seg.name }}</span>
          <span class="tabular-nums">{{ formatPercent(seg.percent) }}</span>
          <span v-if="state.amount" class="text-muted tabular-nums">· {{ formatMoney(segmentAmount(seg.percent)) }}</span>
        </div>
      </div>
    </div>

    <UFormField label="Источник" name="source" hint="Например, зарплата, стипендия">
      <UInput v-model="state.source" class="w-full" />
    </UFormField>

    <UFormField label="Описание" name="description">
      <UInput v-model="state.description" class="w-full" />
    </UFormField>

    <div class="flex items-center gap-2">
      <USwitch v-model="useCustomSplit" />
      <span class="text-sm">Разделить по копилкам вручную</span>
    </div>

    <div v-if="useCustomSplit" class="space-y-2 border-l-2 border-default pl-3">
      <div v-for="jar in jarsStore.activeJars" :key="jar.id" class="flex items-center gap-3">
        <span class="flex-1 min-w-0 truncate text-sm">{{ jar.name }}</span>
        <UInputNumber v-model="customPercents[jar.id]" :min="0" :max="100" size="sm" class="w-24 shrink-0" />
        <span class="text-muted text-sm shrink-0">%</span>
      </div>
      <p :class="isCustomValid ? 'text-muted' : 'text-error'" class="text-sm">Сумма: {{ customTotal }}%</p>
    </div>

    <UButton type="submit" block :loading="loading" :disabled="!isCustomValid">Добавить доход</UButton>
  </UForm>
</template>
