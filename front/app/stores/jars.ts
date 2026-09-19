export type JarType = 'SPENDING' | 'SAVINGS';

export interface Jar {
  id: string;
  name: string;
  color: string | null;
  type: JarType;
  defaultPercent: string;
  balance: string;
  order: number;
  archived: boolean;
  createdAt: string;
}

export const useJarsStore = defineStore('jars', () => {
  const jars = ref<Jar[]>([]);
  const loading = ref(false);

  const activeJars = computed(() => jars.value.filter((j) => !j.archived));
  const spendingJars = computed(() => activeJars.value.filter((j) => j.type === 'SPENDING'));
  const savingsJars = computed(() => activeJars.value.filter((j) => j.type === 'SAVINGS'));

  async function fetchJars(includeArchived = false) {
    loading.value = true;
    try {
      jars.value = await useApi()<Jar[]>('/jars', { query: { includeArchived } });
      return jars.value;
    } finally {
      loading.value = false;
    }
  }

  async function createJar(payload: { name: string; color?: string; type?: JarType; defaultPercent?: number }) {
    await useApi()('/jars', { method: 'POST', body: payload });
    await fetchJars();
  }

  async function updateJar(
    id: string,
    payload: Partial<{ name: string; color: string; type: JarType; defaultPercent: number }>,
  ) {
    await useApi()(`/jars/${id}`, { method: 'PATCH', body: payload });
    await fetchJars();
  }

  async function archiveJar(id: string) {
    await useApi()(`/jars/${id}`, { method: 'DELETE' });
    await fetchJars();
  }

  async function reorderJars(jarIds: string[]) {
    await useApi()('/jars/reorder', { method: 'PATCH', body: { jarIds } });
    await fetchJars();
  }

  async function reallocate(allocations: { jarId: string; percent: number }[]) {
    await useApi()('/jars/reallocate', { method: 'PATCH', body: { allocations } });
    await fetchJars();
  }

  return {
    jars,
    activeJars,
    spendingJars,
    savingsJars,
    loading,
    fetchJars,
    createJar,
    updateJar,
    archiveJar,
    reorderJars,
    reallocate,
  };
});
