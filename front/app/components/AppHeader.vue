<script setup lang="ts">
const authStore = useAuthStore()
const router = useRouter()

const now = new Date()
const boardLink = `/board/${now.getFullYear()}/${now.getMonth() + 1}`

const links = [
  { label: 'Дашборд', to: '/' },
  { label: 'Копилки', to: '/jars' },
  { label: 'Доска', to: boardLink },
  { label: 'Долги', to: '/debts' },
  { label: 'История', to: '/history' },
  { label: 'Статистика', to: '/statistics' }
]

async function logout() {
  authStore.logout()
  await router.push('/login')
}

const initials = computed(() => {
  const source = authStore.user?.name?.trim() || authStore.user?.email || ''
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
})

const menuItems = [
  [{ label: 'Настройки', icon: 'i-lucide-settings', to: '/settings' }],
  [{ label: 'Выйти', icon: 'i-lucide-log-out', onSelect: logout }]
]

const accountLinks = [
  { label: 'Настройки', icon: 'i-lucide-settings', to: '/settings' },
  { label: 'Выйти', icon: 'i-lucide-log-out', onSelect: logout }
]
</script>

<template>
  <UHeader :ui="{ root: 'border-b border-default bg-default/80 backdrop-blur' }">
    <template #left>
      <NuxtLink
        to="/"
        class="flex items-center gap-2 font-semibold text-highlighted"
      >
        <span class="flex size-7 items-center justify-center rounded-lg bg-primary">
          <UIcon
            name="i-lucide-wallet"
            class="size-4 text-white"
          />
        </span>
        Money Manager
      </NuxtLink>
    </template>

    <UNavigationMenu :items="links" />

    <template #body>
      <UNavigationMenu
        :items="links"
        orientation="vertical"
        class="-mx-2.5"
      />
      <USeparator class="my-4" />
      <UNavigationMenu
        :items="accountLinks"
        orientation="vertical"
        class="-mx-2.5"
      />
    </template>

    <template #right>
      <UColorModeButton />
      <!-- Desktop only — Настройки/Выйти already live in the mobile drawer's #body slot below,
           so this dropdown would just be a duplicate on small screens. -->
      <UDropdownMenu
        :items="menuItems"
        class="hidden lg:block"
      >
        <button
          class="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 transition-colors hover:bg-elevated"
          type="button"
        >
          <span
            class="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
          >
            {{ initials }}
          </span>
          <span class="hidden text-sm sm:inline">{{ authStore.user?.name || authStore.user?.email }}</span>
          <UIcon
            name="i-lucide-chevron-down"
            class="size-3.5 text-muted"
          />
        </button>
      </UDropdownMenu>
    </template>
  </UHeader>
</template>
