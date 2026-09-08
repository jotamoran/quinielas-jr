<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { supabase } from '@/lib/supabase';
import TablaPosiciones from '@/modules/quinielas/components/TablaPosiciones.vue';

const route = useRoute();
const jornadaId = route.params.jornadaId;
const jornada = ref(null);
const partidos = ref([]);
const cargando = ref(true);
const error = ref('');
const tablaPosiciones = ref(null);
let intervalo;
const bloqueada = computed(() => jornada.value && new Date(jornada.value.fecha_cierre) <= new Date());

async function obtenerRankingPublico(jId) {
  const { data, error } = await supabase
    .from('vista_ranking_publica')
    .select('*')
    .eq('jornada_id', jId)
    .order('posicion');
  if (error) throw error;
  return data;
}

async function cargar() {
  const { data: j, error: jornadaError } = await supabase.from('jornadas').select('nombre, premio, fecha_cierre, estatus').eq('id', jornadaId).maybeSingle();
  if (jornadaError) throw jornadaError;
  if (!j) throw new Error('La jornada no existe o ya no está disponible.');
  jornada.value = j;
  const { data: p, error: partidosError } = await supabase.from('partidos').select('*').eq('jornada_id', jornadaId).order('fecha_partido');
  if (partidosError) throw partidosError;
  partidos.value = p ?? [];
}

async function obtenerPronosticosPublicos(quinielaId) {
  const { data, error: queryError } = await supabase
    .from('vista_pronosticos_publicos')
    .select('partido_id, pronostico')
    .eq('jornada_id', jornadaId)
    .eq('quiniela_id', quinielaId);
  if (queryError) throw queryError;
  const porPartido = new Map((data ?? []).map((item) => [item.partido_id, item.pronostico]));
  return partidos.value.map((partido) => ({
    partido_id: partido.id,
    equipo_local: partido.equipo_local,
    equipo_visitante: partido.equipo_visitante,
    pronostico: porPartido.get(partido.id),
  }));
}

function formatoMoneda(valor) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(valor ?? 0);
}

function formatoFecha(fecha) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(fecha));
}

async function actualizar() {
  try {
    await cargar();
    await tablaPosiciones.value?.recargar();
    error.value = '';
  } catch (e) {
    error.value = e.message;
  } finally {
    cargando.value = false;
  }
}

onMounted(() => {
  actualizar();
  intervalo = setInterval(actualizar, 30000);
});
onUnmounted(() => clearInterval(intervalo));
</script>

<template>
  <main class="page-shell max-w-3xl">
    <div v-if="cargando" class="empty-state">Cargando resultados…</div>
    <div v-else-if="error" role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">{{ error }}</div>

    <template v-else>
    <header class="rounded-2xl bg-quiniela-verdeOscuro p-5 text-center text-white shadow-lg sm:p-7">
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-green-200">Tabla general</p>
      <h1 class="mt-1 text-3xl font-bold">{{ jornada?.nombre }}</h1>
      <div class="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
        <span class="text-sm text-green-100">Premio</span>
        <strong class="text-xl text-quiniela-dorado">{{ formatoMoneda(jornada?.premio) }}</strong>
      </div>
      <p class="mt-4 text-sm text-green-100">Cierre de registro: {{ formatoFecha(jornada?.fecha_cierre) }}</p>
      <span class="mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold" :class="bloqueada ? 'bg-white/15 text-white' : 'bg-green-200 text-quiniela-verdeOscuro'">{{ bloqueada ? 'Registro cerrado' : 'Registro abierto' }}</span>
    </header>

    <section class="space-y-3">
      <div><p class="eyebrow">Clasificación</p><h2 class="text-2xl font-bold text-quiniela-verdeOscuro">Tabla de posiciones</h2></div>
      <p v-if="!bloqueada" class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Los pronósticos de cada participante estarán disponibles cuando cierre el registro.</p>
      <TablaPosiciones ref="tablaPosiciones" :jornadaId="jornadaId" :obtenerRankingFn="obtenerRankingPublico" :obtenerPronosticosFn="obtenerPronosticosPublicos" :bloqueada="bloqueada" />
    </section>

    <section class="space-y-3">
      <div><p class="eyebrow">Seguimiento</p><h2 class="text-2xl font-bold text-quiniela-verdeOscuro">Resultados al momento</h2></div>
      <div class="grid gap-3 sm:grid-cols-2">
        <article v-for="(p, index) in partidos" :key="p.id" class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div class="mb-3 flex items-center justify-between gap-2 text-xs text-gray-500"><span>Partido {{ index + 1 }} · {{ p.liga_nombre }}</span><span class="rounded-full px-2 py-1 font-bold" :class="p.resultado_oficial ? 'bg-green-50 text-quiniela-verde' : 'bg-gray-100'">{{ p.resultado_oficial ? 'Finalizado' : 'Pendiente' }}</span></div>
          <p class="text-center font-bold text-quiniela-verdeOscuro">{{ p.equipo_local }} <span class="mx-2 text-gray-400">vs</span> {{ p.equipo_visitante }}</p>
          <p v-if="p.resultado_oficial" class="mt-3 text-center text-sm font-semibold text-quiniela-verde">Ganador: {{ p.resultado_oficial === 'L' ? p.equipo_local : p.resultado_oficial === 'V' ? p.equipo_visitante : 'Empate' }}</p>
        </article>
      </div>
      <p v-if="!partidos.length" class="empty-state">Esta jornada todavía no tiene partidos.</p>
    </section>
    <p class="text-center text-xs text-gray-500">Los resultados se actualizan automáticamente cada 30 segundos.</p>
    </template>
  </main>
</template>
