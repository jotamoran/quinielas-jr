<script setup>
import { computed, ref, onMounted } from 'vue';
import { supabase } from '@/lib/supabase';
import { obtenerMisQuinielas, obtenerRanking, obtenerJornadaActiva, obtenerPartidos, obtenerPronosticosDeQuiniela } from '../services/quinielasService';
import { calcularResumenBalance } from '../utils/balance';
import TablaPosiciones from '../components/TablaPosiciones.vue';
import DetallePronosticos from '../components/DetallePronosticos.vue';

const quinielas = ref([]);
const resumen = ref(null);
const jornadaActiva = ref(null);
const partidosJornadaActiva = ref([]);
const abiertaEntrada = ref(null);
const detallesEntrada = ref({});
const cargandoEntrada = ref(null);
const errorEntrada = ref({});

async function alternarDetalleEntrada(quiniela) {
  if (abiertaEntrada.value === quiniela.id) {
    abiertaEntrada.value = null;
    return;
  }
  abiertaEntrada.value = quiniela.id;
  if (detallesEntrada.value[quiniela.id]) return;
  cargandoEntrada.value = quiniela.id;
  delete errorEntrada.value[quiniela.id];
  try {
    detallesEntrada.value[quiniela.id] = await obtenerPronosticosDeQuiniela(quiniela.id);
  } catch (error) {
    errorEntrada.value[quiniela.id] = error.message;
  } finally {
    cargandoEntrada.value = null;
  }
}

async function cargar() {
  quinielas.value = await obtenerMisQuinielas();
  resumen.value = calcularResumenBalance(quinielas.value);
  jornadaActiva.value = await obtenerJornadaActiva();
  partidosJornadaActiva.value = jornadaActiva.value ? await obtenerPartidos(jornadaActiva.value.id) : [];
}

const jornadaActivaId = computed(() => jornadaActiva.value?.id ?? null);
const tengoEntradaEnJornadaActiva = computed(() => quinielas.value.some((q) => q.jornada_id === jornadaActivaId.value));
const bloqueada = computed(() => jornadaActiva.value && new Date(jornadaActiva.value.fecha_cierre) <= new Date());
const empezaronPartidos = computed(() => partidosJornadaActiva.value.some((p) => new Date(p.fecha_partido) <= new Date()));
const mostrarDestacados = computed(() => bloqueada.value || empezaronPartidos.value);

async function obtenerPronosticosPublicos(quinielaId) {
  const { data, error: queryError } = await supabase
    .from('vista_pronosticos_publicos')
    .select('partido_id, pronostico')
    .eq('jornada_id', jornadaActivaId.value)
    .eq('quiniela_id', quinielaId);
  if (queryError) throw queryError;
  const porPartido = new Map((data ?? []).map((item) => [item.partido_id, item.pronostico]));
  return partidosJornadaActiva.value.map((partido) => ({
    partido_id: partido.id,
    equipo_local: partido.equipo_local,
    equipo_visitante: partido.equipo_visitante,
    logo_local: partido.logo_local,
    logo_visitante: partido.logo_visitante,
    pronostico: porPartido.get(partido.id),
  }));
}

onMounted(cargar);
</script>

<template>
  <main class="page-shell max-w-4xl">
    <header><p class="eyebrow">Mi cuenta</p><h1 class="page-title">Mis quinielas</h1><p class="page-description">Consulta tus entradas, pagos y resultados.</p></header>

    <div v-if="resumen" class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="bg-white rounded-lg shadow p-4 text-center">
        <p class="text-xs text-gray-500">Gastado</p>
        <p class="text-xl font-bold text-quiniela-verde">${{ resumen.totalGastado }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4 text-center">
        <p class="text-xs text-gray-500">Jornadas jugadas</p>
        <p class="text-xl font-bold text-quiniela-verde">{{ resumen.jornadasJugadas }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4 text-center">
        <p class="text-xs text-gray-500">Aciertos promedio</p>
        <p class="text-xl font-bold text-quiniela-verde">{{ resumen.aciertosPromedio }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4 text-center">
        <p class="text-xs text-gray-500">Mejor posición</p>
        <p class="text-xl font-bold text-quiniela-dorado">{{ resumen.mejorPosicion ?? '—' }}</p>
      </div>
    </div>

    <p v-if="quinielas.some((q) => q.estatus_pago !== 'aprobado')" class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      Solo participan en el sorteo y en la tabla de posiciones las quinielas con el pago confirmado. Si una entrada tuya aparece como <b>Pendiente</b>, complétala pagando (o preséntate con quien organiza) para poder participar.
    </p>

    <div v-if="quinielas.length" class="grid gap-3 sm:hidden">
      <article v-for="q in quinielas" :key="q.id" class="rounded-2xl bg-white p-4 shadow-sm">
        <div class="flex items-start justify-between gap-3"><div><p class="font-bold text-quiniela-verdeOscuro">{{ q.alias }}</p><p class="text-sm text-gray-500">{{ q.jornadas?.nombre }}</p></div><span class="rounded-full px-2 py-1 text-xs font-bold" :class="q.estatus_pago === 'aprobado' ? 'bg-green-100 text-green-800' : q.estatus_pago === 'rechazado' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'">{{ q.estatus_pago === 'aprobado' ? 'Pagada' : q.estatus_pago === 'rechazado' ? 'Cancelada' : 'Pendiente' }}</span></div>
        <p v-if="q.estatus_pago !== 'aprobado'" class="mt-2 text-xs text-amber-700">No estás participando todavía — falta confirmar tu pago.</p>
        <p class="mt-4 border-t pt-3 text-sm"><span class="text-gray-500">Aciertos:</span> <strong class="text-quiniela-verde">{{ q.aciertos }}</strong></p>
        <button type="button" @click="alternarDetalleEntrada(q)" class="mt-3 w-full rounded-lg border border-gray-200 py-2 text-xs font-semibold text-quiniela-verde">{{ abiertaEntrada === q.id ? 'Ocultar' : 'Ver pronósticos' }}</button>
        <div v-if="abiertaEntrada === q.id" class="mt-3 border-t pt-3">
          <p v-if="cargandoEntrada === q.id" class="text-center text-sm text-gray-500">Cargando pronósticos…</p>
          <p v-else-if="errorEntrada[q.id]" class="text-center text-sm text-red-600">{{ errorEntrada[q.id] }}</p>
          <DetallePronosticos v-else :items="detallesEntrada[q.id]" />
        </div>
      </article>
    </div>
    <div v-if="quinielas.length" class="hidden overflow-x-auto sm:block">
      <table class="w-full bg-white rounded-lg shadow overflow-hidden">
        <thead class="bg-quiniela-verdeOscuro text-white">
          <tr>
            <th class="px-4 py-2 text-left">Jornada</th>
            <th class="px-4 py-2 text-left">Entrada</th>
            <th class="px-4 py-2 text-left">Pago</th>
            <th class="px-4 py-2 text-right">Aciertos</th>
            <th class="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="q in quinielas" :key="q.id">
            <tr class="border-b">
              <td class="px-4 py-2">{{ q.jornadas?.nombre }}</td>
              <td class="px-4 py-2">{{ q.alias }}</td>
              <td class="px-4 py-2">{{ q.estatus_pago === 'aprobado' ? 'Pagada' : q.estatus_pago === 'rechazado' ? 'Cancelada' : 'Pendiente' }}<span v-if="q.estatus_pago !== 'aprobado'" class="ml-2 text-xs text-amber-700">(no participa todavía)</span></td>
              <td class="px-4 py-2 text-right">{{ q.aciertos }}</td>
              <td class="px-4 py-2 text-right"><button type="button" @click="alternarDetalleEntrada(q)" class="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-quiniela-verde">{{ abiertaEntrada === q.id ? 'Ocultar' : 'Ver pronósticos' }}</button></td>
            </tr>
            <tr v-if="abiertaEntrada === q.id" class="border-b bg-gray-50">
              <td colspan="5" class="p-4">
                <p v-if="cargandoEntrada === q.id" class="text-center text-sm text-gray-500">Cargando pronósticos…</p>
                <p v-else-if="errorEntrada[q.id]" class="text-center text-sm text-red-600">{{ errorEntrada[q.id] }}</p>
                <DetallePronosticos v-else :items="detallesEntrada[q.id]" />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <div v-if="!quinielas.length" class="empty-state">Aún no has registrado una quiniela.</div>

    <div v-if="jornadaActivaId && tengoEntradaEnJornadaActiva">
      <h2 class="font-semibold text-quiniela-verde mb-2">Tabla de posiciones</h2>
      <TablaPosiciones :jornadaId="jornadaActivaId" :obtenerRankingFn="obtenerRanking" :obtenerPronosticosFn="obtenerPronosticosPublicos" :bloqueada="bloqueada" :resaltarExtremos="mostrarDestacados" />
    </div>
  </main>
</template>
