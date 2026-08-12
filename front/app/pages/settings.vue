<script setup lang="ts">
interface Settings {
  dailyNorm: string | null;
  currency: string;
  theme: string;
}

const api = useApi();
const toast = useToast();
const colorMode = useColorMode();

const { data: settings, refresh } = await useAsyncData('settings', () => api<Settings>('/settings'));

const dailyNorm = ref<number | undefined>(settings.value?.dailyNorm ? Number(settings.value.dailyNorm) : undefined);
const currency = ref(settings.value?.currency ?? 'KZT');
const theme = ref(settings.value?.theme ?? 'system');

const themeOptions = [
  { label: 'Системная', value: 'system' },
  { label: 'Светлая', value: 'light' },
  { label: 'Тёмная', value: 'dark' },
];

const loading = ref(false);

async function save() {
  loading.value = true;
  try {
    await api('/settings', { method: 'PATCH', body: { dailyNorm: dailyNorm.value, currency: currency.value, theme: theme.value } });
    colorMode.preference = theme.value;
    await refresh();
    toast.add({ title: 'Настройки сохранены', color: 'success' });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UContainer class="py-8 max-w-md space-y-6">
    <h1 class="text-2xl font-semibold">Настройки</h1>

    <UCard>
      <div class="space-y-4">
        <UFormField label="Дневная норма трат" hint="Используется для сравнения на странице статистики">
          <MoneyInput v-model="dailyNorm" :min="0" class="w-full" />
        </UFormField>

        <UFormField label="Валюта" hint="Код валюты, например KZT">
          <UInput v-model="currency" class="w-full" />
        </UFormField>

        <UFormField label="Тема">
          <USelect v-model="theme" :items="themeOptions" class="w-full" />
        </UFormField>

        <UButton block :loading="loading" @click="save">Сохранить</UButton>
      </div>
    </UCard>
  </UContainer>
</template>
