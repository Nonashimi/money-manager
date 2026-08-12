<script setup lang="ts">
import * as z from 'zod';
import type { FormSubmitEvent } from '@nuxt/ui';

interface Person {
  id: string;
  name: string;
}

const props = defineProps<{ type: 'I_OWE' | 'OWED_TO_ME'; people: Person[] }>();
const emit = defineEmits<{ created: []; personCreated: [person: Person] }>();

const jarsStore = useJarsStore();
const api = useApi();
const toast = useToast();

// Multiple contacts at once only makes sense for "мне должны" — e.g. you paid a bill and
// want to split the reimbursement across several friends in one go.
const isBulk = computed(() => props.type === 'OWED_TO_ME');

const schema = z.object({
  personId: z.string().optional(),
  personIds: z.array(z.string()).optional(),
  amount: z.number().positive('Введите сумму'),
  description: z.string().optional(),
});
type Schema = z.output<typeof schema>;

const state = reactive<Partial<Schema>>({
  personId: undefined,
  personIds: [],
  amount: undefined,
  description: undefined,
});

const personOptions = computed(() => props.people.map((p) => ({ label: p.name, value: p.id })));

// Inline "new contact" — avoids leaving the debt form to add someone first.
const isAddingPerson = ref(false);
const newPersonName = ref('');
const creatingPerson = ref(false);

async function createPersonInline() {
  if (!newPersonName.value.trim()) return;
  creatingPerson.value = true;
  try {
    const person = await api<Person>('/people', { method: 'POST', body: { name: newPersonName.value.trim() } });
    emit('personCreated', person);
    if (isBulk.value) {
      state.personIds = [...(state.personIds ?? []), person.id];
    } else {
      state.personId = person.id;
    }
    newPersonName.value = '';
    isAddingPerson.value = false;
  } finally {
    creatingPerson.value = false;
  }
}

const selectedCount = computed(() => (isBulk.value ? (state.personIds?.length ?? 0) : state.personId ? 1 : 0));
// In bulk mode `amount` is "per person" — the jar allocation below covers the combined total.
const totalAmount = computed(() => (isBulk.value ? (state.amount ?? 0) * selectedCount.value : (state.amount ?? 0)));
const isPersonSelected = computed(() => selectedCount.value > 0);

const jarAmounts = reactive<Record<string, number>>({});
const allocatedTotal = computed(() =>
  jarsStore.spendingJars.reduce((sum, jar) => sum + (jarAmounts[jar.id] ?? 0), 0),
);
const isAllocationValid = computed(
  () => totalAmount.value > 0 && Math.abs(allocatedTotal.value - totalAmount.value) < 0.01,
);
const canSubmit = computed(() => isAllocationValid.value && isPersonSelected.value);

function distributeEvenly() {
  if (!totalAmount.value || !jarsStore.spendingJars.length) return;
  const share = Math.floor((totalAmount.value / jarsStore.spendingJars.length) * 100) / 100;
  let allocated = 0;
  jarsStore.spendingJars.forEach((jar, index) => {
    const isLast = index === jarsStore.spendingJars.length - 1;
    const value = isLast ? Math.round((totalAmount.value - allocated) * 100) / 100 : share;
    jarAmounts[jar.id] = value;
    allocated += value;
  });
}

const loading = ref(false);

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (!canSubmit.value) return;
  loading.value = true;
  try {
    const allocations = jarsStore.spendingJars
      .filter((jar) => (jarAmounts[jar.id] ?? 0) > 0)
      .map((jar) => ({ jarId: jar.id, amount: jarAmounts[jar.id] }));

    if (isBulk.value) {
      const entries = (state.personIds ?? []).map((personId) => ({ personId, amount: event.data.amount }));
      await api('/debts/bulk', {
        method: 'POST',
        body: { entries, description: event.data.description, allocations },
      });
    } else {
      await api('/debts', {
        method: 'POST',
        body: {
          personId: event.data.personId,
          amount: event.data.amount,
          description: event.data.description,
          type: props.type,
          allocations,
        },
      });
    }

    await jarsStore.fetchJars();
    toast.add({ title: 'Долг добавлен', color: 'success' });
    emit('created');
  } catch (error: any) {
    toast.add({ title: 'Не удалось добавить долг', description: error?.data?.message, color: 'error' });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
    <UFormField :label="isBulk ? 'Контакты' : 'Человек'" name="personId">
      <div class="flex gap-2">
        <USelect
          v-if="isBulk"
          v-model="state.personIds"
          multiple
          :items="personOptions"
          placeholder="Выберите контакты"
          class="w-full"
        />
        <USelect
          v-else
          v-model="state.personId"
          :items="personOptions"
          placeholder="Выберите контакт"
          class="w-full"
        />
        <UButton
          icon="i-lucide-user-plus"
          color="neutral"
          variant="subtle"
          aria-label="Новый контакт"
          @click="isAddingPerson = !isAddingPerson"
        />
      </div>
      <div v-if="isAddingPerson" class="flex gap-2 mt-2">
        <UInput
          v-model="newPersonName"
          placeholder="Имя нового контакта"
          class="w-full"
          @keyup.enter="createPersonInline"
        />
        <UButton :loading="creatingPerson" @click="createPersonInline">Добавить</UButton>
      </div>
    </UFormField>

    <UFormField :label="isBulk ? 'Сумма с каждого' : 'Сумма'" name="amount">
      <MoneyInput v-model="state.amount" :min="0" class="w-full" />
      <p v-if="isBulk && selectedCount > 1" class="text-sm text-muted mt-1">
        Итого: {{ formatMoney(totalAmount) }} на {{ selectedCount }} человек
      </p>
    </UFormField>

    <UFormField label="Описание" name="description">
      <UInput v-model="state.description" class="w-full" />
    </UFormField>

    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <p class="text-sm font-medium">
          {{ type === 'OWED_TO_ME' ? 'Из каких копилок дали' : 'Из каких копилок планируете погасить' }}
        </p>
        <UButton size="xs" color="neutral" variant="ghost" :disabled="!totalAmount" @click="distributeEvenly">
          Поровну
        </UButton>
      </div>
      <p v-if="!jarsStore.spendingJars.length" class="text-sm text-muted">
        Сначала создайте копилку на странице «Копилки».
      </p>
      <div v-for="jar in jarsStore.spendingJars" :key="jar.id" class="flex items-center gap-3">
        <span class="flex-1 min-w-0 truncate text-sm">{{ jar.name }}</span>
        <MoneyInput v-model="jarAmounts[jar.id]" :min="0" size="sm" class="w-28 shrink-0" />
      </div>
      <p :class="isAllocationValid ? 'text-muted' : 'text-error'" class="text-sm">
        Распределено: {{ formatMoney(allocatedTotal) }} из {{ formatMoney(totalAmount) }}
      </p>
    </div>

    <UButton type="submit" block :loading="loading" :disabled="!canSubmit">Сохранить</UButton>
  </UForm>
</template>
