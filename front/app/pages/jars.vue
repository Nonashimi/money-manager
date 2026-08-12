<script setup lang="ts">
import type { Jar } from '../stores/jars';

const jarsStore = useJarsStore();
const toast = useToast();

await useAsyncData('jars', () => jarsStore.fetchJars());

const isCreateOpen = ref(false);
const editingJar = ref<Jar | null>(null);
const isEditOpen = computed({
  get: () => editingJar.value !== null,
  set: (value: boolean) => {
    if (!value) editingJar.value = null;
  },
});

async function handleCreate(payload: { name: string; color?: string; type?: 'SPENDING' | 'SAVINGS'; defaultPercent?: number }) {
  await jarsStore.createJar(payload);
  isCreateOpen.value = false;
  toast.add({ title: 'Копилка создана', color: 'success' });
}

async function handleUpdate(payload: { name: string; color?: string; type?: 'SPENDING' | 'SAVINGS'; defaultPercent?: number }) {
  if (!editingJar.value) return;
  await jarsStore.updateJar(editingJar.value.id, payload);
  editingJar.value = null;
  toast.add({ title: 'Копилка обновлена', color: 'success' });
}

async function handleArchive(jar: Jar) {
  await jarsStore.archiveJar(jar.id);
  toast.add({ title: `«${jar.name}» архивирована`, color: 'neutral' });
}

// Manual reallocation panel
const percents = reactive<Record<string, number>>({});

watch(
  () => jarsStore.activeJars,
  (list) => {
    for (const jar of list) {
      if (!(jar.id in percents)) percents[jar.id] = Number(jar.defaultPercent);
    }
  },
  { immediate: true },
);

const percentTotal = computed(() =>
  jarsStore.activeJars.reduce((sum, jar) => sum + (percents[jar.id] ?? 0), 0),
);
const isReallocateValid = computed(() => Math.abs(percentTotal.value - 100) < 0.01);

async function saveReallocation() {
  const allocations = jarsStore.activeJars.map((jar) => ({ jarId: jar.id, percent: percents[jar.id] ?? 0 }));
  await jarsStore.reallocate(allocations);
  toast.add({ title: 'Проценты обновлены', color: 'success' });
}

const isTransferOpen = ref(false);
</script>

<template>
  <UContainer class="py-8 space-y-8">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <h1 class="text-2xl font-semibold">Копилки</h1>
      <div class="flex gap-2 flex-wrap">
        <UButton icon="i-lucide-arrow-left-right" color="neutral" variant="subtle" @click="isTransferOpen = true">
          Перелить
        </UButton>
        <UButton icon="i-lucide-plus" @click="isCreateOpen = true">Добавить копилку</UButton>
      </div>
    </div>

    <p v-if="!jarsStore.activeJars.length" class="text-muted">Пока нет ни одной копилки — добавьте первую.</p>

    <div v-if="jarsStore.spendingJars.length" class="space-y-3">
      <h2 class="text-lg font-medium">Расходные</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <JarCard
          v-for="jar in jarsStore.spendingJars"
          :key="jar.id"
          :jar="jar"
          @edit="editingJar = $event"
          @archive="handleArchive"
        />
      </div>
    </div>

    <div v-if="jarsStore.savingsJars.length" class="space-y-3">
      <h2 class="text-lg font-medium">Накопительные</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <JarCard
          v-for="jar in jarsStore.savingsJars"
          :key="jar.id"
          :jar="jar"
          @edit="editingJar = $event"
          @archive="handleArchive"
        />
      </div>
    </div>

    <UCard v-if="jarsStore.activeJars.length > 1">
      <template #header>
        <h2 class="font-medium">Перераспределить проценты вручную</h2>
      </template>

      <div class="space-y-3">
        <div v-for="jar in jarsStore.activeJars" :key="jar.id" class="flex items-center gap-3">
          <span class="flex-1 min-w-0 truncate">{{ jar.name }}</span>
          <UInputNumber v-model="percents[jar.id]" :min="0" :max="100" class="w-28 shrink-0" />
          <span class="text-muted shrink-0">%</span>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-between flex-wrap gap-2">
          <span :class="isReallocateValid ? 'text-muted' : 'text-error'">Сумма: {{ percentTotal }}%</span>
          <UButton :disabled="!isReallocateValid" @click="saveReallocation">Сохранить распределение</UButton>
        </div>
      </template>
    </UCard>

    <UModal v-model:open="isTransferOpen" title="Перелить между копилками">
      <template #body>
        <TransferForm @done="isTransferOpen = false" />
      </template>
    </UModal>

    <UModal v-model:open="isCreateOpen" title="Новая копилка">
      <template #body>
        <JarForm @submit="handleCreate" />
      </template>
    </UModal>

    <UModal v-model:open="isEditOpen" title="Изменить копилку">
      <template #body>
        <JarForm :jar="editingJar" @submit="handleUpdate" />
      </template>
    </UModal>
  </UContainer>
</template>
