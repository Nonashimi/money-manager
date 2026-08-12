<script setup lang="ts">
import { Bar, Doughnut } from 'vue-chartjs';

interface Summary {
  total: string;
  averagePerDay: string;
  dailyNorm: string | null;
  overNorm: boolean | null;
}
interface DailyPoint {
  date: string;
  total: string;
}
interface JarBreakdown {
  jarId: string;
  jarName: string;
  total: string;
}

const api = useApi();
const jarsStore = useJarsStore();

const { data: summary } = await useAsyncData('stats-summary', () => api<Summary>('/statistics/summary'));
const { data: daily } = await useAsyncData('stats-daily', () => api<DailyPoint[]>('/statistics/daily'), {
  default: () => [] as DailyPoint[],
});
const { data: byJar } = await useAsyncData('stats-by-jar', () => api<JarBreakdown[]>('/statistics/by-jar'), {
  default: () => [] as JarBreakdown[],
});
await useAsyncData('stats-jars', () => jarsStore.fetchJars(true));

// Match each jar's own color (from JarForm's palette) instead of a generic chart palette,
// so the doughnut matches what the user sees on the jar cards and kanban board.
function colorForJar(jarId: string): string {
  return jarsStore.jars.find((j) => j.id === jarId)?.color || '#6366f1';
}

const dailyChartData = computed(() => ({
  labels: (daily.value ?? []).map((d) => d.date.slice(5)),
  datasets: [
    { label: 'Расходы', data: (daily.value ?? []).map((d) => Number(d.total)), backgroundColor: '#6366f1', borderRadius: 4 },
  ],
}));

const byJarChartData = computed(() => ({
  labels: (byJar.value ?? []).map((j) => j.jarName),
  datasets: [
    {
      data: (byJar.value ?? []).map((j) => Number(j.total)),
      backgroundColor: (byJar.value ?? []).map((j) => colorForJar(j.jarId)),
    },
  ],
}));

const chartOptions = { responsive: true, maintainAspectRatio: false };
</script>

<template>
  <UContainer class="py-8 space-y-6">
    <h1 class="text-2xl font-semibold">Статистика</h1>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <UCard>
        <p class="text-muted text-sm">Всего потрачено</p>
        <p class="text-2xl font-semibold tabular-nums">{{ formatMoney(summary?.total ?? 0) }}</p>
      </UCard>
      <UCard>
        <p class="text-muted text-sm">В среднем в день</p>
        <p class="text-2xl font-semibold tabular-nums">{{ formatMoney(summary?.averagePerDay ?? 0) }}</p>
      </UCard>
      <UCard>
        <p class="text-muted text-sm">Норма в день</p>
        <p class="text-2xl font-semibold tabular-nums" :class="summary?.overNorm ? 'text-error' : ''">
          {{ summary?.dailyNorm ? formatMoney(summary.dailyNorm) : '—' }}
        </p>
      </UCard>
    </div>

    <UCard>
      <template #header>
        <h2 class="font-medium">Расходы по дням (последние 30 дней)</h2>
      </template>
      <div class="h-64">
        <Bar :data="dailyChartData" :options="chartOptions" />
      </div>
    </UCard>

    <UCard v-if="byJar?.length">
      <template #header>
        <h2 class="font-medium">По копилкам</h2>
      </template>
      <div class="h-64">
        <Doughnut :data="byJarChartData" :options="chartOptions" />
      </div>
    </UCard>
  </UContainer>
</template>
