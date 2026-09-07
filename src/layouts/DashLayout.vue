<script setup>
import NavbarComponent from "@components/NavDashComponent.vue";
import FooterComponent from "@components/FooterComponent.vue";
import { useUiStore } from '@/store/ui';
const uiStore = useUiStore();
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
    ></v-progress-circular>
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
