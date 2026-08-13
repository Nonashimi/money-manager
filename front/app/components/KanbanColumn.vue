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
  } catch {
    toast.add({ title: 'Не удалось перенести расход', color: 'error' })
    emit('changed')
  }
}

useSortable(columnEl, localCards, {
  group: 'board-columns',
  animation: 150,
  onEnd: handleDragEnd
})

const isAdding = ref(false)
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
    isAdding.value = false
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
const accentColor = computed(() => props.jar.color || '#6366f1')
</script>

<template>
  <UCard
    data-tour="board-column"
    class="min-w-64 flex-1"
  >
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <span class="flex items-center gap-2 font-medium truncate">
          <span
            class="size-2 rounded-full shrink-0"
            :style="{ backgroundColor: accentColor }"
          />
          {{ jar.name }}
        </span>
        <span class="text-sm text-muted shrink-0 tabular-nums">{{ formatMoney(columnTotal) }}</span>
      </div>
    </template>

    <div
      ref="columnEl"
      :data-jar-id="jar.id"
      class="space-y-2 min-h-16"
    >
      <div
        v-for="card in localCards"
        :key="card.id"
        :data-expense-id="card.id"
        data-tour="board-card"
        class="group flex items-start gap-2 rounded-lg border border-default bg-elevated/50 px-3 py-2 cursor-grab active:cursor-grabbing hover:border-primary/40 transition-colors"
      >
        <UIcon
          name="i-lucide-grip-vertical"
          class="size-4 text-dimmed mt-0.5 shrink-0"
        />
        <div class="min-w-0 flex-1">
          <p class="font-medium tabular-nums">
            {{ formatMoney(card.amount) }}
          </p>
          <p class="text-sm text-muted truncate">
            {{ card.description }}
          </p>
        </div>
        <UButton
          icon="i-lucide-x"
          size="xs"
          color="neutral"
          variant="ghost"
          class="opacity-60 hover:opacity-100 transition-opacity"
          @click="removeCard(card.id)"
        />
      </div>
    </div>

    <template #footer>
      <div
        v-if="isAdding"
        class="space-y-2"
      >
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
        <div class="flex gap-2">
          <UButton
            size="sm"
            :loading="submitting"
            @click="submitCard"
          >
            Добавить
          </UButton>
          <UButton
            size="sm"
            color="neutral"
            variant="ghost"
            @click="isAdding = false"
          >
            Отмена
          </UButton>
        </div>
      </div>
      <UButton
        v-else
        data-tour="board-add-btn"
        icon="i-lucide-plus"
        size="sm"
        color="neutral"
        variant="ghost"
        block
        @click="isAdding = true"
      >
        Добавить
      </UButton>
    </template>
  </UCard>
</template>
