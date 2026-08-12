<script setup lang="ts">
import * as z from 'zod';
import type { FormSubmitEvent } from '@nuxt/ui';
import type { AuthUser } from '../stores/auth';

const schema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
});

type Schema = z.output<typeof schema>;

const state = reactive<Partial<Schema>>({ email: undefined, password: undefined });
const loading = ref(false);
const toast = useToast();
const authStore = useAuthStore();
const api = useApi();

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true;
  try {
    const res = await api<{ accessToken: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: event.data,
    });
    authStore.setSession(res.accessToken, res.user);
    await navigateTo('/');
  } catch {
    toast.add({ title: 'Не удалось войти', description: 'Проверьте email и пароль', color: 'error' });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-[100dvh] flex flex-col items-center justify-center px-4 bg-primary/5">
    <div class="mb-6 flex items-center gap-2 font-semibold text-lg">
      <span class="flex size-8 items-center justify-center rounded-lg bg-primary">
        <UIcon name="i-lucide-wallet" class="size-4 text-white" />
      </span>
      Money Manager
    </div>

    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-lg font-semibold">Вход</h1>
      </template>

      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Email" name="email">
          <UInput v-model="state.email" type="email" class="w-full" placeholder="you@example.com" />
        </UFormField>

        <UFormField label="Пароль" name="password">
          <UInput v-model="state.password" type="password" class="w-full" />
        </UFormField>

        <UButton type="submit" block :loading="loading">Войти</UButton>
      </UForm>

      <template #footer>
        <p class="text-sm text-muted">
          Нет аккаунта?
          <NuxtLink to="/register" class="text-primary">Зарегистрироваться</NuxtLink>
        </p>
      </template>
    </UCard>
  </div>
</template>
