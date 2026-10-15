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
      element: window.matchMedia('(min-width: 1024px)').matches
        ? '[data-tour="add-income-btn"]'
        : '[data-tour="add-income-fab"]',
      popover: {
        title: 'Добавить доход',
        description: 'Каждый доход автоматически распределяется по копилкам согласно их процентам — или вручную, если включить ручное разделение.',
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

const isIncomeOpen = ref(false)
const toast = useToast()

async function handleArchive(jar: { id: string, name: string }) {
  await jarsStore.archiveJar(jar.id)
  toast.add({ title: `«${jar.name}» архивирована`, color: 'neutral' })
}

const greetingName = computed(() => authStore.user?.name || authStore.user?.email?.split('@')[0])
</script>

<template>
  <UContainer class="py-5 sm:py-8">
    <div class="hidden items-center justify-between pb-5 lg:flex">
      <h1 class="text-[22px] font-extrabold text-highlighted">
        Главная
      </h1>
      <UButton
        data-tour="add-income-btn"
        icon="i-lucide-plus"
        @click="isIncomeOpen = true"
      >
        Доход
      </UButton>
    </div>

    <div class="grid grid-cols-1 gap-x-4 gap-y-5 lg:grid-cols-3">
      <section
        data-tour="total-spendable"
        class="space-y-2 lg:col-span-2"
      >
        <p class="text-xs tracking-wide text-muted">
          Доступно к тратам
        </p>
        <p class="text-5xl font-extrabold tracking-tight text-highlighted tabular-nums">
          {{ formatMoney(totalSpendable) }}
        </p>
        <div class="orn rounded-[1px]" />
      </section>

      <section
        data-tour="total-savings"
        class="order-last flex flex-col justify-center gap-1 rounded-[10px] border-2 border-[#3b5aa8] bg-[#1a2d57] px-4 py-4 lg:order-none lg:col-start-3 lg:row-start-1"
      >
        <p class="text-xs text-white/70">
          Накоплено · не входит в траты
        </p>
        <p class="text-[26px] font-extrabold tabular-nums text-white">
          {{ formatMoney(totalSavings) }}
        </p>
      </section>

      <div
        v-if="jarsStore.spendingJars.length"
        data-tour="jar-cards"
        class="space-y-3 lg:col-span-3"
      >
        <h2 class="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
          Расходные копилки
        </h2>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <JarCard
            v-for="jar in jarsStore.spendingJars"
            :key="jar.id"
            :jar="jar"
            @edit="navigateTo('/jars')"
            @archive="handleArchive"
          />
        </div>
      </div>

      <div
        v-if="jarsStore.savingsJars.length"
        class="space-y-3 lg:col-span-3"
      >
        <h2 class="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
          Накопительные копилки
        </h2>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <JarCard
            v-for="jar in jarsStore.savingsJars"
            :key="jar.id"
            :jar="jar"
            @edit="navigateTo('/jars')"
            @archive="handleArchive"
          />
        </div>
      </div>

      <UCard
        v-if="!jarsStore.activeJars.length"
        data-tour="empty-jars"
        class="border-dashed lg:col-span-3"
      >
        <div class="flex flex-col items-center gap-3 py-6 text-center">
          <span class="flex size-12 items-center justify-center rounded-full bg-primary/20">
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
    </div>

    <button
      type="button"
      data-tour="add-income-fab"
      class="fixed right-4 bottom-24 z-30 flex size-14 items-center justify-center rounded-xl bg-primary text-white shadow-lg lg:hidden"
      aria-label="Добавить доход"
      @click="isIncomeOpen = true"
    >
      <UIcon
        name="i-lucide-plus"
        class="size-7"
      />
    </button>

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
