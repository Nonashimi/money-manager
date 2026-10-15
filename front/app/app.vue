<script setup lang="ts">
useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: { lang: 'ru' },
});

useSeoMeta({
  title: 'Money Manager',
  description: 'Учёт доходов, копилок, расходов и долгов',
});

const authStore = useAuthStore();
</script>

<template>
  <UApp>
    <div
      v-if="authStore.isAuthenticated"
      class="flex min-h-dvh"
    >
      <AppSidebar />
      <div class="min-w-0 flex-1">
        <div class="lg:hidden">
          <AppHeader />
        </div>
        <UMain class="pb-24 lg:pb-0">
          <NuxtPage />
        </UMain>
      </div>
      <AppTabBar />
    </div>

    <UMain v-else>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
