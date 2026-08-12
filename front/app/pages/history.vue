<script setup lang="ts">
interface HistoryAction {
  id: string;
  type: string;
  summary: string;
  undone: boolean;
  createdAt: string;
}

interface TypeMeta {
  label: string;
  icon: string;
  badgeClass: string;
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
  DEBT_FORGIVE: { label: 'Прощённый долг', icon: 'i-lucide-heart-handshake', badgeClass: 'bg-violet-500/15 text-violet-400' },
};
const DEFAULT_META: TypeMeta = { label: 'Действие', icon: 'i-lucide-circle', badgeClass: 'bg-neutral-500/15 text-neutral-400' };

function metaFor(type: string) {
  return TYPE_META[type] ?? DEFAULT_META;
}

const api = useApi();
const toast = useToast();
const jarsStore = useJarsStore();

const { data: actions, refresh } = await useAsyncData('history', () => api<HistoryAction[]>('/history'), {
  default: () => [] as HistoryAction[],
});

const availableTypes = computed(() => {
  const types = new Set((actions.value ?? []).map((a) => a.type));
  return Array.from(types);
});
const selectedTypes = ref<Set<string>>(new Set());
const showUndone = ref(true);

function toggleType(type: string) {
  const next = new Set(selectedTypes.value);
  if (next.has(type)) {
    next.delete(type);
  } else {
    next.add(type);
  }
  selectedTypes.value = next;
}

const filteredActions = computed(() => {
  const list = Array.isArray(actions.value) ? actions.value : [];
  return list.filter((a) => {
    if (selectedTypes.value.size > 0 && !selectedTypes.value.has(a.type)) return false;
    if (!showUndone.value && a.undone) return false;
    return true;
  });
});

const undoing = ref(false);
const lastUndoable = computed(() => (Array.isArray(actions.value) ? actions.value.find((a) => !a.undone) : undefined));

async function undoLast() {
  undoing.value = true;
  try {
    await api('/history/undo', { method: 'POST' });
    await Promise.all([refresh(), jarsStore.fetchJars()]);
    toast.add({ title: 'Действие отменено', color: 'success' });
  } catch (error: any) {
    toast.add({ title: 'Не удалось отменить', description: error?.data?.message, color: 'error' });
  } finally {
    undoing.value = false;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU');
}
</script>

<template>
  <UContainer class="py-8 space-y-6">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <h1 class="text-2xl font-semibold">История</h1>
      <UButton
        v-if="lastUndoable"
        icon="i-lucide-undo-2"
        color="neutral"
        variant="subtle"
        :loading="undoing"
        @click="undoLast"
      >
        Отменить последнее действие
      </UButton>
    </div>

    <div class="flex items-center gap-2 flex-wrap">
      <button
        v-for="type in availableTypes"
        :key="type"
        class="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-opacity"
        :class="[metaFor(type).badgeClass, selectedTypes.size > 0 && !selectedTypes.has(type) ? 'opacity-40' : '']"
        @click="toggleType(type)"
      >
        <UIcon :name="metaFor(type).icon" class="size-3.5" />
        {{ metaFor(type).label }}
      </button>
      <UButton
        v-if="selectedTypes.size > 0"
        size="xs"
        color="neutral"
        variant="ghost"
        @click="selectedTypes = new Set()"
      >
        Сбросить
      </UButton>
      <USeparator orientation="vertical" class="h-5" />
      <label class="flex items-center gap-1.5 text-sm text-muted">
        <USwitch v-model="showUndone" size="sm" />
        Показывать отменённые
      </label>
    </div>

    <div v-if="filteredActions.length" class="space-y-2">
      <div
        v-for="action in filteredActions"
        :key="action.id"
        class="flex items-center gap-3 rounded-lg border border-default px-4 py-3"
        :class="{ 'opacity-50': action.undone }"
      >
        <div class="flex size-8 items-center justify-center rounded-full shrink-0" :class="metaFor(action.type).badgeClass">
          <UIcon :name="metaFor(action.type).icon" class="size-4" />
        </div>
        <div class="min-w-0 flex-1">
          <p>{{ action.summary }}</p>
          <p class="text-sm text-muted">{{ formatDate(action.createdAt) }}</p>
        </div>
        <UBadge v-if="action.undone" color="neutral" variant="subtle">Отменено</UBadge>
      </div>
    </div>
    <p v-else class="text-muted">Ничего не найдено.</p>
  </UContainer>
</template>
