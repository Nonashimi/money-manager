<script setup lang="ts">
import { getLocalTimeZone, parseDate, today, type DateValue } from '@internationalized/date'
import type { DriveStep } from 'driver.js'
import type { DateRange } from 'reka-ui'
import { Bar, Doughnut } from 'vue-chartjs'

interface Summary {
  total: string
  averagePerDay: string
  daysInRange: number
  dailyNorm: string | null
  overNorm: boolean | null
}
interface DailyPoint {
  date: string
  total: string
}
interface JarBreakdown {
  jarId: string
  jarName: string
  total: string
}

const api = useApi()
const jarsStore = useJarsStore()
const authStore = useAuthStore()

type Preset = 'day' | 'week' | 'month'
type Period = Preset | 'custom'
const period = ref<Period>('day')
const presetOptions: { value: Preset, label: string }[] = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' }
]
const presetDays: Record<Preset, number> = { day: 1, week: 7, month: 30 }

const todayValue = today(getLocalTimeZone())
// Before the account existed there's no history to show — that's the earliest pickable date.
const minValue = computed<DateValue>(() => {
  const createdAt = authStore.user?.createdAt
  return createdAt ? parseDate(createdAt.slice(0, 10)) : todayValue
})

// How many calendar days the account has existed for — hides "Неделя"/"Месяц" when they can't
// possibly show anything a smaller preset doesn't already, since there's no history to fill them.
const daysSinceCreation = computed(() => {
  const createdAt = authStore.user?.createdAt
  if (!createdAt) return 1
  const created = new Date(createdAt)
  const createdStart = Date.UTC(created.getUTCFullYear(), created.getUTCMonth(), created.getUTCDate())
  const now = new Date()
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.floor((todayStart - createdStart) / (24 * 60 * 60 * 1000)) + 1
})

const visiblePresetOptions = computed(() =>
  presetOptions.filter((opt) => {
    if (opt.value === 'week') return daysSinceCreation.value > 1
    if (opt.value === 'month') return daysSinceCreation.value > 7
    return true
  })
)

const isRangePickerOpen = ref(false)
const customRange = ref<DateRange | null>(null)
const customRangeLabel = computed(() => {
  if (!customRange.value?.start || !customRange.value?.end) return 'Свой период'
  const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
  return `${fmt.format(customRange.value.start.toDate(getLocalTimeZone()))} – ${fmt.format(customRange.value.end.toDate(getLocalTimeZone()))}`
})

function selectPreset(value: Preset) {
  period.value = value
  customRange.value = null
}

function onCustomRangeUpdate(value: DateRange | null) {
  customRange.value = value
  if (value?.start && value?.end) {
    period.value = 'custom'
    isRangePickerOpen.value = false
  }
}

// Local calendar date, not UTC — "today" must mean the user's own today, same convention as the
// board page. Sent explicitly as `to` on every request below so the backend always anchors "today"
// to the browser's local calendar day, not its own server instant: between local midnight and UTC
// midnight (e.g. 00:00–05:00 for a UTC+5 user), the server's raw `new Date()` is still "yesterday"
// in UTC, which would silently exclude an expense the user just added "today" from every query.
function toISODate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const todayISO = toISODate(new Date())

// Presets send a day-count, not a computed `from` — the backend clamps that lookback window to
// the user's first-ever expense (same rule as the old default range), so "Неделя"/"Месяц" never
// divide the total by days that predate any real history. Only the custom picker sends exact
// dates, since that's a deliberate user choice that shouldn't be second-guessed.
const rangeParams = computed(() => {
  if (period.value === 'custom' && customRange.value?.start && customRange.value?.end) {
    return { from: customRange.value.start.toString(), to: customRange.value.end.toString() }
  }
  const preset = period.value === 'custom' ? 'day' : period.value
  return { days: presetDays[preset], to: todayISO }
})

const { data: summary } = await useAsyncData(
  'stats-summary',
  () => api<Summary>('/statistics/summary', { query: rangeParams.value }),
  { watch: [rangeParams] }
)
// "В среднем в день" and the norm comparison are meant to be a stable baseline, not something
// that jumps around as the period selector changes — so this is a separate, unwatched fetch
// spanning the full history (from the first-ever expense), independent of `period`.
const { data: lifetimeSummary, refresh: refreshLifetimeSummary } = await useAsyncData('stats-lifetime', () =>
  api<Summary>('/statistics/summary', { query: { allTime: true, to: todayISO } })
)
const { data: daily } = await useAsyncData(
  'stats-daily',
  () => api<DailyPoint[]>('/statistics/daily', { query: { to: todayISO } }),
  { default: () => [] as DailyPoint[] }
)
const { data: byJar } = await useAsyncData(
  'stats-by-jar',
  () => api<JarBreakdown[]>('/statistics/by-jar', { query: rangeParams.value }),
  { default: () => [] as JarBreakdown[], watch: [rangeParams] }
)
await useAsyncData('stats-jars', () => jarsStore.fetchJars(true))

const { data: settings } = await useAsyncData('stats-settings', () => api<{ excludedStatDays: string[] }>('/settings'))
const excludedDays = computed(() => new Set(settings.value?.excludedStatDays ?? []))
const isExcludeDaysOpen = ref(false)
const togglingDay = ref<string | null>(null)

// Only days that actually had spending are worth curating — an empty day contributes nothing to
// the average either way, so listing it would just be noise.
const spentDays = computed(() =>
  [...(daily.value ?? [])].reverse().filter(d => Number(d.total) > 0)
)

async function toggleExcludedDay(date: string, keepInAverage: boolean) {
  togglingDay.value = date
  const next = new Set(excludedDays.value)
  if (keepInAverage) {
    next.delete(date)
  } else {
    next.add(date)
  }
  try {
    settings.value = await api<{ excludedStatDays: string[] }>('/settings', { method: 'PATCH', body: { excludedStatDays: Array.from(next) } })
    await refreshLifetimeSummary()
  } finally {
    togglingDay.value = null
  }
}

function formatDayLabel(dateStr: string) {
  const [y = 1970, m = 1, d = 1] = dateStr.split('-').map(Number)
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d))
}

// Match each jar's own color (from JarForm's palette) instead of a generic chart palette,
// so the doughnut matches what the user sees on the jar cards and kanban board.
function colorForJar(jarId: string): string {
  return jarsStore.jars.find(j => j.id === jarId)?.color || '#6366f1'
}

const dailyChartData = computed(() => ({
  labels: (daily.value ?? []).map(d => d.date.slice(5)),
  datasets: [
    { label: 'Расходы', data: (daily.value ?? []).map(d => Number(d.total)), backgroundColor: '#6366f1', borderRadius: 4 }
  ]
}))

const byJarChartData = computed(() => ({
  labels: (byJar.value ?? []).map(j => j.jarName),
  datasets: [
    {
      data: (byJar.value ?? []).map(j => Number(j.total)),
      backgroundColor: (byJar.value ?? []).map(j => colorForJar(j.jarId))
    }
  ]
}))

const chartOptions = { responsive: true, maintainAspectRatio: false }

// How far the lifetime average sits from the configured norm — powers the "Превышение на …" /
// "Есть запас …" badge on the "Обычный день" card.
const normDelta = computed(() => {
  if (!lifetimeSummary.value?.dailyNorm) return null
  return Number(lifetimeSummary.value.averagePerDay) - Number(lifetimeSummary.value.dailyNorm)
})

function pluralDays(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня'
  return 'дней'
}

onMounted(async () => {
  const { hasSeenTour, markTourSeen } = useOnboarding()
  if (await hasSeenTour('statistics')) return

  const steps: DriveStep[] = [
    {
      element: '[data-tour="stats-average"]',
      popover: {
        title: 'Обычный день',
        description: 'Среднее за всё время — с первого расхода до сегодня, не жёсткие 30 дней. Не зависит от периода ниже, это стабильный ориентир, сравнивается с нормой из настроек.',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '[data-tour="stats-exclude-days"]',
      popover: {
        title: 'Дни в среднем',
        description: 'Разовая крупная покупка искажает «обычный день» — снимите такой день здесь, и он перестанет учитываться в среднем.',
        side: 'bottom',
        align: 'end'
      }
    },
    {
      element: '[data-tour="stats-period"]',
      popover: {
        title: 'Период',
        description: 'Переключает сумму и диаграмму по копилкам ниже. По умолчанию — за сегодня, а «Свой период» открывает календарь с произвольными датами.',
        side: 'bottom',
        align: 'start'
      }
    }
  ]

  if (byJar.value?.length) {
    steps.push({
      element: '[data-tour="stats-by-jar"]',
      popover: {
        title: 'По копилкам',
        description: 'Цвета сегментов — те же, что у копилок на дашборде и доске.',
        side: 'top',
        align: 'start'
      }
    })
  }

  createTour(steps, () => markTourSeen('statistics')).drive()
})
</script>

<template>
  <UContainer class="py-8 space-y-8">
    <h1 class="text-2xl font-semibold">
      Статистика
    </h1>

    <!-- Zone 1: lifetime baseline — deliberately not period-scoped, see normDelta/lifetimeSummary. -->
    <UCard data-tour="stats-average">
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <h2 class="font-medium">
              Обычный день
            </h2>
            <span class="text-xs text-dimmed">за всё время</span>
          </div>
          <UButton
            data-tour="stats-exclude-days"
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-list-checks"
            @click="isExcludeDaysOpen = true"
          >
            Дни в среднем
          </UButton>
        </div>
      </template>
      <div class="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p class="text-muted text-sm">
            Среднее в день
          </p>
          <p class="text-3xl font-semibold tabular-nums">
            {{ formatMoney(lifetimeSummary?.averagePerDay ?? 0) }}
          </p>
        </div>
        <div
          v-if="lifetimeSummary?.dailyNorm"
          class="text-right"
        >
          <p class="text-muted text-sm">
            Норма — {{ formatMoney(lifetimeSummary.dailyNorm) }}
          </p>
          <UBadge
            :color="lifetimeSummary.overNorm ? 'error' : 'success'"
            variant="subtle"
          >
            {{ lifetimeSummary.overNorm ? `Превышение на ${formatMoney(normDelta ?? 0)}` : `Есть запас ${formatMoney(-(normDelta ?? 0))}` }}
          </UBadge>
        </div>
        <NuxtLink
          v-else
          to="/settings"
          class="text-sm text-primary shrink-0"
        >
          Задать норму →
        </NuxtLink>
      </div>
    </UCard>

    <!-- Zone 2: the period picker drives exactly these two things, nothing else. -->
    <div class="space-y-3">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h2 class="text-lg font-medium">
          За период
        </h2>
        <div
          data-tour="stats-period"
          class="flex gap-1 flex-wrap"
        >
          <UButton
            v-for="opt in visiblePresetOptions"
            :key="opt.value"
            :color="period === opt.value ? 'primary' : 'neutral'"
            :variant="period === opt.value ? 'solid' : 'ghost'"
            size="sm"
            @click="selectPreset(opt.value)"
          >
            {{ opt.label }}
          </UButton>
          <UPopover v-model:open="isRangePickerOpen">
            <UButton
              :color="period === 'custom' ? 'primary' : 'neutral'"
              :variant="period === 'custom' ? 'solid' : 'ghost'"
              icon="i-lucide-calendar-range"
              size="sm"
            >
              {{ customRangeLabel }}
            </UButton>
            <template #content>
              <!-- UCalendar's generic range/multiple prop typing doesn't resolve correctly through
                   vue-tsc's template checker here (known friction with reka-ui's bundled generic
                   types) — the runtime behavior is correct, only the prop type falls back to a
                   broader union, so the model-value is cast at this one boundary. -->
              <UCalendar
                :model-value="(customRange as any)"
                :range="true"
                :min-value="minValue"
                :max-value="todayValue"
                class="p-2"
                @update:model-value="onCustomRangeUpdate"
              />
            </template>
          </UPopover>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UCard
          data-tour="stats-total"
          class="flex flex-col justify-center"
        >
          <p class="text-muted text-sm">
            Потрачено
          </p>
          <p class="text-3xl font-semibold tabular-nums">
            {{ formatMoney(summary?.total ?? 0) }}
          </p>
          <p
            v-if="summary?.daysInRange"
            class="mt-1 text-xs text-dimmed"
          >
            за {{ summary.daysInRange }} {{ pluralDays(summary.daysInRange) }}
          </p>
        </UCard>

        <UCard
          v-if="byJar?.length"
          data-tour="stats-by-jar"
        >
          <template #header>
            <h3 class="text-sm font-medium">
              По копилкам
            </h3>
          </template>
          <div class="h-56">
            <Doughnut
              :data="byJarChartData"
              :options="chartOptions"
            />
          </div>
        </UCard>
        <UCard
          v-else
          class="flex items-center justify-center text-sm text-muted"
        >
          Нет расходов за этот период
        </UCard>
      </div>
    </div>

    <!-- Zone 3: trend, independent of the period picker — always the last 30 days. -->
    <UCard>
      <template #header>
        <h2 class="font-medium">
          Расходы по дням (последние 30 дней)
        </h2>
      </template>
      <div class="h-64">
        <Bar
          :data="dailyChartData"
          :options="chartOptions"
        />
      </div>
    </UCard>

    <UModal
      v-model:open="isExcludeDaysOpen"
      title="Дни в среднем"
      description="Снимите день — его сумма перестанет учитываться в «Обычном дне», если он выбивается из ряда (крупная разовая покупка и т.п.)."
    >
      <template #body>
        <div
          v-if="spentDays.length"
          class="space-y-1 max-h-96 overflow-y-auto"
        >
          <label
            v-for="d in spentDays"
            :key="d.date"
            class="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-elevated cursor-pointer"
          >
            <USwitch
              :model-value="!excludedDays.has(d.date)"
              :loading="togglingDay === d.date"
              size="sm"
              @update:model-value="(v: boolean) => toggleExcludedDay(d.date, v)"
            />
            <span
              class="flex-1 min-w-0 truncate text-sm"
              :class="{ 'text-dimmed line-through': excludedDays.has(d.date) }"
            >
              {{ formatDayLabel(d.date) }}
            </span>
            <span
              class="text-sm tabular-nums shrink-0"
              :class="excludedDays.has(d.date) ? 'text-dimmed' : ''"
            >
              {{ formatMoney(d.total) }}
            </span>
          </label>
        </div>
        <p
          v-else
          class="text-sm text-muted"
        >
          Пока нет дней с расходами за последние 30 дней.
        </p>
      </template>
    </UModal>
  </UContainer>
</template>
