<script setup lang="ts">
import { useSortable } from '@vueuse/integrations/useSortable'
import type { Jar } from '../stores/jars'

export interface ExpenseCard {
  id: string
  jarId: string
  amount: string
  description: string
  order: number
}

const props = defineProps<{ jar: Jar, cards: ExpenseCard[], date: string }>()
const emit = defineEmits<{ changed: [] }>()

const api = useApi()
const toast = useToast()

const localCards = shallowRef<ExpenseCard[]>(props.cards)
watch(
  () => props.cards,
  (value) => {
    localCards.value = value
  }
)

const columnEl = useTemplateRef<HTMLElement>('columnEl')

async function handleDragEnd(event: { item: HTMLElement, to: HTMLElement, newIndex?: number }) {
  const expenseId = event.item.dataset.expenseId!
  const toJarId = event.to.dataset.jarId!
  const fromJarId = props.jar.id

  try {
    if (toJarId !== fromJarId) {
      await api(`/board/expenses/${expenseId}`, { method: 'PATCH', body: { jarId: toJarId } })
    }
    emit('changed')
  } catch (error: any) {
    toast.add({ title: 'Не удалось перенести расход', description: error?.data?.message, color: 'error' })
    emit('changed')
  }
}

useSortable(columnEl, localCards, {
  group: 'board-columns',
  animation: 150,
  onEnd: handleDragEnd
})

const isAddOpen = ref(false)
const amount = ref<number | undefined>(undefined)
const description = ref('')
const submitting = ref(false)

async function submitCard() {
  if (!amount.value || amount.value <= 0) return
  submitting.value = true
  try {
    await api('/board/expenses', {
      method: 'POST',
      body: { date: props.date, jarId: props.jar.id, amount: amount.value, description: description.value }
    })
    amount.value = undefined
    description.value = ''
    isAddOpen.value = false
    emit('changed')
  } catch (error: any) {
    toast.add({ title: 'Не удалось добавить расход', description: error?.data?.message, color: 'error' })
  } finally {
    submitting.value = false
  }
}

async function removeCard(id: string) {
  try {
    await api(`/board/expenses/${id}`, { method: 'DELETE' })
    emit('changed')
  } catch {
    toast.add({ title: 'Не удалось удалить расход', color: 'error' })
  }
}

const columnTotal = computed(() => localCards.value.reduce((sum, c) => sum + Number(c.amount), 0))
const isNegative = computed(() => Number(props.jar.balance) < 0)
const accentColor = computed(() => props.jar.color || '#6366f1')
</script>

<template>
  <div
    data-tour="board-column"
    class="flex min-h-48 flex-col gap-3 rounded-xl border border-default bg-elevated p-3"
  >
    <div class="flex items-center justify-between gap-2 px-1">
      <span class="flex min-w-0 items-center gap-2 font-semibold text-highlighted">
        <span
          class="size-2.5 shrink-0 rounded-full"
          :style="{ backgroundColor: accentColor }"
        />
        <span class="truncate">{{ jar.name }}</span>
      </span>
      <span
        class="shrink-0 text-sm font-medium tabular-nums"
        :class="isNegative ? 'text-error' : 'text-muted'"
      >
        {{ formatMoney(jar.balance) }}
      </span>
    </div>
    <p class="-mt-2 px-1 text-xs text-dimmed tabular-nums">
      за день: {{ formatMoney(columnTotal) }}
    </p>

    <div
      ref="columnEl"
      :data-jar-id="jar.id"
      class="min-h-12 flex-1 space-y-2"
    >
      <div
        v-for="card in localCards"
        :key="card.id"
        :data-expense-id="card.id"
        data-tour="board-card"
        class="group flex cursor-grab items-center gap-2 rounded-lg border border-default bg-accented px-3 py-2.5 transition-colors hover:border-primary/50 active:cursor-grabbing"
      >
        <UIcon
          name="i-lucide-grip-vertical"
          class="size-4 shrink-0 text-dimmed"
        />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-default">
            {{ card.description || 'Без описания' }}
          </p>
        </div>
        <p class="shrink-0 font-semibold tabular-nums text-highlighted">
          {{ formatMoney(card.amount) }}
        </p>
        <UButton
          icon="i-lucide-x"
          size="xs"
          color="neutral"
          variant="ghost"
          aria-label="Удалить расход"
          class="opacity-60 transition-opacity hover:opacity-100"
          @click="removeCard(card.id)"
        />
      </div>
    </div>

    <UButton
      data-tour="board-add-btn"
      icon="i-lucide-plus"
      size="sm"
      color="primary"
      variant="ghost"
      block
      @click="isAddOpen = true"
    >
      Добавить
    </UButton>

    <UModal
      v-model:open="isAddOpen"
      :title="`Расход — ${jar.name}`"
    >
      <template #body>
        <div class="space-y-3">
          <MoneyInput
            v-model="amount"
            :min="0"
            placeholder="Сумма"
            class="w-full"
          />
          <UInput
            v-model="description"
            placeholder="Описание"
            class="w-full"
            @keyup.enter="submitCard"
          />
          <UButton
            block
            :loading="submitting"
            :disabled="!amount || amount <= 0"
            @click="submitCard"
          >
            Добавить
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
