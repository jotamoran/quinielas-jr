<script setup>
defineProps({
  cantidad: { type: Number, default: 3 },
});
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2" role="status" aria-label="Cargando contenido">
    <div v-for="item in cantidad" :key="item" class="animate-pulse rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div class="h-4 w-2/3 rounded bg-gray-200"></div>
      <div class="mt-3 h-3 w-1/2 rounded bg-gray-100"></div>
      <div class="mt-5 h-11 rounded-xl bg-gray-100"></div>
    </div>
    <span class="sr-only">Cargando…</span>
  </div>
</template>
