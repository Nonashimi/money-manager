export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore();

  if (authStore.token && !authStore.user) {
    const api = useApi();
    try {
      authStore.user = await api('/users/me');
    } catch {
      authStore.logout();
    }
  }
});
