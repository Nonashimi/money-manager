<script setup lang="ts">
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const now = new Date()
const boardLink = `/board/${now.getFullYear()}/${now.getMonth() + 1}`

const links = [
  { label: 'Главная', to: '/', icon: 'i-lucide-layout-dashboard', match: (p: string) => p === '/' },
  { label: 'Копилки', to: '/jars', icon: 'i-lucide-piggy-bank', match: (p: string) => p.startsWith('/jars') },
  { label: 'Доска', to: boardLink, icon: 'i-lucide-columns-3', match: (p: string) => p.startsWith('/board') },
  { label: 'Долги', to: '/debts', icon: 'i-lucide-handshake', match: (p: string) => p.startsWith('/debts') },
  { label: 'История', to: '/history', icon: 'i-lucide-history', match: (p: string) => p.startsWith('/history') },
  { label: 'Статистика', to: '/statistics', icon: 'i-lucide-chart-column', match: (p: string) => p.startsWith('/statistics') },
  { label: 'Настройки', to: '/settings', icon: 'i-lucide-settings', match: (p: string) => p.startsWith('/settings') }
]

async function logout() {
  authStore.logout()
  await router.push('/login')
}
</script>

<template>
  <aside class="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r border-default bg-muted px-3 py-5 lg:flex">
    <NuxtLink
      to="/"
      class="mb-2 flex items-center gap-2 px-2 font-extrabold text-highlighted"
    >
      <span class="flex size-7 items-center justify-center rounded-lg bg-primary">
        <UIcon
          name="i-lucide-wallet"
          class="size-4 text-white"
        />
      </span>
      Money Manager
    </NuxtLink>
    <div class="orn mb-3 ml-2 !h-2 !w-24 rounded-[1px]" />

    <NuxtLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
      :class="link.match(route.path) ? 'bg-accented text-primary' : 'text-muted hover:bg-elevated hover:text-default'"
    >
      <UIcon
        :name="link.icon"
        class="size-4"
      />
      {{ link.label }}
    </NuxtLink>

    <div class="mt-auto flex items-center justify-between gap-2 px-2 pt-4 text-sm">
      <span class="truncate text-default">{{ authStore.user?.name || authStore.user?.email }}</span>
      <div class="flex items-center">
        <UColorModeButton size="sm" />
        <UButton
          icon="i-lucide-log-out"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Выйти"
          @click="logout"
        />
      </div>
    </div>
  </aside>
</template>
