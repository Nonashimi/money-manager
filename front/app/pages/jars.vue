<script setup lang="ts">
import type { DriveStep } from 'driver.js'
import type { Jar } from '../stores/jars'

const jarsStore = useJarsStore()
const toast = useToast()

await useAsyncData('jars', () => jarsStore.fetchJars())

const isCreateOpen = ref(false)
const editingJar = ref<Jar | null>(null)
const isEditOpen = computed({
  get: () => editingJar.value !== null,
  set: (value: boolean) => {
    if (!value) editingJar.value = null
  }
})

async function handleCreate(payload: { name: string, color?: string, type?: 'SPENDING' | 'SAVINGS', defaultPercent?: number }) {
  await jarsStore.createJar(payload)
  isCreateOpen.value = false
  toast.add({ title: 'Копилка создана', color: 'success' })
}

async function handleUpdate(payload: { name: string, color?: string, type?: 'SPENDING' | 'SAVINGS', defaultPercent?: number }) {
  if (!editingJar.value) return
  await jarsStore.updateJar(editingJar.value.id, payload)
  editingJar.value = null
  toast.add({ title: 'Копилка обновлена', color: 'success' })
}

async function handleArchive(jar: Jar) {
  await jarsStore.archiveJar(jar.id)
  toast.add({ title: `«${jar.name}» архивирована`, color: 'neutral' })
}

// Manual reallocation panel — always sums to 100 automatically, see usePercentAllocator.
const allocator = usePercentAllocator(computed(() => jarsStore.activeJars))

async function saveReallocation() {
  // The endpoint requires every active jar to be present (unchecked ones just carry 0%).
  const allocations = jarsStore.activeJars.map(jar => ({ jarId: jar.id, percent: allocator.percents[jar.id] ?? 0 }))
  await jarsStore.reallocate(allocations)
  toast.add({ title: 'Проценты обновлены', color: 'success' })
}

const isTransferOpen = ref(false)

onMounted(async () => {
  const { hasSeenTour, markTourSeen } = useOnboarding()
  if (await hasSeenTour('jars')) return

  const steps: DriveStep[] = [
    {
      element: '[data-tour="jars-add-btn"]',
      popover: {
        title: 'Новая копилка',
        description: 'Тип «Расходная» — можно тратить. «Накопительная» — деньги откладываются и не видны на доске.',
        side: 'bottom',
        align: 'end'
      }
    }
  ]

  if (jarsStore.spendingJars.length) {
    steps.push({
      element: '[data-tour="jars-spending-grid"]',
      popover: {
        title: 'Ваши копилки',
        description: 'Цвет копилки используется везде — на доске расходов и в круговой диаграмме статистики.',
        side: 'top',
        align: 'start'
      }
    })
  }

  if (jarsStore.activeJars.length > 1) {
    steps.push(
      {
        element: '[data-tour="jars-realloc-row"]',
        popover: {
          title: 'Проценты дохода',
          description: 'Снимите галочку, чтобы исключить копилку — её доля перераспределится на остальные. Меняете процент вручную — соседние копилки подстроятся сами, сумма всегда останется 100%.',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: '[data-tour="jars-even-btn"]',
        popover: {
          title: 'Поровну',
          description: 'Мгновенно делит проценты между отмеченными копилками поровну.',
          side: 'bottom',
          align: 'end'
        }
      }
    )
  }

  createTour(steps, () => markTourSeen('jars')).drive()
})
</script>

<template>
  <UContainer class="py-8 space-y-8">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <h1 class="text-2xl font-semibold">
        Копилки
      </h1>
      <div class="flex gap-2 flex-wrap">
        <UButton
          icon="i-lucide-arrow-left-right"
          color="neutral"
          variant="subtle"
          @click="isTransferOpen = true"
        >
          Перелить
        </UButton>
        <UButton
          data-tour="jars-add-btn"
          icon="i-lucide-plus"
          @click="isCreateOpen = true"
        >
          Добавить копилку
        </UButton>
      </div>
    </div>

    <p
      v-if="!jarsStore.activeJars.length"
      class="text-muted"
    >
      Пока нет ни одной копилки — добавьте первую.
    </p>

    <div
      v-if="jarsStore.spendingJars.length"
      data-tour="jars-spending-grid"
      class="space-y-3"
    >
      <h2 class="text-lg font-medium">
        Расходные
      </h2>
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

    <div
      v-if="jarsStore.savingsJars.length"
      class="space-y-3"
    >
      <h2 class="text-lg font-medium">
        Накопительные
      </h2>
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
        <div class="flex items-center justify-between gap-2">
          <h2 class="font-medium">
            Перераспределить проценты
          </h2>
          <UButton
            data-tour="jars-even-btn"
            size="xs"
            color="neutral"
            variant="ghost"
            @click="allocator.distributeEvenly"
          >
            Поровну
          </UButton>
        </div>
      </template>

      <div class="space-y-3">
        <div
          v-for="jar in jarsStore.activeJars"
          :key="jar.id"
          data-tour="jars-realloc-row"
          class="flex items-center gap-3"
        >
          <UCheckbox
            :model-value="allocator.included[jar.id]"
            @update:model-value="(v: boolean) => allocator.toggleIncluded(jar.id, v)"
          />
          <span
            class="flex-1 min-w-0 truncate"
            :class="{ 'text-dimmed': !allocator.included[jar.id] }"
          >
            {{ jar.name }}
          </span>
          <UInputNumber
            :model-value="allocator.percents[jar.id]"
            :disabled="!allocator.included[jar.id]"
            :min="0"
            :max="100"
            class="w-28 shrink-0"
            @update:model-value="(v: number) => allocator.setPercent(jar.id, v)"
          />
          <span class="text-muted shrink-0">%</span>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-between flex-wrap gap-2">
          <span :class="allocator.isValid.value ? 'text-muted' : 'text-error'">Сумма: {{ allocator.total.value }}%</span>
          <UButton
            :disabled="!allocator.isValid.value"
            @click="saveReallocation"
          >
            Сохранить распределение
          </UButton>
        </div>
      </template>
    </UCard>

    <UModal
      v-model:open="isTransferOpen"
      title="Перелить между копилками"
    >
      <template #body>
        <TransferForm @done="isTransferOpen = false" />
      </template>
    </UModal>

    <UModal
      v-model:open="isCreateOpen"
      title="Новая копилка"
    >
      <template #body>
        <JarForm @submit="handleCreate" />
      </template>
    </UModal>

    <UModal
      v-model:open="isEditOpen"
      title="Изменить копилку"
    >
      <template #body>
        <JarForm
          :jar="editingJar"
          @submit="handleUpdate"
        />
      </template>
    </UModal>
  </UContainer>
</template>
