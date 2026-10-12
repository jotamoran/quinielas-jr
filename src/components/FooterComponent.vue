<script setup>
import EnlacesLegales from './EnlacesLegales.vue';
</script>

<template>
  <footer class="mt-auto border-t border-gray-200 bg-white px-4 py-5 text-center text-sm text-gray-500">
    <EnlacesLegales class="mb-2" />
    <p>© {{ new Date().getFullYear() }} Quinielas JR · Hecho para disfrutar el fútbol.</p>
    <p class="mx-auto mt-1 max-w-2xl text-xs text-gray-400">Quinielas JR es un sitio de entretenimiento privado. No está afiliado, patrocinado ni avalado por ninguna liga, federación o club deportivo.</p>
  </footer>
</template>
