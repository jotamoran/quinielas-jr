<script setup>
defineProps({ partido: { type: Object, required: true }, modelValue: { type: String, default: null }, deshabilitado: { type: Boolean, default: false } });
defineEmits(['update:modelValue']);

const opciones = [
  { value: 'L', label: 'Local' },
  { value: 'E', label: 'Empate' },
  { value: 'V', label: 'Visita' },
];

function fechaPartido(fecha) {
  return new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' }).format(new Date(fecha));
}
</script>

<template>
  <article class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
    <div class="mb-5 text-center"><p class="text-xs font-bold uppercase tracking-widest text-quiniela-verde">{{ partido.liga_nombre }}</p><p class="mt-1 text-sm capitalize text-gray-500">{{ fechaPartido(partido.fecha_partido) }}</p></div>
    <div class="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
      <div><img v-if="partido.logo_local" :src="partido.logo_local" alt="" class="mx-auto mb-2 h-12 w-12 object-contain" /><div v-else class="mx-auto mb-2 h-12 w-12 rounded-full bg-gray-100"></div><p class="text-sm font-bold">{{ partido.equipo_local }}</p></div>
      <span class="text-xs font-bold text-gray-400">VS</span>
      <div><img v-if="partido.logo_visitante" :src="partido.logo_visitante" alt="" class="mx-auto mb-2 h-12 w-12 object-contain" /><div v-else class="mx-auto mb-2 h-12 w-12 rounded-full bg-gray-100"></div><p class="text-sm font-bold">{{ partido.equipo_visitante }}</p></div>
    </div>
    <div v-if="partido.cancelado" class="rounded-xl bg-red-50 py-3 text-center text-sm font-bold text-red-700">Partido cancelado — no cuenta para tu quiniela</div>
    <div v-else class="grid grid-cols-3 gap-2">
      <button v-for="opcion in opciones" :key="opcion.value" type="button" :disabled="deshabilitado" @click="$emit('update:modelValue', opcion.value)" :aria-pressed="modelValue === opcion.value" class="min-h-12 rounded-xl border px-2 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50" :class="modelValue === opcion.value ? 'border-quiniela-doradoOscuro bg-quiniela-dorado text-quiniela-grisTexto shadow-sm' : 'border-gray-300 text-gray-600 hover:border-quiniela-verde'">{{ opcion.label }}</button>
    </div>
  </article>
</template>
