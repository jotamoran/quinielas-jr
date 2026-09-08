<script setup>
import { ref, onMounted, watch } from 'vue';

const props = defineProps({
  jornadaId: { type: String, required: true },
  obtenerRankingFn: { type: Function, required: true },
  obtenerPronosticosFn: { type: Function, default: null },
  bloqueada: { type: Boolean, default: false },
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

function etiquetaPronostico(valor) {
  return { L: 'Local', E: 'Empate', V: 'Visita' }[valor] ?? valor;
}

onMounted(cargar);
watch(() => props.jornadaId, cargar);

defineExpose({ recargar: cargar });
</script>

<template>
  <div v-if="filas.length" class="space-y-2">
    <article v-for="fila in filas" :key="fila.quiniela_id ?? fila.mostrar_como" class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div class="grid grid-cols-[42px_1fr_auto] items-center gap-3 p-3.5 sm:grid-cols-[56px_1fr_110px_auto] sm:px-5">
        <span class="grid h-10 w-10 place-items-center rounded-full font-bold" :class="fila.posicion <= 3 ? 'bg-quiniela-dorado text-quiniela-grisTexto' : 'bg-green-50 text-quiniela-verde'">{{ fila.posicion }}</span>
        <div class="min-w-0"><p class="truncate font-bold text-quiniela-verdeOscuro">{{ nombreParticipante(fila) }}</p><p class="text-xs text-gray-500 sm:hidden">{{ fila.aciertos }} aciertos</p></div>
        <strong class="hidden text-right text-quiniela-verde sm:block">{{ fila.aciertos }} aciertos</strong>
        <button v-if="bloqueada && obtenerPronosticosFn" type="button" @click="alternar(fila)" class="rounded-lg border border-gray-200 px-2.5 py-2 text-xs font-semibold text-quiniela-verde hover:bg-green-50" :aria-expanded="abiertaId === fila.quiniela_id">
          {{ abiertaId === fila.quiniela_id ? 'Ocultar' : 'Pronósticos' }}
        </button>
        <strong v-else class="text-right text-quiniela-verde sm:hidden">{{ fila.aciertos }}</strong>
      </div>

      <div v-if="abiertaId === fila.quiniela_id" class="border-t border-gray-100 bg-gray-50 p-3 sm:p-4">
        <p v-if="cargandoDetalle === fila.quiniela_id" class="text-center text-sm text-gray-500">Cargando pronósticos…</p>
        <p v-else-if="errorDetalle[fila.quiniela_id]" class="text-center text-sm text-red-600">{{ errorDetalle[fila.quiniela_id] }}</p>
        <div v-else class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="(detalle, index) in detalles[fila.quiniela_id]" :key="detalle.partido_id" class="flex items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm">
            <div class="min-w-0"><span class="text-xs text-gray-400">{{ index + 1 }}</span><p class="truncate font-semibold">{{ detalle.equipo_local }} vs {{ detalle.equipo_visitante }}</p></div>
            <span class="shrink-0 rounded-full bg-green-50 px-2 py-1 text-xs font-bold text-quiniela-verde">{{ etiquetaPronostico(detalle.pronostico) }}</span>
          </div>
        </div>
      </div>
    </article>
  </div>
  <div v-else class="empty-state">La tabla de posiciones aparecerá cuando existan entradas pagadas.</div>
</template>
