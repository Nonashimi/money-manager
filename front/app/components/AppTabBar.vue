<script setup lang="ts">
const route = useRoute()
const now = new Date()
const boardLink = `/board/${now.getFullYear()}/${now.getMonth() + 1}`

const tabs = [
  { label: 'Главная', to: '/', icon: 'i-lucide-layout-dashboard', match: (p: string) => p === '/' || p.startsWith('/jars') },
  { label: 'Доска', to: boardLink, icon: 'i-lucide-columns-3', match: (p: string) => p.startsWith('/board') },
  { label: 'Долги', to: '/debts', icon: 'i-lucide-handshake', match: (p: string) => p.startsWith('/debts') },
  { label: 'История', to: '/history', icon: 'i-lucide-history', match: (p: string) => p.startsWith('/history') },
  { label: 'Статистика', to: '/statistics', icon: 'i-lucide-chart-column', match: (p: string) => p.startsWith('/statistics') }
]
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-40 border-t border-default bg-default/95 backdrop-blur lg:hidden"
    aria-label="Основная навигация"
  >
    <ul class="mx-auto grid max-w-xl grid-cols-5 pb-[env(safe-area-inset-bottom)]">
      <li
        v-for="tab in tabs"
        :key="tab.to"
      >
        <NuxtLink
          :to="tab.to"
          class="flex flex-col items-center gap-1 px-1 pt-2.5 pb-2 text-[11px] font-medium transition-colors"
          :class="tab.match(route.path) ? 'text-primary' : 'text-muted hover:text-default'"
        >
          <UIcon
            :name="tab.icon"
            class="size-5"
          />
          {{ tab.label }}
          <span
            class="h-0.5 w-6 rounded-full transition-colors"
            :class="tab.match(route.path) ? 'bg-[#3b5aa8]' : 'bg-transparent'"
          />
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
