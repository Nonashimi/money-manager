<script setup lang="ts">
import * as z from 'zod';
import type { FormSubmitEvent } from '@nuxt/ui';

const jarsStore = useJarsStore();
const api = useApi();
const toast = useToast();
const emit = defineEmits<{ done: [] }>();

const schema = z
  .object({
    fromJarId: z.string().min(1, 'Выберите копилку'),
    toJarId: z.string().min(1, 'Выберите копилку'),
    amount: z.number().positive('Введите сумму'),
    description: z.string().optional(),
    asLoan: z.boolean().optional(),
  })
  .refine((v) => v.fromJarId !== v.toJarId, { message: 'Копилки должны отличаться', path: ['toJarId'] });

type Schema = z.output<typeof schema>;

const state = reactive<Partial<Schema>>({
  fromJarId: undefined,
  toJarId: undefined,
  amount: undefined,
  description: undefined,
  asLoan: false,
});

const jarOptions = computed(() => jarsStore.activeJars.map((j) => ({ label: j.name, value: j.id })));
const loading = ref(false);

const fromJar = computed(() => jarsStore.activeJars.find((j) => j.id === state.fromJarId));
const isFromBank = computed(() => fromJar.value?.type === 'BANK');

watch(isFromBank, (value) => {
  if (!value) state.asLoan = false;
});

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true;
  try {
    await api('/transfers', { method: 'POST', body: event.data });
    await jarsStore.fetchJars();
    toast.add({ title: 'Перелив выполнен', color: 'success' });
    emit('done');
  } catch (error: any) {
    toast.add({ title: 'Не удалось перелить', description: error?.data?.message, color: 'error' });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
    <UFormField label="Откуда" name="fromJarId">
      <USelect v-model="state.fromJarId" :items="jarOptions" class="w-full" />
    </UFormField>
    <UFormField label="Куда" name="toJarId">
      <USelect v-model="state.toJarId" :items="jarOptions" class="w-full" />
    </UFormField>
    <UFormField label="Сумма" name="amount">
      <MoneyInput v-model="state.amount" :min="0" class="w-full" />
    </UFormField>
    <UFormField label="Описание" name="description">
      <UInput v-model="state.description" class="w-full" />
    </UFormField>

    <div v-if="isFromBank" class="flex items-start gap-2 rounded-lg border border-default px-3 py-2.5">
      <UCheckbox v-model="state.asLoan" />
      <div>
        <p class="text-sm font-medium">Оформить как долг</p>
        <p class="text-xs text-muted">
          Сумма попадёт в «Я должен» на контакт «Себе» — когда вы её вернёте, деньги автоматически вернутся в
          «{{ fromJar?.name }}».
        </p>
      </div>
    </div>

    <UButton type="submit" block :loading="loading">Перелить</UButton>
  </UForm>
</template>
