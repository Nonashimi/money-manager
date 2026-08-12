const PUBLIC_PAGES = ['/login', '/register'];

export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore();

  if (!authStore.isAuthenticated && !PUBLIC_PAGES.includes(to.path)) {
    return navigateTo('/login');
  }

  if (authStore.isAuthenticated && PUBLIC_PAGES.includes(to.path)) {
    return navigateTo('/');
  }
});
