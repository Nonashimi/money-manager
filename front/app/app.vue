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
    <AppHeader v-if="authStore.isAuthenticated" />

    <UMain>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
