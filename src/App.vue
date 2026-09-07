<script setup>
import { onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import AppLayout from '@/layouts/AppLayout.vue';
import AuthLayout from '@/layouts/AuthLayout.vue';
import PublicoLayout from '@/layouts/PublicoLayout.vue';

const route = useRoute();
const authStore = useAuthStore();
onMounted(() => authStore.init());

// Cada layout ya renderiza su propio <router-view /> internamente, así que
// basta con montar el layout correcto según el tipo de ruta actual.
const layout = computed(() => {
  if (route.meta.guestOnly) return AuthLayout;
  if (route.name === 'tabla-publica') return PublicoLayout;
  return AppLayout;
});
</script>

<template>
  <component :is="layout" />
</template>
