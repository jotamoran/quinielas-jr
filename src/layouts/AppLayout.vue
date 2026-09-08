<script setup>
import NavbarComponent from '@/components/NavbarComponent.vue';
import FooterComponent from '@/components/FooterComponent.vue';
</script>

<template>
  <div class="flex min-h-screen flex-col bg-quiniela-grisClaro">
    <NavbarComponent />
    <div class="flex-1"><router-view /></div>
    <FooterComponent />
  </div>
</template>
