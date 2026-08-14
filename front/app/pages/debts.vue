<script setup lang="ts">
import type { DriveStep } from 'driver.js'
import type { Person } from '../components/ContactsManager.vue'

interface DebtAllocation {
  id: string
  jarId: string
  amount: string
}
interface DebtRepayment {
  id: string
  amount: string
  forgiven: boolean
  createdAt: string
}
interface Debt {
  id: string
  type: 'I_OWE' | 'OWED_TO_ME'
  amount: string
  description: string | null
  status: 'ACTIVE' | 'PARTIALLY_REPAID' | 'REPAID' | 'FORGIVEN'
  createdAt: string
  person: Person
  allocations: DebtAllocation[]
  repayments: DebtRepayment[]
}

const api = useApi()
const toast = useToast()
const jarsStore = useJarsStore()

const activeTab = ref<'I_OWE' | 'OWED_TO_ME'>('OWED_TO_ME')
const personFilter = ref<string>('all')
const showClosed = ref(false)

const { data: debts, refresh } = await useAsyncData('debts', () => api<Debt[]>('/debts'), {
  default: () => [] as Debt[]
})
const { data: people, refresh: refreshPeople } = await useAsyncData('debts-people', () => api<Person[]>('/people'), {
  default: () => [] as Person[]
})
await useAsyncData('debts-jars', () => jarsStore.fetchJars())

function onPersonCreated(person: Person) {
  people.value = [...(people.value ?? []), person]
}

const personFilterOptions = computed(() => [
  { label: 'Все контакты', value: 'all' },
  ...(people.value ?? []).map(p => ({ label: p.name, value: p.id }))
])

const tabDebts = computed(() => (debts.value ?? []).filter(d => d.type === activeTab.value))
const closedCount = computed(
  () => tabDebts.value.filter(d => d.status === 'REPAID' || d.status === 'FORGIVEN').length
)
const filteredDebts = computed(() =>
  tabDebts.value
    .filter(d => showClosed.value || (d.status !== 'REPAID' && d.status !== 'FORGIVEN'))
    .filter(d => personFilter.value === 'all' || d.person.id === personFilter.value)
)

function remaining(debt: Debt) {
  const repaid = debt.repayments.filter(r => !r.forgiven).reduce((sum, r) => sum + Number(r.amount), 0)
  return Number(debt.amount) - repaid
}

const totalRemaining = computed(() =>
  filteredDebts.value
    .filter(d => d.status === 'ACTIVE' || d.status === 'PARTIALLY_REPAID')
    .reduce((sum, d) => sum + remaining(d), 0)
)

const statusLabels: Record<Debt['status'], string> = {
  ACTIVE: 'Активен',
  PARTIALLY_REPAID: 'Частично',
  REPAID: 'Закрыт',
  FORGIVEN: 'Прощён'
}
const statusColors: Record<Debt['status'], 'warning' | 'info' | 'success' | 'neutral'> = {
  ACTIVE: 'warning',
  PARTIALLY_REPAID: 'info',
  REPAID: 'success',
  FORGIVEN: 'neutral'
}

const isCreateOpen = ref(false)
const isContactsOpen = ref(false)

const repayingDebt = ref<Debt | null>(null)
const isRepayOpen = computed({
  get: () => repayingDebt.value !== null,
  set: (v: boolean) => {
    if (!v) repayingDebt.value = null
  }
})

const forgivingDebt = ref<Debt | null>(null)
const forgiveLoading = ref(false)

const detailsDebt = ref<Debt | null>(null)
const isDetailsOpen = computed({
  get: () => detailsDebt.value !== null,
  set: (v: boolean) => {
    if (!v) detailsDebt.value = null
  }
})

function jarName(jarId: string) {
  return jarsStore.jars.find(j => j.id === jarId)?.name ?? 'Копилка'
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ru-RU')
}

async function confirmForgive() {
  if (!forgivingDebt.value) return
  forgiveLoading.value = true
  try {
    await api(`/debts/${forgivingDebt.value.id}/repay`, { method: 'POST', body: { forgiven: true } })
    toast.add({ title: 'Долг прощён', color: 'neutral' })
    forgivingDebt.value = null
    await refresh()
  } finally {
    forgiveLoading.value = false
  }
}

onMounted(async () => {
  const { hasSeenTour, markTourSeen } = useOnboarding()
  if (await hasSeenTour('debts')) return

  const steps: DriveStep[] = [
    {
      element: '[data-tour="debts-tabs"]',
      popover: {
        title: 'Два разных долга',
        description: '«Мне должны» — деньги списываются с копилок сразу, при создании. «Я должен» — это только план, списание произойдёт лишь при погашении.',
        side: 'bottom',
        align: 'start'
      }
    }
  ]

  if (closedCount.value) {
    steps.push({
      element: '[data-tour="debts-show-closed"]',
      popover: {
        title: 'Закрытые долги',
        description: 'Возвращённые и прощённые долги скрыты по умолчанию — включите здесь, чтобы их увидеть.',
        side: 'bottom',
        align: 'start'
      }
    })
  }

  steps.push(
    {
      element: '[data-tour="debts-add-btn"]',
      popover: {
        title: 'Новый долг',
        description: 'Выберите тип, контакт (или несколько, для «мне должны») и копилки — только расходные.',
        side: 'bottom',
        align: 'end'
      }
    },
    {
      element: '[data-tour="debts-contacts-btn"]',
      popover: {
        title: 'Контакты',
        description: 'Люди, с которыми связаны долги — добавляются и здесь, и прямо в форме создания долга.',
        side: 'bottom',
        align: 'end'
      }
    }
  )

  createTour(steps, () => markTourSeen('debts')).drive()
})
</script>

<template>
  <UContainer class="py-8 space-y-6">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <h1 class="text-2xl font-semibold">
        Долги
      </h1>
      <div class="flex gap-2">
        <UButton
          data-tour="debts-contacts-btn"
          icon="i-lucide-users"
          color="neutral"
          variant="subtle"
          @click="isContactsOpen = true"
        >
          Контакты
        </UButton>
        <UButton
          data-tour="debts-add-btn"
          icon="i-lucide-plus"
          @click="isCreateOpen = true"
        >
          Добавить долг
        </UButton>
      </div>
    </div>

    <div class="flex items-center justify-between flex-wrap gap-3">
      <div
        data-tour="debts-tabs"
        class="flex gap-2"
      >
        <UButton
          :color="activeTab === 'OWED_TO_ME' ? 'primary' : 'neutral'"
          :variant="activeTab === 'OWED_TO_ME' ? 'solid' : 'ghost'"
          @click="activeTab = 'OWED_TO_ME'"
        >
          Мне должны
        </UButton>
        <UButton
          :color="activeTab === 'I_OWE' ? 'primary' : 'neutral'"
          :variant="activeTab === 'I_OWE' ? 'solid' : 'ghost'"
          @click="activeTab = 'I_OWE'"
        >
          Я должен
        </UButton>
      </div>

      <div class="flex items-center gap-4 flex-wrap">
        <label
          v-if="closedCount"
          data-tour="debts-show-closed"
          class="flex items-center gap-1.5 text-sm text-muted shrink-0"
        >
          <USwitch
            v-model="showClosed"
            size="sm"
          />
          Показывать закрытые ({{ closedCount }})
        </label>
        <USelect
          v-model="personFilter"
          :items="personFilterOptions"
          class="w-full sm:w-48"
        />
      </div>
    </div>

    <UCard>
      <div class="flex items-center justify-between flex-wrap gap-2">
        <span class="text-muted text-sm">{{ activeTab === 'OWED_TO_ME' ? 'Всего должны мне' : 'Всего должен я' }}</span>
        <span class="text-2xl font-semibold tabular-nums">{{ formatMoney(totalRemaining) }}</span>
      </div>
    </UCard>

    <div
      v-if="filteredDebts.length"
      class="grid grid-cols-1 sm:grid-cols-2 gap-4"
    >
      <UCard
        v-for="debt in filteredDebts"
        :key="debt.id"
      >
        <div
          class="cursor-pointer"
          @click="detailsDebt = debt"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <h3 class="font-medium">
                {{ debt.person.name }}
              </h3>
              <p
                v-if="debt.description"
                class="text-sm text-muted truncate"
              >
                {{ debt.description }}
              </p>
            </div>
            <UBadge
              :color="statusColors[debt.status]"
              variant="subtle"
            >
              {{ statusLabels[debt.status] }}
            </UBadge>
          </div>

          <p class="text-2xl font-semibold mt-2 tabular-nums">
            {{ formatMoney(remaining(debt)) }}
          </p>
          <p
            v-if="remaining(debt) !== Number(debt.amount)"
            class="text-sm text-muted"
          >
            из {{ formatMoney(debt.amount) }}
          </p>
        </div>

        <div
          v-if="debt.status === 'ACTIVE' || debt.status === 'PARTIALLY_REPAID'"
          class="flex gap-2 mt-3"
        >
          <UButton
            size="sm"
            @click.stop="repayingDebt = debt"
          >
            {{ debt.type === 'OWED_TO_ME' ? 'Вернули' : 'Погасить' }}
          </UButton>
          <UButton
            size="sm"
            color="neutral"
            variant="subtle"
            @click.stop="forgivingDebt = debt"
          >
            Простить
          </UButton>
        </div>
      </UCard>
    </div>
    <p
      v-else
      class="text-muted"
    >
      Здесь пока пусто.
    </p>

    <UModal
      v-model:open="isCreateOpen"
      :title="activeTab === 'OWED_TO_ME' ? 'Дали в долг' : 'Взяли в долг'"
    >
      <template #body>
        <DebtCreateForm
          :type="activeTab"
          :people="people ?? []"
          @person-created="onPersonCreated"
          @created="
            isCreateOpen = false;
            refresh();
          "
        />
      </template>
    </UModal>

    <UModal
      v-model:open="isRepayOpen"
      title="Долг"
    >
      <template #body>
        <DebtRepayForm
          v-if="repayingDebt"
          :debt-id="repayingDebt.id"
          :remaining="remaining(repayingDebt)"
          @done="
            repayingDebt = null;
            refresh();
          "
        />
      </template>
    </UModal>

    <UModal
      v-model:open="isContactsOpen"
      title="Контакты"
    >
      <template #body>
        <ContactsManager
          :people="people ?? []"
          @changed="
            refreshPeople();
            refresh();
          "
        />
      </template>
    </UModal>

    <UModal
      :open="forgivingDebt !== null"
      title="Простить долг?"
      @update:open="(v) => !v && (forgivingDebt = null)"
    >
      <template #body>
        <div
          v-if="forgivingDebt"
          class="space-y-4"
        >
          <p class="text-muted">
            Остаток {{ formatMoney(remaining(forgivingDebt)) }} для «{{ forgivingDebt.person.name }}» будет закрыт.
            {{
              forgivingDebt.type === 'OWED_TO_ME'
                ? 'Деньги в копилки не вернутся.'
                : 'Оплата не потребуется.'
            }}
            Действие можно отменить в истории.
          </p>
          <div class="flex gap-2">
            <UButton
              color="neutral"
              variant="subtle"
              block
              @click="forgivingDebt = null"
            >
              Отмена
            </UButton>
            <UButton
              color="error"
              block
              :loading="forgiveLoading"
              @click="confirmForgive"
            >
              Простить
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isDetailsOpen"
      :title="detailsDebt?.person.name"
    >
      <template #body>
        <div
          v-if="detailsDebt"
          class="space-y-5"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="text-muted text-sm">
                {{ detailsDebt.type === 'OWED_TO_ME' ? 'Мне должны' : 'Я должен' }}
              </p>
              <p class="text-2xl font-semibold tabular-nums mt-1">
                {{ formatMoney(remaining(detailsDebt)) }}
                <span
                  v-if="remaining(detailsDebt) !== Number(detailsDebt.amount)"
                  class="text-base font-normal text-muted"
                >
                  из {{ formatMoney(detailsDebt.amount) }}
                </span>
              </p>
            </div>
            <UBadge
              :color="statusColors[detailsDebt.status]"
              variant="subtle"
            >
              {{ statusLabels[detailsDebt.status] }}
            </UBadge>
          </div>

          <p
            v-if="detailsDebt.description"
            class="text-sm whitespace-pre-wrap break-words"
          >
            {{ detailsDebt.description }}
          </p>

          <div>
            <p class="text-sm font-medium mb-2">
              {{ detailsDebt.type === 'OWED_TO_ME' ? 'Списано из копилок' : 'План списания с копилок' }}
            </p>
            <div class="space-y-1">
              <div
                v-for="a in detailsDebt.allocations"
                :key="a.id"
                class="flex items-center justify-between text-sm"
              >
                <span class="text-muted">{{ jarName(a.jarId) }}</span>
                <span class="tabular-nums">{{ formatMoney(a.amount) }}</span>
              </div>
            </div>
          </div>

          <div v-if="detailsDebt.repayments.length">
            <p class="text-sm font-medium mb-2">
              История платежей
            </p>
            <div class="space-y-2">
              <div
                v-for="r in detailsDebt.repayments"
                :key="r.id"
                class="flex items-center justify-between text-sm border-b border-default pb-2 last:border-0 last:pb-0"
              >
                <div>
                  <p>{{ r.forgiven ? 'Прощено' : (detailsDebt.type === 'OWED_TO_ME' ? 'Вернули' : 'Погасили') }}</p>
                  <p class="text-xs text-dimmed">
                    {{ formatDateTime(r.createdAt) }}
                  </p>
                </div>
                <span class="tabular-nums">{{ formatMoney(r.amount) }}</span>
              </div>
            </div>
          </div>

          <p class="text-xs text-dimmed">
            Создан {{ formatDateTime(detailsDebt.createdAt) }}
          </p>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
