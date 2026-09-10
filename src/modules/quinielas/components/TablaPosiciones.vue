<script setup>
import { computed, ref, onMounted, watch } from 'vue';
import DetallePronosticos from './DetallePronosticos.vue';

const props = defineProps({
  jornadaId: { type: String, required: true },
  obtenerRankingFn: { type: Function, required: true },
  obtenerPronosticosFn: { type: Function, default: null },
  bloqueada: { type: Boolean, default: false },
  resaltarExtremos: { type: Boolean, default: false },
});

const filas = ref([]);
const abiertaId = ref(null);
const detalles = ref({});
const cargandoDetalle = ref(null);
const errorDetalle = ref({});

async function cargar() {
  if (!props.jornadaId) return;
  filas.value = await props.obtenerRankingFn(props.jornadaId);
}

async function alternar(fila) {
  if (!props.bloqueada || !props.obtenerPronosticosFn || !fila.quiniela_id) return;
  if (abiertaId.value === fila.quiniela_id) {
    abiertaId.value = null;
    return;
  }
  abiertaId.value = fila.quiniela_id;
  if (detalles.value[fila.quiniela_id]) return;
  cargandoDetalle.value = fila.quiniela_id;
  delete errorDetalle.value[fila.quiniela_id];
  try {
    detalles.value[fila.quiniela_id] = await props.obtenerPronosticosFn(fila.quiniela_id);
  } catch (error) {
    errorDetalle.value[fila.quiniela_id] = error.message;
  } finally {
    cargandoDetalle.value = null;
  }
}

function nombreParticipante(fila) {
  return fila.alias ?? fila.mostrar_como ?? fila.nombre_completo;
}

function clavePara(fila) {
  return fila.quiniela_id ?? fila.mostrar_como;
}

const maxAciertos = computed(() => (filas.value.length ? Math.max(...filas.value.map((f) => f.aciertos)) : null));
const minAciertos = computed(() => (filas.value.length ? Math.min(...filas.value.map((f) => f.aciertos)) : null));
// Coincide con la regla de premios.js: el cupón "Por tarugo" solo se otorga si
// hay un único último lugar (sin empate) y no todos van tablas.
const claveGanaPorTarugo = computed(() => {
  if (maxAciertos.value === null || maxAciertos.value === minAciertos.value) return null;
  const ultimos = filas.value.filter((f) => f.aciertos === minAciertos.value);
  return ultimos.length === 1 ? clavePara(ultimos[0]) : null;
});

function esLider(fila) {
  return props.resaltarExtremos && maxAciertos.value !== null && fila.aciertos === maxAciertos.value;
}

function esPorTarugo(fila) {
  return props.resaltarExtremos && claveGanaPorTarugo.value !== null && clavePara(fila) === claveGanaPorTarugo.value;
}

onMounted(cargar);
watch(() => props.jornadaId, cargar);

defineExpose({ recargar: cargar });
</script>

<template>
  <div v-if="filas.length" class="space-y-2">
    <p v-if="resaltarExtremos" class="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
      <span class="flex items-center gap-1.5"><span class="h-3 w-3 rounded-full bg-amber-300"></span> Va(n) ganando el premio en este momento (si hay empate en el primer lugar, se reparte entre quienes empataron).</span>
      <span class="flex items-center gap-1.5"><span class="h-3 w-3 rounded-full bg-red-400"></span> "Por tarugo": hasta el momento va perdiendo y se llevará el cupón de consolación (si hay empate en el último lugar, no se otorga).</span>
    </p>
    <article v-for="fila in filas" :key="fila.quiniela_id ?? fila.mostrar_como" class="overflow-hidden rounded-2xl border shadow-sm" :class="esLider(fila) ? 'border-amber-300 bg-amber-50' : esPorTarugo(fila) ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'">
      <div class="grid grid-cols-[42px_1fr_auto] items-center gap-3 p-3.5 sm:grid-cols-[56px_1fr_110px_auto] sm:px-5">
        <span class="grid h-10 w-10 place-items-center rounded-full font-bold" :class="fila.posicion <= 3 ? 'bg-quiniela-dorado text-quiniela-grisTexto' : 'bg-green-50 text-quiniela-verde'">{{ fila.posicion }}</span>
        <div class="min-w-0">
          <p class="truncate font-bold text-quiniela-verdeOscuro">{{ nombreParticipante(fila) }}</p>
          <p class="text-xs text-gray-500 sm:hidden">{{ fila.aciertos }} aciertos</p>
          <span v-if="esLider(fila)" class="mt-1 inline-block rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-900">Va ganando</span>
          <span v-else-if="esPorTarugo(fila)" class="mt-1 inline-block rounded-full bg-red-400 px-2 py-0.5 text-[10px] font-bold text-white">Por tarugo</span>
        </div>
        <strong class="hidden text-right text-quiniela-verde sm:block">{{ fila.aciertos }} aciertos</strong>
        <button v-if="bloqueada && obtenerPronosticosFn" type="button" @click="alternar(fila)" class="rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-semibold text-quiniela-verde hover:bg-green-50" :aria-expanded="abiertaId === fila.quiniela_id">
          {{ abiertaId === fila.quiniela_id ? 'Ocultar' : 'Pronósticos' }}
        </button>
        <strong v-else class="text-right text-quiniela-verde sm:hidden">{{ fila.aciertos }}</strong>
      </div>

      <div v-if="abiertaId === fila.quiniela_id" class="border-t border-gray-100 bg-gray-50 p-3 sm:p-4">
        <p v-if="cargandoDetalle === fila.quiniela_id" class="text-center text-sm text-gray-500">Cargando pronósticos…</p>
        <p v-else-if="errorDetalle[fila.quiniela_id]" class="text-center text-sm text-red-600">{{ errorDetalle[fila.quiniela_id] }}</p>
        <DetallePronosticos v-else :items="detalles[fila.quiniela_id]" />
      </div>
    </article>
  </div>
  <div v-else class="empty-state">La tabla de posiciones aparecerá cuando existan entradas pagadas.</div>
</template>
