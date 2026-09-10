<script setup>
defineProps({
  items: { type: Array, required: true },
});

function etiquetaPronostico(valor) {
  return { L: 'Local', E: 'Empate', V: 'Visita' }[valor] ?? valor;
}

function esAcierto(detalle) {
  return detalle.resultado_oficial != null && detalle.resultado_oficial === detalle.pronostico;
}

function esFallo(detalle) {
  return detalle.resultado_oficial != null && detalle.resultado_oficial !== detalle.pronostico;
}
</script>

<template>
  <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
    <div v-for="(detalle, index) in items" :key="detalle.partido_id" class="flex items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm">
      <div class="flex min-w-0 items-center gap-1.5">
        <span class="text-xs text-gray-400">{{ index + 1 }}</span>
        <img v-if="detalle.logo_local" :src="detalle.logo_local" alt="" class="h-5 w-5 shrink-0 object-contain" /><span v-else class="h-5 w-5 shrink-0 rounded-full bg-gray-100"></span>
        <p class="truncate font-semibold">{{ detalle.equipo_local }} vs {{ detalle.equipo_visitante }}</p>
        <img v-if="detalle.logo_visitante" :src="detalle.logo_visitante" alt="" class="h-5 w-5 shrink-0 object-contain" /><span v-else class="h-5 w-5 shrink-0 rounded-full bg-gray-100"></span>
      </div>
      <span class="shrink-0 rounded-full px-2 py-1 text-xs font-bold" :class="esAcierto(detalle) ? 'bg-green-100 text-green-700' : esFallo(detalle) ? 'bg-red-100 text-red-700' : 'bg-green-50 text-quiniela-verde'">{{ esAcierto(detalle) ? '✓ ' : esFallo(detalle) ? '✗ ' : '' }}{{ etiquetaPronostico(detalle.pronostico) }}</span>
    </div>
  </div>
</template>
