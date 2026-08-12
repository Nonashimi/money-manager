<script setup lang="ts">
import * as z from 'zod';
import type { FormSubmitEvent } from '@nuxt/ui';

export interface Person {
  id: string;
  name: string;
  note: string | null;
}

const props = defineProps<{ people: Person[] }>();
const emit = defineEmits<{ changed: [] }>();

const api = useApi();
const toast = useToast();

const schema = z.object({ name: z.string().min(1, 'Введите имя'), note: z.string().optional() });
type Schema = z.output<typeof schema>;

const editingPerson = ref<Person | null>(null);
const isFormOpen = ref(false);
const state = reactive<Partial<Schema>>({ name: undefined, note: undefined });
const loading = ref(false);

function openCreate() {
  editingPerson.value = null;
  state.name = undefined;
  state.note = undefined;
  isFormOpen.value = true;
}

function openEdit(person: Person) {
  editingPerson.value = person;
  state.name = person.name;
  state.note = person.note ?? undefined;
  isFormOpen.value = true;
}

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true;
  try {
    if (editingPerson.value) {
      await api(`/people/${editingPerson.value.id}`, { method: 'PATCH', body: event.data });
    } else {
      await api('/people', { method: 'POST', body: event.data });
    }
    isFormOpen.value = false;
    emit('changed');
  } finally {
    loading.value = false;
  }
}

async function remove(person: Person) {
  await api(`/people/${person.id}`, { method: 'DELETE' });
  toast.add({ title: `«${person.name}» удалён`, color: 'neutral' });
  emit('changed');
}
</script>

<template>
  <div class="space-y-4">
    <UButton icon="i-lucide-user-plus" block color="neutral" variant="subtle" @click="openCreate">
      Добавить контакт
    </UButton>

    <div v-if="props.people.length" class="space-y-2 max-h-80 overflow-y-auto">
      <div
        v-for="person in props.people"
        :key="person.id"
        class="flex items-center justify-between rounded-lg border border-default px-3 py-2"
      >
        <div class="min-w-0">
          <p class="font-medium truncate">{{ person.name }}</p>
          <p v-if="person.note" class="text-sm text-muted truncate">{{ person.note }}</p>
        </div>
        <div class="flex gap-1 shrink-0">
          <UButton icon="i-lucide-pencil" size="xs" color="neutral" variant="ghost" @click="openEdit(person)" />
          <UButton icon="i-lucide-trash" size="xs" color="error" variant="ghost" @click="remove(person)" />
        </div>
      </div>
    </div>
    <p v-else class="text-muted text-sm">Пока нет контактов.</p>

    <UModal v-model:open="isFormOpen" :title="editingPerson ? 'Изменить контакт' : 'Новый контакт'">
      <template #body>
        <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
          <UFormField label="Имя" name="name">
            <UInput v-model="state.name" class="w-full" />
          </UFormField>
          <UFormField label="Заметка" name="note">
            <UInput v-model="state.note" class="w-full" />
          </UFormField>
          <UButton type="submit" block :loading="loading">Сохранить</UButton>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
