<script setup>
import NavbarComponent from '@/components/NavbarComponent.vue';
import FooterComponent from '@/components/FooterComponent.vue';
</script>

<template>
  <div class="min-h-screen bg-quiniela-grisClaro">
    <a href="#contenido-publico" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-quiniela-dorado focus:px-4 focus:py-3 focus:font-bold">Saltar al contenido</a>
    <NavbarComponent />
    <div id="contenido-publico"><router-view /></div>
    <FooterComponent />
  </div>
</template>
