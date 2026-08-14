<script setup lang="ts">
import type { DriveStep } from 'driver.js'

interface HistoryAction {
  id: string
  type: string
  summary: string
  undone: boolean
  createdAt: string
}
interface HistoryPage {
  items: HistoryAction[]
  total: number
  page: number
  pageSize: number
}

interface TypeMeta {
  label: string
  icon: string
  badgeClass: string
}

const TYPE_META: Record<string, TypeMeta> = {
  INCOME_CREATE: { label: 'Доход', icon: 'i-lucide-arrow-down-to-line', badgeClass: 'bg-emerald-500/15 text-emerald-400' },
  EXPENSE_CREATE: { label: 'Расход', icon: 'i-lucide-shopping-cart', badgeClass: 'bg-rose-500/15 text-rose-400' },
  EXPENSE_UPDATE: { label: 'Изменение расхода', icon: 'i-lucide-pencil', badgeClass: 'bg-amber-500/15 text-amber-400' },
  EXPENSE_DELETE: { label: 'Удаление расхода', icon: 'i-lucide-trash-2', badgeClass: 'bg-slate-500/15 text-slate-400' },
  TRANSFER_CREATE: { label: 'Перелив', icon: 'i-lucide-arrow-left-right', badgeClass: 'bg-sky-500/15 text-sky-400' },
  DEBT_CREATE: { label: 'Новый долг', icon: 'i-lucide-handshake', badgeClass: 'bg-indigo-500/15 text-indigo-400' },
  DEBT_CREATE_BULK: { label: 'Долги нескольким', icon: 'i-lucide-users', badgeClass: 'bg-indigo-500/15 text-indigo-400' },
  DEBT_REPAY: { label: 'Погашение долга', icon: 'i-lucide-badge-check', badgeClass: 'bg-teal-500/15 text-teal-400' },
  DEBT_FORGIVE: { label: 'Прощённый долг', icon: 'i-lucide-heart-handshake', badgeClass: 'bg-violet-500/15 text-violet-400' }
}
const DEFAULT_META: TypeMeta = { label: 'Действие', icon: 'i-lucide-circle', badgeClass: 'bg-neutral-500/15 text-neutral-400' }

function metaFor(type: string) {
  return TYPE_META[type] ?? DEFAULT_META
}

const api = useApi()
const toast = useToast()
const jarsStore = useJarsStore()

const PAGE_SIZE = 20
const page = ref(1)
const selectedTypes = ref<Set<string>>(new Set())
const showUndone = ref(true)
const isFiltersOpen = ref(false)

const { data: availableTypes } = await useAsyncData('history-types', () => api<string[]>('/history/types'), {
  default: () => [] as string[]
})

const queryParams = computed(() => ({
  page: page.value,
  pageSize: PAGE_SIZE,
  ...(selectedTypes.value.size > 0 ? { types: Array.from(selectedTypes.value) } : {}),
  ...(showUndone.value ? {} : { includeUndone: false })
}))

const { data: historyPage, refresh } = await useAsyncData(
  'history',
  () => api<HistoryPage>('/history', { query: queryParams.value }),
  { watch: [queryParams] }
)

const actions = computed(() => historyPage.value?.items ?? [])
const total = computed(() => historyPage.value?.total ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const activeFilterCount = computed(() => selectedTypes.value.size + (showUndone.value ? 0 : 1))

// Reset to page 1 whenever the filter set changes, or a stale page (e.g. "page 3" after a filter
// shrinks the result set to one page) would silently render nothing.
watch([selectedTypes, showUndone], () => {
  page.value = 1
}, { deep: true })

function toggleType(type: string) {
  const next = new Set(selectedTypes.value)
  if (next.has(type)) {
    next.delete(type)
  } else {
    next.add(type)
  }
  selectedTypes.value = next
}

function resetFilters() {
  selectedTypes.value = new Set()
  showUndone.value = true
}

// The undo button only makes sense against the very latest action overall, not just this page —
// so it needs its own small unpaginated/unfiltered peek at page 1, independent of the filtered list.
const { data: latestPage } = await useAsyncData('history-latest', () => api<HistoryPage>('/history', { query: { page: 1, pageSize: 1 } }))
const lastUndoable = computed(() => {
  const first = latestPage.value?.items[0]
  return first && !first.undone ? first : undefined
})

const undoing = ref(false)

async function undoLast() {
  undoing.value = true
  try {
    await api('/history/undo', { method: 'POST' })
    await Promise.all([refresh(), jarsStore.fetchJars()])
    latestPage.value = await api<HistoryPage>('/history', { query: { page: 1, pageSize: 1 } })
    toast.add({ title: 'Действие отменено', color: 'success' })
  } catch (error: any) {
    toast.add({ title: 'Не удалось отменить', description: error?.data?.message, color: 'error' })
  } finally {
    undoing.value = false
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU')
}

onMounted(async () => {
  const { hasSeenTour, markTourSeen } = useOnboarding()
  if (await hasSeenTour('history')) return

  const steps: DriveStep[] = []

  if (lastUndoable.value) {
    steps.push({
      element: '[data-tour="history-undo-btn"]',
      popover: {
        title: 'Отменить последнее действие',
        description: 'Откатывает только самую последнюю операцию — не любую из списка. Чтобы вернуть более раннюю, сначала отмените всё, что случилось после неё.',
        side: 'bottom',
        align: 'end'
      }
    })
  }

  steps.push({
    element: '[data-tour="history-filters-btn"]',
    popover: {
      title: 'Фильтры',
      description: 'Тип действия и отменённые записи — настраиваются здесь, чтобы не загромождать список.',
      side: 'bottom',
      align: 'end'
    }
  })

  createTour(steps, () => markTourSeen('history')).drive()
})
</script>

<template>
  <UContainer class="py-8 space-y-6">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <h1 class="text-2xl font-semibold">
        История
      </h1>
      <div class="flex gap-2">
        <UButton
          v-if="lastUndoable"
          data-tour="history-undo-btn"
          icon="i-lucide-undo-2"
          color="neutral"
          variant="subtle"
          :loading="undoing"
          @click="undoLast"
        >
          Отменить последнее действие
        </UButton>
        <UButton
          data-tour="history-filters-btn"
          icon="i-lucide-list-filter"
          color="neutral"
          variant="subtle"
          @click="isFiltersOpen = true"
        >
          Фильтры
          <UBadge
            v-if="activeFilterCount"
            color="primary"
            variant="subtle"
            size="sm"
          >
            {{ activeFilterCount }}
          </UBadge>
        </UButton>
      </div>
    </div>

    <div
      v-if="actions.length"
      class="space-y-2"
    >
      <div
        v-for="action in actions"
        :key="action.id"
        class="flex items-center gap-3 rounded-lg border border-default px-4 py-3"
        :class="{ 'opacity-50': action.undone }"
      >
        <div
          class="flex size-8 items-center justify-center rounded-full shrink-0"
          :class="metaFor(action.type).badgeClass"
        >
          <UIcon
            :name="metaFor(action.type).icon"
            class="size-4"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p>{{ action.summary }}</p>
          <p class="text-sm text-muted">
            {{ formatDate(action.createdAt) }}
          </p>
        </div>
        <UBadge
          v-if="action.undone"
          color="neutral"
          variant="subtle"
        >
          Отменено
        </UBadge>
      </div>
    </div>
    <p
      v-else
      class="text-muted"
    >
      Ничего не найдено.
    </p>

    <div
      v-if="totalPages > 1"
      class="flex items-center justify-center"
    >
      <UPagination
        v-model:page="page"
        :total="total"
        :items-per-page="PAGE_SIZE"
      />
    </div>

    <UModal
      v-model:open="isFiltersOpen"
      title="Фильтры"
    >
      <template #body>
        <div class="space-y-5">
          <div v-if="availableTypes.length">
            <p class="text-sm font-medium mb-2">
              Тип действия
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="type in availableTypes"
                :key="type"
                class="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-opacity"
                :class="[metaFor(type).badgeClass, selectedTypes.size > 0 && !selectedTypes.has(type) ? 'opacity-40' : '']"
                @click="toggleType(type)"
              >
                <UIcon
                  :name="metaFor(type).icon"
                  class="size-3.5"
                />
                {{ metaFor(type).label }}
              </button>
            </div>
          </div>

          <label class="flex items-center gap-2 text-sm">
            <USwitch
              v-model="showUndone"
              size="sm"
            />
            Показывать отменённые
          </label>

          <div class="flex gap-2">
            <UButton
              color="neutral"
              variant="subtle"
              block
              @click="resetFilters"
            >
              Сбросить всё
            </UButton>
            <UButton
              block
              @click="isFiltersOpen = false"
            >
              Готово
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
