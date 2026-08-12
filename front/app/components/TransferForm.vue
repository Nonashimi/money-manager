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
  })
  .refine((v) => v.fromJarId !== v.toJarId, { message: 'Копилки должны отличаться', path: ['toJarId'] });

type Schema = z.output<typeof schema>;

const state = reactive<Partial<Schema>>({
  fromJarId: undefined,
  toJarId: undefined,
  amount: undefined,
  description: undefined,
});

const jarOptions = computed(() => jarsStore.activeJars.map((j) => ({ label: j.name, value: j.id })));
const loading = ref(false);

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
    <UButton type="submit" block :loading="loading">Перелить</UButton>
  </UForm>
</template>
