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
  <div class="p-6 max-w-2xl mx-auto space-y-6">
    <h1 class="text-2xl font-bold text-quiniela-verdeOscuro text-center">{{ jornada?.nombre }}</h1>

    <div class="grid gap-2">
      <div v-for="p in partidos" :key="p.id" class="bg-white rounded-lg shadow p-3 flex justify-between items-center">
        <span>{{ p.liga_nombre }}: {{ p.equipo_local }} vs {{ p.equipo_visitante }}</span>
        <span class="font-bold text-quiniela-verde">{{ p.resultado_oficial ?? '—' }}</span>
      </div>
    </div>

    <div>
      <h2 class="font-semibold text-quiniela-verde mb-2">Tabla de posiciones</h2>
      <TablaPosiciones :jornadaId="jornadaId" :obtenerRankingFn="obtenerRankingPublico" />
    </div>
  </div>
</template>
