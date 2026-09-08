<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { supabase } from '@/lib/supabase';
import TablaPosiciones from '@/modules/quinielas/components/TablaPosiciones.vue';

const route = useRoute();
const jornadaId = route.params.jornadaId;
const jornada = ref(null);
const partidos = ref([]);
const cargando = ref(true);
const error = ref('');
let intervalo;

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

function formatoMoneda(valor) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(valor ?? 0);
}

async function actualizar() {
  try {
    await cargar();
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
    </header>

    <section class="grid gap-2">
      <div v-for="p in partidos" :key="p.id" class="flex flex-col gap-2 rounded-xl bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <span><small class="block text-gray-500">{{ p.liga_nombre }}</small>{{ p.equipo_local }} vs {{ p.equipo_visitante }}</span>
        <span class="w-fit rounded-full bg-green-50 px-3 py-1 font-bold text-quiniela-verde">{{ p.resultado_oficial === 'L' ? 'Local' : p.resultado_oficial === 'E' ? 'Empate' : p.resultado_oficial === 'V' ? 'Visita' : 'Pendiente' }}</span>
      </div>
      <p v-if="!partidos.length" class="empty-state">Esta jornada todavía no tiene partidos.</p>
    </section>

    <section>
      <h2 class="mb-2 text-xl font-bold text-quiniela-verdeOscuro">Tabla de posiciones</h2>
      <TablaPosiciones :jornadaId="jornadaId" :obtenerRankingFn="obtenerRankingPublico" />
    </section>
    <p class="text-center text-xs text-gray-500">Los resultados se actualizan automáticamente cada 30 segundos.</p>
    </template>
  </main>
</template>
