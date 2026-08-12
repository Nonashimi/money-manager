<script setup lang="ts">
// Nuxt UI's UInputNumber (reka-ui NumberField) only formats on blur — the raw digits
// are shown while typing. This wraps a plain UInput and reformats with thousands
// separators on every keystroke instead, preserving cursor position across the reflow.

const props = defineProps<{
  modelValue: number | undefined;
  min?: number;
  max?: number;
  placeholder?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  class?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: number | undefined] }>();

function formatDigits(digits: string): string {
  if (!digits) return '';
  return Number(digits).toLocaleString('ru-RU');
}

function displayValue(value: number | undefined): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '';
  return Math.trunc(value).toLocaleString('ru-RU');
}

const uInputRef = useTemplateRef<{ inputRef?: HTMLInputElement }>('uInputRef');
const display = ref(displayValue(props.modelValue));

watch(
  () => props.modelValue,
  (value) => {
    // Only resync from external changes — while the field has focus, `onInput` already
    // owns `display`, so overwriting it here would clobber what the user is typing.
    if (document.activeElement !== uInputRef.value?.inputRef) {
      display.value = displayValue(value);
    }
  },
);

function clamp(value: number): number {
  let result = value;
  if (props.min !== undefined) result = Math.max(props.min, result);
  if (props.max !== undefined) result = Math.min(props.max, result);
  return result;
}

function onInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const cursorPos = target.selectionStart ?? target.value.length;
  const digitsBeforeCursor = target.value.slice(0, cursorPos).replace(/\D/g, '').length;

  const rawDigits = target.value.replace(/\D/g, '');
  const formatted = formatDigits(rawDigits);
  display.value = formatted;

  const numValue = rawDigits ? clamp(Number(rawDigits)) : undefined;
  emit('update:modelValue', numValue);

  nextTick(() => {
    const input = uInputRef.value?.inputRef;
    if (!input) return;
    let seen = 0;
    let pos = formatted.length;
    if (digitsBeforeCursor === 0) {
      pos = 0;
    } else {
      for (let i = 0; i < formatted.length; i++) {
        if (/\d/.test(formatted[i])) seen++;
        if (seen === digitsBeforeCursor) {
          pos = i + 1;
          break;
        }
      }
    }
    input.setSelectionRange(pos, pos);
  });
}
</script>

<template>
  <UInput
    ref="uInputRef"
    :model-value="display"
    inputmode="numeric"
    autocomplete="off"
    :placeholder="placeholder"
    :size="size"
    :class="props.class"
    @input="onInput"
  />
</template>
