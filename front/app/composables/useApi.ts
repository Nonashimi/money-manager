export function useApi() {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();

  return $fetch.create({
    baseURL: `${config.public.apiBase}/api`,
    onRequest({ options }) {
      if (authStore.token) {
        const headers = new Headers(options.headers);
        headers.set('Authorization', `Bearer ${authStore.token}`);
        options.headers = headers;
      }
    },
    onResponseError({ response }) {
      if (response.status === 401) {
        authStore.logout();
        // Navigate on the client only, and don't await it here: doing so inside a
        // shared fetch interceptor can race with an in-flight useAsyncData call
        // (e.g. during SSR) and leave its `data` ref in a non-array state.
        if (import.meta.client) {
          navigateTo('/login');
        }
      }
    },
  });
}
