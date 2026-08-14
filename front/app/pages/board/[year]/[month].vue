<script setup lang="ts">
import { CalendarDate, type DateValue } from '@internationalized/date'
import type { DriveStep } from 'driver.js'
import type { ExpenseCard } from '../../../components/KanbanColumn.vue'

interface DayData {
  id: string
  date: string
  expenses: ExpenseCard[]
}
interface BoardResponse {
  year: number
  month: number
  days: DayData[]
}

const route = useRoute()
const router = useRouter()
const jarsStore = useJarsStore()
const api = useApi()

const year = computed(() => Number(route.params.year))
const month = computed(() => Number(route.params.month))

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// Calendar dates are treated as timezone-less "yyyy-mm-dd" values, matching how the
// backend stores Day.date (UTC midnight of the given calendar date) — never derive them
// via local-timezone Date math, or they can drift a day off from the server's value.
function toISODate(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`
}

const today = new Date()
const isCurrentMonth = computed(() => year.value === today.getFullYear() && month.value === today.getMonth() + 1)

const daysInMonth = computed(() => new Date(year.value, month.value, 0).getDate())
// A day picked in a different month (via the calendar modal) travels here as ?day=N, since
// navigating to /board/{year}/{month} remounts this page and would otherwise reset the selection.
const dayFromQuery = Number(route.query.day)
const selectedDay = ref(dayFromQuery > 0 && dayFromQuery <= daysInMonth.value ? dayFromQuery : isCurrentMonth.value ? today.getDate() : 1)

const selectedDate = computed(() => toISODate(year.value, month.value, selectedDay.value))

const board = ref<BoardResponse | null>(null)

async function loadBoard() {
  board.value = await api<BoardResponse>('/board', { query: { year: year.value, month: month.value } })
}

async function refreshAll() {
  await Promise.all([loadBoard(), jarsStore.fetchJars()])
  return true
}

await useAsyncData(`board-${year.value}-${month.value}`, refreshAll)

const selectedDayData = computed(() => board.value?.days.find(d => d.date.slice(0, 10) === selectedDate.value))

const columnsData = computed(() => {
  const map: Record<string, ExpenseCard[]> = {}
  for (const jar of jarsStore.spendingJars) map[jar.id] = []
  for (const exp of selectedDayData.value?.expenses ?? []) {
    (map[exp.jarId] ??= []).push(exp)
  }
  return map
})

function goToMonth(deltaMonths: number) {
  const d = new Date(year.value, month.value - 1 + deltaMonths, 1)
  router.push(`/board/${d.getFullYear()}/${d.getMonth() + 1}`)
}

const monthLabel = computed(() =>
  new Date(year.value, month.value - 1, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
)

const isDatePickerOpen = ref(false)
const datePickerValue = computed<DateValue>(() => new CalendarDate(year.value, month.value, selectedDay.value))

function onDatePicked(value: DateValue | undefined) {
  if (!value) return
  isDatePickerOpen.value = false
  if (value.year === year.value && value.month === month.value) {
    selectedDay.value = value.day
  } else {
    router.push({ path: `/board/${value.year}/${value.month}`, query: { day: value.day } })
  }
}

onMounted(async () => {
  const { hasSeenTour, markTourSeen } = useOnboarding()
  if (!jarsStore.spendingJars.length || (await hasSeenTour('board'))) return

  const hasCards = Object.values(columnsData.value).some(cards => cards.length)

  const steps: DriveStep[] = [
    {
      element: '[data-tour="board-days"]',
      popover: {
        title: 'Дни месяца',
        description: 'У каждого дня — своя доска расходов. Переключайтесь датами здесь.',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '[data-tour="board-date-picker-btn"]',
      popover: {
        title: 'Календарь',
        description: 'Быстрый переход на любую дату, в том числе в другом месяце.',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '[data-tour="board-column"]',
      popover: {
        title: 'Колонка = копилка',
        description: 'Колонка — это расходная копилка. Карточки внутри — расходы, списанные с неё за выбранный день.',
        side: 'right',
        align: 'start'
      }
    }
  ]

  if (hasCards) {
    steps.push({
      element: '[data-tour="board-card"]',
      popover: {
        title: 'Перенос между копилками',
        description: 'Перетащите карточку в другую колонку — расход спишется со старой копилки и запишется на новую, одним действием.',
        side: 'right',
        align: 'start'
      }
    })
  }

  steps.push({
    element: '[data-tour="board-add-btn"]',
    popover: {
      title: 'Новый расход',
      description: 'Сумма сразу спишется с этой копилки за выбранный день.',
      side: 'top',
      align: 'start'
    }
  })

  createTour(steps, () => markTourSeen('board')).drive()
})
</script>

<template>
  <UContainer class="py-8 space-y-6">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <h1 class="text-2xl font-semibold capitalize">
        {{ monthLabel }}
      </h1>
      <div class="flex gap-2">
        <UPopover v-model:open="isDatePickerOpen">
          <UButton
            data-tour="board-date-picker-btn"
            icon="i-lucide-calendar-days"
            color="neutral"
            variant="ghost"
          />
          <template #content>
            <!-- Same known reka-ui/vue-tsc generic-prop typing gap as the statistics custom-range
                 picker — runtime is correct (single-date mode), only the prop type is too broad. -->
            <UCalendar
              :model-value="(datePickerValue as any)"
              class="p-2"
              @update:model-value="(v: any) => onDatePicked(v)"
            />
          </template>
        </UPopover>
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="ghost"
          @click="goToMonth(-1)"
        />
        <UButton
          icon="i-lucide-chevron-right"
          color="neutral"
          variant="ghost"
          @click="goToMonth(1)"
        />
      </div>
    </div>

    <div
      data-tour="board-days"
      class="flex gap-1 overflow-x-auto pb-2"
    >
      <UButton
        v-for="day in daysInMonth"
        :key="day"
        :color="day === selectedDay ? 'primary' : 'neutral'"
        :variant="day === selectedDay ? 'solid' : 'ghost'"
        size="sm"
        class="shrink-0"
        @click="selectedDay = day"
      >
        {{ day }}
      </UButton>
    </div>

    <p
      v-if="!jarsStore.spendingJars.length"
      class="text-muted"
    >
      Сначала создайте расходную копилку на странице <NuxtLink
        to="/jars"
        class="text-primary"
      >Копилки</NuxtLink>.
    </p>

    <div
      v-else
      class="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory sm:snap-none -mx-4 px-4 sm:mx-0 sm:px-0"
    >
      <KanbanColumn
        v-for="jar in jarsStore.spendingJars"
        :key="jar.id"
        :jar="jar"
        :cards="columnsData[jar.id] ?? []"
        :date="selectedDate"
        class="snap-start"
        @changed="refreshAll"
      />
    </div>
  </UContainer>
</template>
