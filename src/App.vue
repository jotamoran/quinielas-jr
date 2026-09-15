<script setup>
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import AppLayout from '@/layouts/AppLayout.vue';
import AuthLayout from '@/layouts/AuthLayout.vue';
import PublicoLayout from '@/layouts/PublicoLayout.vue';
import LoginModal from '@/components/LoginModal.vue';

const route = useRoute();
const authStore = useAuthStore();
const enLinea = ref(typeof navigator === 'undefined' ? true : navigator.onLine);
onMounted(() => authStore.init());
function actualizarConexion() { enLinea.value = navigator.onLine; }
onMounted(() => {
  window.addEventListener('online', actualizarConexion);
  window.addEventListener('offline', actualizarConexion);
});
onUnmounted(() => {
  window.removeEventListener('online', actualizarConexion);
  window.removeEventListener('offline', actualizarConexion);
});

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
  <LoginModal />
  <div v-if="!enLinea" role="status" aria-live="polite" class="fixed bottom-4 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-900 shadow-xl">Sin conexión. Las acciones de registro, pago y pronósticos requieren internet.</div>
</template>
