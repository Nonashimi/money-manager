<script setup lang="ts">
import * as z from 'zod';
import type { FormSubmitEvent } from '@nuxt/ui';

const props = defineProps<{ debtId: string; remaining: number }>();
const emit = defineEmits<{ done: [] }>();

const jarsStore = useJarsStore();
const api = useApi();
const toast = useToast();

const schema = z.object({ amount: z.number().positive().max(props.remaining, 'Больше остатка долга') });
type Schema = z.output<typeof schema>;

const state = reactive<Partial<Schema>>({ amount: props.remaining });
const useCustomSplit = ref(false);
const jarAmounts = reactive<Record<string, number>>({});

const allocatedTotal = computed(() =>
  jarsStore.spendingJars.reduce((sum, jar) => sum + (jarAmounts[jar.id] ?? 0), 0),
);
const isAllocationValid = computed(
  () => !useCustomSplit.value || Math.abs(allocatedTotal.value - (state.amount ?? 0)) < 0.01,
);

function distributeEvenly() {
  if (!state.amount || !jarsStore.spendingJars.length) return;
  const share = Math.floor((state.amount / jarsStore.spendingJars.length) * 100) / 100;
  let allocated = 0;
  jarsStore.spendingJars.forEach((jar, index) => {
    const isLast = index === jarsStore.spendingJars.length - 1;
    const value = isLast ? Math.round((state.amount! - allocated) * 100) / 100 : share;
    jarAmounts[jar.id] = value;
    allocated += value;
  });
}

const loading = ref(false);

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!isAllocationValid.value) return;
  loading.value = true;
  try {
    const body: Record<string, unknown> = { amount: event.data.amount };
    if (useCustomSplit.value) {
      body.allocations = jarsStore.spendingJars
        .filter((jar) => (jarAmounts[jar.id] ?? 0) > 0)
        .map((jar) => ({ jarId: jar.id, amount: jarAmounts[jar.id] }));
    }
    await api(`/debts/${props.debtId}/repay`, { method: 'POST', body });
    await jarsStore.fetchJars();
    toast.add({ title: 'Долг обновлён', color: 'success' });
    emit('done');
  } catch (error: any) {
    toast.add({ title: 'Не удалось провести операцию', description: error?.data?.message, color: 'error' });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
    <UFormField label="Сумма возврата" name="amount">
      <MoneyInput v-model="state.amount" :min="0" :max="remaining" class="w-full" />
    </UFormField>

    <div class="flex items-center gap-2">
      <USwitch v-model="useCustomSplit" />
      <span class="text-sm">Указать копилки вручную (иначе — как при создании долга)</span>
    </div>

    <div v-if="useCustomSplit" class="space-y-2 border-l-2 border-default pl-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">Копилки</span>
        <UButton size="xs" color="neutral" variant="ghost" :disabled="!state.amount" @click="distributeEvenly">
          Поровну
        </UButton>
      </div>
      <div v-for="jar in jarsStore.spendingJars" :key="jar.id" class="flex items-center gap-3">
        <span class="flex-1 min-w-0 truncate text-sm">{{ jar.name }}</span>
        <MoneyInput v-model="jarAmounts[jar.id]" :min="0" size="sm" class="w-28 shrink-0" />
      </div>
      <p :class="isAllocationValid ? 'text-muted' : 'text-error'" class="text-sm">
        Распределено: {{ formatMoney(allocatedTotal) }} из {{ formatMoney(state.amount ?? 0) }}
      </p>
    </div>

    <UButton type="submit" block :loading="loading" :disabled="!isAllocationValid">Подтвердить</UButton>
  </UForm>
</template>
