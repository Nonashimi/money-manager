<script setup lang="ts">
import type { DriveStep } from 'driver.js'

const authStore = useAuthStore()
const jarsStore = useJarsStore()

await useAsyncData('dashboard-jars', () => jarsStore.fetchJars())

function buildTourSteps(): DriveStep[] {
  const steps: DriveStep[] = [
    {
      element: '[data-tour="total-spendable"]',
      popover: {
        title: 'Доступно к тратам',
        description: 'Сумма всех расходных копилок — то, что реально можно потратить прямо сейчас.',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '[data-tour="total-savings"]',
      popover: {
        title: 'Накоплено',
        description: 'Деньги в накопительных копилках. Они отложены и не входят в сумму к тратам.',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '[data-tour="add-income-btn"]',
      popover: {
        title: 'Добавить доход',
        description: 'Каждый доход автоматически распределяется по копилкам согласно их процентам — или вручную, если включить ручное разделение.',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '[data-tour="manage-jars-btn"]',
      popover: {
        title: 'Копилки',
        description: 'Здесь настраиваются сами копилки: название, тип, цвет и доля в процентах от каждого дохода.',
        side: 'bottom',
        align: 'start'
      }
    }
  ]

  steps.push(
    jarsStore.activeJars.length
      ? {
          element: '[data-tour="jar-cards"]',
          popover: {
            title: 'Ваши копилки',
            description: 'Каждая карточка — одна копилка со своим балансом, цветом и долей от каждого дохода.',
            side: 'top',
            align: 'start'
          }
        }
      : {
          element: '[data-tour="empty-jars"]',
          popover: {
            title: 'С чего начать',
            description: 'Копилок пока нет — создайте первую, чтобы было куда распределять доход.',
            side: 'top',
            align: 'start'
          }
        }
  )

  return steps
}

onMounted(async () => {
  const { hasSeenTour, markTourSeen } = useOnboarding()
  if (await hasSeenTour('dashboard')) return
  createTour(buildTourSteps(), () => markTourSeen('dashboard')).drive()
})

const totalSpendable = computed(() =>
  jarsStore.spendingJars.reduce((sum, jar) => sum + Number(jar.balance), 0)
)
const totalSavings = computed(() =>
  jarsStore.savingsJars.reduce((sum, jar) => sum + Number(jar.balance), 0)
)

const maxSpendingBalance = computed(() =>
  Math.max(1, ...jarsStore.spendingJars.map(jar => Number(jar.balance)))
)
const maxSavingsBalance = computed(() =>
  Math.max(1, ...jarsStore.savingsJars.map(jar => Number(jar.balance)))
)

const isIncomeOpen = ref(false)
const toast = useToast()

async function handleArchive(jar: { id: string, name: string }) {
  await jarsStore.archiveJar(jar.id)
  toast.add({ title: `«${jar.name}» архивирована`, color: 'neutral' })
}

const greetingName = computed(() => authStore.user?.name || authStore.user?.email?.split('@')[0])
</script>

<template>
  <UContainer class="py-6 sm:py-8 space-y-6">
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <section
        data-tour="total-spendable"
        class="rounded-xl border border-default bg-gradient-to-br from-elevated to-muted p-5 sm:p-6 lg:col-span-2"
      >
        <p class="text-sm text-muted">
          Доступно к тратам
        </p>
        <p class="mt-1 text-4xl font-bold tracking-tight text-highlighted tabular-nums sm:text-5xl">
          {{ formatMoney(totalSpendable) }}
        </p>
        <div class="mt-5 flex flex-wrap gap-2">
          <UButton
            data-tour="add-income-btn"
            icon="i-lucide-plus"
            size="lg"
            @click="isIncomeOpen = true"
          >
            Добавить доход
          </UButton>
          <UButton
            data-tour="manage-jars-btn"
            to="/jars"
            color="neutral"
            variant="subtle"
            size="lg"
          >
            Управление копилками
          </UButton>
        </div>
      </section>

      <section
        data-tour="total-savings"
        class="rounded-xl border border-default bg-elevated p-5 sm:p-6"
      >
        <p class="flex items-center gap-1.5 text-sm text-muted">
          <UIcon
            name="i-lucide-vault"
            class="size-4"
          />
          Накоплено
        </p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-highlighted">
          {{ formatMoney(totalSavings) }}
        </p>
        <p class="mt-1 text-xs text-muted">
          Не входит в сумму к тратам
        </p>
      </section>
    </div>

    <div
      v-if="jarsStore.spendingJars.length"
      data-tour="jar-cards"
      class="space-y-3"
    >
      <h2 class="text-sm font-medium text-muted">
        Расходные копилки
      </h2>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <JarCard
          v-for="jar in jarsStore.spendingJars"
          :key="jar.id"
          :jar="jar"
          :fill="Number(jar.balance) / maxSpendingBalance"
          @edit="navigateTo('/jars')"
          @archive="handleArchive"
        />
      </div>
    </div>

    <div
      v-if="jarsStore.savingsJars.length"
      class="space-y-3"
    >
      <h2 class="text-sm font-medium text-muted">
        Накопительные копилки
      </h2>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <JarCard
          v-for="jar in jarsStore.savingsJars"
          :key="jar.id"
          :jar="jar"
          :fill="Number(jar.balance) / maxSavingsBalance"
          @edit="navigateTo('/jars')"
          @archive="handleArchive"
        />
      </div>
    </div>

    <UCard
      v-if="!jarsStore.activeJars.length"
      data-tour="empty-jars"
      class="border-dashed"
    >
      <div class="flex flex-col items-center gap-3 py-6 text-center">
        <span class="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <UIcon
            name="i-lucide-piggy-bank"
            class="size-6 text-primary"
          />
        </span>
        <p class="text-muted">
          Копилок пока нет.
          <NuxtLink
            to="/jars"
            class="text-primary"
          >Создайте первую</NuxtLink>, чтобы начать распределять доход.
        </p>
      </div>
    </UCard>

    <UModal
      v-model:open="isIncomeOpen"
      title="Новый доход"
    >
      <template #body>
        <IncomeForm @created="isIncomeOpen = false" />
      </template>
    </UModal>
  </UContainer>
</template>
