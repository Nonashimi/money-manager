<script setup lang="ts">
const authStore = useAuthStore();
const jarsStore = useJarsStore();

await useAsyncData('dashboard-jars', () => jarsStore.fetchJars());

const totalSpendable = computed(() =>
  jarsStore.spendingJars.reduce((sum, jar) => sum + Number(jar.balance), 0),
);
const totalSavings = computed(() =>
  jarsStore.savingsJars.reduce((sum, jar) => sum + Number(jar.balance), 0),
);

const isIncomeOpen = ref(false);
const toast = useToast();

async function handleArchive(jar: { id: string; name: string }) {
  await jarsStore.archiveJar(jar.id);
  toast.add({ title: `«${jar.name}» архивирована`, color: 'neutral' });
}

const greetingName = computed(() => authStore.user?.name || authStore.user?.email?.split('@')[0]);
</script>

<template>
  <UContainer class="py-8 space-y-8">
    <p class="text-muted">С возвращением, {{ greetingName }}</p>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div
        class="relative overflow-hidden rounded-2xl border border-default bg-gradient-to-br from-primary/15 via-elevated to-elevated px-6 py-8 sm:col-span-2 sm:px-8"
      >
        <p class="text-sm text-muted">Доступно к тратам</p>
        <p class="mt-2 text-4xl font-semibold tabular-nums sm:text-5xl">{{ formatMoney(totalSpendable) }}</p>
        <div class="mt-6 flex flex-wrap gap-2">
          <UButton icon="i-lucide-plus" size="lg" @click="isIncomeOpen = true">Добавить доход</UButton>
          <UButton to="/jars" color="neutral" variant="subtle" size="lg">Управление копилками</UButton>
        </div>
      </div>

      <div class="rounded-2xl border border-default bg-elevated/50 px-6 py-8">
        <p class="flex items-center gap-1.5 text-sm text-muted">
          <UIcon name="i-lucide-vault" class="size-4" />
          Накоплено
        </p>
        <p class="mt-2 text-3xl font-semibold tabular-nums">{{ formatMoney(totalSavings) }}</p>
        <p class="mt-1 text-xs text-muted">Не входит в сумму к тратам</p>
      </div>
    </div>

    <div v-if="jarsStore.spendingJars.length" class="space-y-3">
      <h2 class="text-lg font-medium">Расходные копилки</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <JarCard
          v-for="jar in jarsStore.spendingJars"
          :key="jar.id"
          :jar="jar"
          @edit="navigateTo('/jars')"
          @archive="handleArchive"
        />
      </div>
    </div>

    <div v-if="jarsStore.savingsJars.length" class="space-y-3">
      <h2 class="text-lg font-medium">Накопительные копилки</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <JarCard
          v-for="jar in jarsStore.savingsJars"
          :key="jar.id"
          :jar="jar"
          @edit="navigateTo('/jars')"
          @archive="handleArchive"
        />
      </div>
    </div>

    <UCard v-if="!jarsStore.activeJars.length" class="border-dashed">
      <div class="flex flex-col items-center gap-3 py-6 text-center">
        <span class="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <UIcon name="i-lucide-piggy-bank" class="size-6 text-primary" />
        </span>
        <p class="text-muted">
          Копилок пока нет.
          <NuxtLink to="/jars" class="text-primary">Создайте первую</NuxtLink>, чтобы начать распределять доход.
        </p>
      </div>
    </UCard>

    <UModal v-model:open="isIncomeOpen" title="Новый доход">
      <template #body>
        <IncomeForm @created="isIncomeOpen = false" />
      </template>
    </UModal>
  </UContainer>
</template>
