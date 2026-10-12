<script setup>
defineProps({
  items: { type: Array, required: true },
});

function etiquetaPronostico(valor) {
  return { L: 'Local', E: 'Empate', V: 'Visita' }[valor] ?? valor;
}

function tieneMarcador(detalle) {
  return detalle.puntos_local != null || detalle.puntos_visitante != null;
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
    <div v-for="(detalle, index) in items" :key="detalle.partido_id" class="flex items-center justify-between gap-2 rounded-xl border p-3 text-sm" :class="detalle.estado === 'en_vivo' ? 'border-red-300 bg-red-50/40' : 'border-transparent bg-white'">
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="flex min-w-0 items-center gap-2">
          <span class="shrink-0 text-xs text-gray-400">{{ index + 1 }}</span>
          <span class="sr-only">{{ detalle.equipo_local }} contra {{ detalle.equipo_visitante }}</span>
          <img v-if="detalle.logo_local" :src="detalle.logo_local" :alt="detalle.equipo_local" :title="detalle.equipo_local" loading="lazy" decoding="async" class="h-7 w-7 shrink-0 object-contain" />
          <span v-else class="min-w-0 max-w-[5.5rem] truncate text-xs font-semibold" :title="detalle.equipo_local">{{ detalle.equipo_local }}</span>
          <span v-if="tieneMarcador(detalle) && !detalle.cancelado" class="shrink-0 text-base font-bold tabular-nums" :class="detalle.estado === 'en_vivo' ? 'text-red-600' : 'text-quiniela-verdeOscuro'">{{ detalle.puntos_local ?? '—' }} - {{ detalle.puntos_visitante ?? '—' }}</span>
          <span v-else class="shrink-0 text-xs font-bold text-gray-400">vs</span>
          <img v-if="detalle.logo_visitante" :src="detalle.logo_visitante" :alt="detalle.equipo_visitante" :title="detalle.equipo_visitante" loading="lazy" decoding="async" class="h-7 w-7 shrink-0 object-contain" />
          <span v-else class="min-w-0 max-w-[5.5rem] truncate text-xs font-semibold" :title="detalle.equipo_visitante">{{ detalle.equipo_visitante }}</span>
        </div>
        <p class="truncate pl-5 text-[11px] capitalize text-gray-400">{{ detalle.fecha_partido ? fechaPartido(detalle.fecha_partido) : '' }}<span v-if="detalle.estado === 'en_vivo' && !detalle.cancelado" class="font-bold normal-case text-red-600"> · En vivo</span></p>
      </div>
      <span class="shrink-0 rounded-full px-2 py-1 text-xs font-bold" :class="esAcierto(detalle) ? 'bg-green-100 text-green-700' : esFallo(detalle) ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'">{{ esAcierto(detalle) ? '✓ ' : esFallo(detalle) ? '✗ ' : '' }}{{ detalle.cancelado ? 'Cancelado' : etiquetaPronostico(detalle.pronostico) }}</span>
    </div>
  </div>
</template>
