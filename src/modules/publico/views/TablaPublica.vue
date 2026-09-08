<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { supabase } from '@/lib/supabase';
import TablaPosiciones from '@/modules/quinielas/components/TablaPosiciones.vue';

const route = useRoute();
const jornadaId = route.params.jornadaId;
const jornada = ref(null);
const partidos = ref([]);
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
  const { data: j } = await supabase.from('jornadas').select('nombre').eq('id', jornadaId).single();
  jornada.value = j;
  const { data: p } = await supabase.from('partidos').select('*').eq('jornada_id', jornadaId).order('fecha_partido');
  partidos.value = p ?? [];
}

onMounted(() => {
  cargar();
  intervalo = setInterval(cargar, 30000);
});
onUnmounted(() => clearInterval(intervalo));
</script>

<template>
  <main class="page-shell max-w-3xl">
    <h1 class="page-title text-center">{{ jornada?.nombre }}</h1>

    <div class="grid gap-2">
      <div v-for="p in partidos" :key="p.id" class="flex flex-col gap-2 rounded-xl bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <span><small class="block text-gray-500">{{ p.liga_nombre }}</small>{{ p.equipo_local }} vs {{ p.equipo_visitante }}</span>
        <span class="w-fit rounded-full bg-green-50 px-3 py-1 font-bold text-quiniela-verde">{{ p.resultado_oficial === 'L' ? 'Local' : p.resultado_oficial === 'E' ? 'Empate' : p.resultado_oficial === 'V' ? 'Visita' : 'Pendiente' }}</span>
      </div>
    </div>

    <div>
      <h2 class="font-semibold text-quiniela-verde mb-2">Tabla de posiciones</h2>
      <TablaPosiciones :jornadaId="jornadaId" :obtenerRankingFn="obtenerRankingPublico" />
    </div>
  </main>
</template>
