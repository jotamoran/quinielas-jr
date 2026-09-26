<script setup>
defineProps({
  items: { type: Array, required: true },
});

function etiquetaPronostico(valor) {
  return { L: 'Local', E: 'Empate', V: 'Visita' }[valor] ?? valor;
}

function esAcierto(detalle) {
  return !detalle.cancelado && detalle.resultado_oficial != null && detalle.resultado_oficial === detalle.pronostico;
}

function esFallo(detalle) {
  return !detalle.cancelado && detalle.resultado_oficial != null && detalle.resultado_oficial !== detalle.pronostico;
}

function fechaPartido(fecha) {
  if (!fecha) return '';
  return new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' }).format(new Date(fecha));
}
</script>

<template>
  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
    <div v-for="(detalle, index) in items" :key="detalle.partido_id" class="flex items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm">
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="flex min-w-0 items-center gap-1.5">
          <span class="shrink-0 text-xs text-gray-400">{{ index + 1 }}</span>
          <img v-if="detalle.logo_local" :src="detalle.logo_local" alt="" loading="lazy" decoding="async" class="h-5 w-5 shrink-0 object-contain" /><span v-else class="h-5 w-5 shrink-0 rounded-full bg-gray-100"></span>
          <p class="min-w-0 truncate font-semibold" :title="`${detalle.equipo_local} vs ${detalle.equipo_visitante}`">{{ detalle.equipo_local }} vs {{ detalle.equipo_visitante }}</p>
          <img v-if="detalle.logo_visitante" :src="detalle.logo_visitante" alt="" loading="lazy" decoding="async" class="h-5 w-5 shrink-0 object-contain" /><span v-else class="h-5 w-5 shrink-0 rounded-full bg-gray-100"></span>
          <span v-if="detalle.estado === 'en_vivo'" class="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700"><span class="h-1.5 w-1.5 rounded-full bg-red-500"></span>En vivo</span>
        </div>
        <p class="truncate pl-5 text-[11px] capitalize text-gray-400">{{ detalle.fecha_partido ? `${fechaPartido(detalle.fecha_partido)} · hora CDMX` : '' }}<span v-if="detalle.puntos_local != null || detalle.puntos_visitante != null" class="font-bold text-quiniela-verdeOscuro"> · {{ detalle.puntos_local ?? '—' }} - {{ detalle.puntos_visitante ?? '—' }}</span></p>
      </div>
      <span class="shrink-0 rounded-full px-2 py-1 text-xs font-bold" :class="esAcierto(detalle) ? 'bg-green-100 text-green-700' : esFallo(detalle) ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'">{{ esAcierto(detalle) ? '✓ ' : esFallo(detalle) ? '✗ ' : '' }}{{ detalle.cancelado ? 'Cancelado' : etiquetaPronostico(detalle.pronostico) }}</span>
    </div>
  </div>
</template>
