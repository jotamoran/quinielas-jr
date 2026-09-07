<script setup>
import FooterComponent from "@components/FooterComponent.vue";
</script>

<template>
  <v-main class="fondo-gradiente d-flex flex-column">
    <div class="flex-1 min-h-0 flex items-center justify-center px-4">
      <router-view />
    </div>

    <FooterComponent />
  </v-main>
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
