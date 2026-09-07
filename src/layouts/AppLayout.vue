<script setup>
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';

import NavbarComponent from "@components/NavbarComponent.vue";
import FooterComponent from "@components/FooterComponent.vue";

import { useUiStore } from '@/store/ui';
import { useAuthStore } from '@/store/auth';

import { obtenerMenuSistema } from '@/services/menuService';

const route = useRoute();
const uiStore = useUiStore();
const authStore = useAuthStore();
let solicitudMenuActual = 0;

const sistemaRuta = computed(() => {
  const slug = route.path.split('/')[1]?.toLowerCase();
  if (!slug) return null;

  return authStore.sistemas?.find(
    (item) => item.slug?.toLowerCase() === slug
  ) || null;
});

const cargarMenuSistema = async () => {
  const sistema = sistemaRuta.value;
  const solicitudId = ++solicitudMenuActual;

  if (!sistema) {
    authStore.setSistemaActual(null);
    authStore.setMenu([]);
    return;
  }

  authStore.setSistemaActual(sistema);

  try {
    const response = await obtenerMenuSistema(sistema.clave);
    if (solicitudId !== solicitudMenuActual) return;

    authStore.setMenu(response?.menu || response?.data?.menu || []);
  } catch (error) {
    if (solicitudId !== solicitudMenuActual) return;

    authStore.setMenu([]);
    console.error('No fue posible cargar el menú del sistema:', error);
  }
};

watch(
  () => sistemaRuta.value?.clave || null,
  cargarMenuSistema,
  { immediate: true }
);
</script>

<template>
  <NavbarComponent />

  <v-main class="fondo-gradiente d-flex flex-column">
    <div class="flex-1 min-h-0">
      <router-view />
    </div>

    <FooterComponent />
  </v-main>

  <v-overlay
    :model-value="uiStore.isLoading"
    class="align-center justify-center"
    persist
  >
    <v-progress-circular
      color="primary"
      indeterminate
      size="64"
    />
  </v-overlay>
</template>

<style scoped>
.fondo-gradiente {
  background: linear-gradient(
    120deg,
    rgb(var(--v-theme-background)) 0%,
    rgb(var(--v-theme-surface)) 100%
  );
}
</style>
