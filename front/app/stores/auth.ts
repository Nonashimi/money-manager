export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export const useAuthStore = defineStore('auth', () => {
  const token = useCookie<string | null>('mm_token', {
    default: () => null,
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
  });
  const user = ref<AuthUser | null>(null);

  const isAuthenticated = computed(() => !!token.value);

  function setSession(accessToken: string, sessionUser: AuthUser) {
    token.value = accessToken;
    user.value = sessionUser;
  }

  function logout() {
    token.value = null;
    user.value = null;
  }

  return { token, user, isAuthenticated, setSession, logout };
});
