<script setup lang="ts">
import type { Person } from '../components/ContactsManager.vue';

interface DebtAllocation {
  id: string;
  jarId: string;
  amount: string;
}
interface DebtRepayment {
  id: string;
  amount: string;
  forgiven: boolean;
  createdAt: string;
}
interface Debt {
  id: string;
  type: 'I_OWE' | 'OWED_TO_ME';
  amount: string;
  description: string | null;
  status: 'ACTIVE' | 'PARTIALLY_REPAID' | 'REPAID' | 'FORGIVEN';
  createdAt: string;
  person: Person;
  allocations: DebtAllocation[];
  repayments: DebtRepayment[];
}

const api = useApi();
const toast = useToast();
const jarsStore = useJarsStore();

const activeTab = ref<'I_OWE' | 'OWED_TO_ME'>('OWED_TO_ME');
const personFilter = ref<string>('all');
const showClosed = ref(false);

const { data: debts, refresh } = await useAsyncData('debts', () => api<Debt[]>('/debts'), {
  default: () => [] as Debt[],
});
const { data: people, refresh: refreshPeople } = await useAsyncData('debts-people', () => api<Person[]>('/people'), {
  default: () => [] as Person[],
});
await useAsyncData('debts-jars', () => jarsStore.fetchJars());

function onPersonCreated(person: Person) {
  people.value = [...(people.value ?? []), person];
}

const personFilterOptions = computed(() => [
  { label: 'Все контакты', value: 'all' },
  ...(people.value ?? []).map((p) => ({ label: p.name, value: p.id })),
]);

const tabDebts = computed(() => (debts.value ?? []).filter((d) => d.type === activeTab.value));
const closedCount = computed(
  () => tabDebts.value.filter((d) => d.status === 'REPAID' || d.status === 'FORGIVEN').length,
);
const filteredDebts = computed(() =>
  tabDebts.value
    .filter((d) => showClosed.value || (d.status !== 'REPAID' && d.status !== 'FORGIVEN'))
    .filter((d) => personFilter.value === 'all' || d.person.id === personFilter.value),
);

function remaining(debt: Debt) {
  const repaid = debt.repayments.filter((r) => !r.forgiven).reduce((sum, r) => sum + Number(r.amount), 0);
  return Number(debt.amount) - repaid;
}

const totalRemaining = computed(() =>
  filteredDebts.value
    .filter((d) => d.status === 'ACTIVE' || d.status === 'PARTIALLY_REPAID')
    .reduce((sum, d) => sum + remaining(d), 0),
);

const statusLabels: Record<Debt['status'], string> = {
  ACTIVE: 'Активен',
  PARTIALLY_REPAID: 'Частично',
  REPAID: 'Закрыт',
  FORGIVEN: 'Прощён',
};
const statusColors: Record<Debt['status'], 'warning' | 'info' | 'success' | 'neutral'> = {
  ACTIVE: 'warning',
  PARTIALLY_REPAID: 'info',
  REPAID: 'success',
  FORGIVEN: 'neutral',
};

const isCreateOpen = ref(false);
const isContactsOpen = ref(false);

const repayingDebt = ref<Debt | null>(null);
const isRepayOpen = computed({
  get: () => repayingDebt.value !== null,
  set: (v: boolean) => {
    if (!v) repayingDebt.value = null;
  },
});

const forgivingDebt = ref<Debt | null>(null);
const forgiveLoading = ref(false);

async function confirmForgive() {
  if (!forgivingDebt.value) return;
  forgiveLoading.value = true;
  try {
    await api(`/debts/${forgivingDebt.value.id}/repay`, { method: 'POST', body: { forgiven: true } });
    toast.add({ title: 'Долг прощён', color: 'neutral' });
    forgivingDebt.value = null;
    await refresh();
  } finally {
    forgiveLoading.value = false;
  }
}
</script>

<template>
  <UContainer class="py-8 space-y-6">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <h1 class="text-2xl font-semibold">Долги</h1>
      <div class="flex gap-2">
        <UButton icon="i-lucide-users" color="neutral" variant="subtle" @click="isContactsOpen = true">
          Контакты
        </UButton>
        <UButton icon="i-lucide-plus" @click="isCreateOpen = true">Добавить долг</UButton>
      </div>
    </div>

    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="flex gap-2">
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
        <label v-if="closedCount" class="flex items-center gap-1.5 text-sm text-muted shrink-0">
          <USwitch v-model="showClosed" size="sm" />
          Показывать закрытые ({{ closedCount }})
        </label>
        <USelect v-model="personFilter" :items="personFilterOptions" class="w-full sm:w-48" />
      </div>
    </div>

    <UCard>
      <div class="flex items-center justify-between flex-wrap gap-2">
        <span class="text-muted text-sm">{{ activeTab === 'OWED_TO_ME' ? 'Всего должны мне' : 'Всего должен я' }}</span>
        <span class="text-2xl font-semibold tabular-nums">{{ formatMoney(totalRemaining) }}</span>
      </div>
    </UCard>

    <div v-if="filteredDebts.length" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <UCard v-for="debt in filteredDebts" :key="debt.id">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="font-medium">{{ debt.person.name }}</h3>
            <p v-if="debt.description" class="text-sm text-muted truncate">{{ debt.description }}</p>
          </div>
          <UBadge :color="statusColors[debt.status]" variant="subtle">{{ statusLabels[debt.status] }}</UBadge>
        </div>

        <p class="text-2xl font-semibold mt-2 tabular-nums">{{ formatMoney(remaining(debt)) }}</p>
        <p v-if="remaining(debt) !== Number(debt.amount)" class="text-sm text-muted">
          из {{ formatMoney(debt.amount) }}
        </p>

        <div v-if="debt.status === 'ACTIVE' || debt.status === 'PARTIALLY_REPAID'" class="flex gap-2 mt-3">
          <UButton size="sm" @click="repayingDebt = debt">
            {{ debt.type === 'OWED_TO_ME' ? 'Вернули' : 'Погасить' }}
          </UButton>
          <UButton size="sm" color="neutral" variant="subtle" @click="forgivingDebt = debt">Простить</UButton>
        </div>
      </UCard>
    </div>
    <p v-else class="text-muted">Здесь пока пусто.</p>

    <UModal v-model:open="isCreateOpen" :title="activeTab === 'OWED_TO_ME' ? 'Дали в долг' : 'Взяли в долг'">
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

    <UModal v-model:open="isRepayOpen" title="Долг">
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

    <UModal v-model:open="isContactsOpen" title="Контакты">
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

    <UModal :open="forgivingDebt !== null" title="Простить долг?" @update:open="(v) => !v && (forgivingDebt = null)">
      <template #body>
        <div v-if="forgivingDebt" class="space-y-4">
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
            <UButton color="neutral" variant="subtle" block @click="forgivingDebt = null">Отмена</UButton>
            <UButton color="error" block :loading="forgiveLoading" @click="confirmForgive">Простить</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
