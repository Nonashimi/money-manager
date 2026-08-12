export interface AllocatableJar {
  id: string;
  defaultPercent: string;
}

function roundTo2(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Manages a set of jar percents that always sum to 100 — no more manually balancing numbers
 * by hand. Adjusting one jar proportionally scales the others (preserving their relative
 * shares); unchecking a jar gives its share away the same way, checking one back in takes an
 * even slice from the rest. `distributeEvenly` is the odd one out — it's the explicit
 * "Поровну" action and intentionally resets everyone to an equal split.
 */
export function usePercentAllocator(jars: Ref<AllocatableJar[]>) {
  const percents = reactive<Record<string, number>>({});
  const included = reactive<Record<string, boolean>>({});

  watch(
    jars,
    (list) => {
      for (const jar of list) {
        if (!(jar.id in percents)) percents[jar.id] = Number(jar.defaultPercent);
        if (!(jar.id in included)) included[jar.id] = true;
      }
    },
    { immediate: true },
  );

  const includedIds = computed(() => jars.value.filter((jar) => included[jar.id] !== false).map((jar) => jar.id));

  /** Scales `ids` proportionally to their current relative shares so they sum to `target`. */
  function rebalanceToTotal(ids: string[], target: number) {
    if (!ids.length) return;
    const clampedTarget = Math.min(100, Math.max(0, target));
    const currentSum = ids.reduce((sum, id) => sum + (percents[id] ?? 0), 0);

    let allocated = 0;
    ids.forEach((id, index) => {
      const isLast = index === ids.length - 1;
      const share = currentSum === 0 ? clampedTarget / ids.length : ((percents[id] ?? 0) / currentSum) * clampedTarget;
      const value = isLast ? roundTo2(clampedTarget - allocated) : roundTo2(share);
      percents[id] = Math.max(0, value);
      allocated += value;
    });
  }

  function setPercent(jarId: string, rawValue: number) {
    const clamped = Math.min(100, Math.max(0, rawValue || 0));
    percents[jarId] = clamped;
    const others = includedIds.value.filter((id) => id !== jarId);
    rebalanceToTotal(others, 100 - clamped);
  }

  function toggleIncluded(jarId: string, value: boolean) {
    if (!value) {
      included[jarId] = false;
      percents[jarId] = 0;
      rebalanceToTotal(includedIds.value, 100);
    } else {
      included[jarId] = true;
      const evenShare = roundTo2(100 / includedIds.value.length);
      setPercent(jarId, evenShare);
    }
  }

  function distributeEvenly() {
    const ids = includedIds.value;
    if (!ids.length) return;
    const share = Math.floor((100 / ids.length) * 100) / 100;
    let allocated = 0;
    ids.forEach((id, index) => {
      const isLast = index === ids.length - 1;
      const value = isLast ? roundTo2(100 - allocated) : share;
      percents[id] = value;
      allocated += value;
    });
  }

  const total = computed(() => includedIds.value.reduce((sum, id) => sum + (percents[id] ?? 0), 0));
  const isValid = computed(() => includedIds.value.length > 0 && Math.abs(total.value - 100) < 0.01);

  return { percents, included, includedIds, total, isValid, setPercent, toggleIncluded, distributeEvenly };
}
