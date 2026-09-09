<script setup>
import { onMounted, ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { guardarResultadosManuales, sincronizarResultados } from '../services/adminService';

const jornadas = ref([]);
const jornadaSeleccionada = ref(null);
const partidos = ref([]);
const resultados = ref({});
const mensaje = ref('');
const error = ref('');
const cargando = ref(false);
const opciones = [{ value: 'L', label: 'Local' }, { value: 'E', label: 'Empate' }, { value: 'V', label: 'Visita' }];

async function cargar() {
  const { data, error: queryError } = await supabase.from('jornadas').select('id, nombre, estatus').neq('estatus', 'finalizada').order('creado_el', { ascending: false });
  if (queryError) throw queryError;
  jornadas.value = data ?? [];
}

async function abrirJornada(jornada) {
  jornadaSeleccionada.value = jornada;
  mensaje.value = '';
  error.value = '';
  const { data, error: queryError } = await supabase.from('partidos').select('id, liga_nombre, equipo_local, equipo_visitante, logo_local, logo_visitante, fecha_partido, resultado_oficial, provider').eq('jornada_id', jornada.id).order('fecha_partido');
  if (queryError) {
    error.value = queryError.message;
    return;
  }
  partidos.value = data ?? [];
  resultados.value = Object.fromEntries(partidos.value.filter((partido) => partido.resultado_oficial).map((partido) => [partido.id, partido.resultado_oficial]));
}

async function sincronizar() {
  cargando.value = true;
  mensaje.value = '';
  error.value = '';
  try {
    const response = await sincronizarResultados(jornadaSeleccionada.value.id);
    await abrirJornada(jornadaSeleccionada.value);
    mensaje.value = `${response.actualizados} resultado(s) sincronizado(s) desde TheSportsDB.`;
  } catch (e) {
    error.value = e.message;
  } finally {
    cargando.value = false;
  }
}

async function guardarManuales() {
  const cambios = partidos.value
    .filter((partido) => resultados.value[partido.id] && resultados.value[partido.id] !== partido.resultado_oficial)
    .map((partido) => ({ partido_id: partido.id, resultado: resultados.value[partido.id] }));
  if (!cambios.length) {
    error.value = 'No hay resultados nuevos o modificados para guardar.';
    return;
  }
  cargando.value = true;
  mensaje.value = '';
  error.value = '';
  try {
    const response = await guardarResultadosManuales(jornadaSeleccionada.value.id, cambios);
    await abrirJornada(jornadaSeleccionada.value);
    mensaje.value = `${response.actualizados} resultado(s) guardado(s) y puntos recalculados.`;
  } catch (e) {
    error.value = e.message;
  } finally {
    cargando.value = false;
  }
}

function fechaPartido(fecha) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(fecha));
}

onMounted(async () => {
  try { await cargar(); } catch (e) { error.value = e.message; }
});
</script>

<template>
  <main class="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
    <header><p class="text-sm font-semibold uppercase tracking-widest text-quiniela-verde">Administración</p><h1 class="text-3xl font-bold text-quiniela-verdeOscuro">Resultados de partidos</h1><p class="mt-1 text-gray-600">Sincroniza TheSportsDB o captura el resultado manualmente.</p></header>

    <div v-if="error" role="alert" class="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{{ error }}</div>
    <div v-if="mensaje" role="status" class="rounded-xl border border-green-200 bg-green-50 p-3 text-green-800">{{ mensaje }}</div>

    <section v-if="!jornadaSeleccionada" class="grid gap-3 sm:grid-cols-2">
      <button v-for="jornada in jornadas" :key="jornada.id" @click="abrirJornada(jornada)" class="rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-quiniela-verde"><p class="font-bold text-quiniela-verdeOscuro">{{ jornada.nombre }}</p><p class="mt-1 text-sm capitalize text-gray-500">{{ jornada.estatus }}</p></button>
      <p v-if="!jornadas.length" class="text-gray-500">No hay jornadas pendientes.</p>
    </section>

    <template v-else>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><button @click="jornadaSeleccionada = null" class="text-left text-sm font-semibold text-quiniela-verde">← Ver jornadas</button><button @click="sincronizar" :disabled="cargando" class="rounded-xl border border-quiniela-verde px-4 py-2 font-semibold text-quiniela-verde disabled:opacity-50">Sincronizar TheSportsDB</button></div>
      <h2 class="text-xl font-bold text-quiniela-verdeOscuro">{{ jornadaSeleccionada.nombre }}</h2>

      <section class="space-y-3">
        <article v-for="partido in partidos" :key="partido.id" class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div class="mb-3 flex flex-wrap justify-between gap-2 text-xs text-gray-500"><span>{{ partido.liga_nombre }} · {{ partido.provider === 'manual' ? 'Manual' : 'TheSportsDB' }}</span><span>{{ fechaPartido(partido.fecha_partido) }}</span></div>
          <div class="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <div><img v-if="partido.logo_local" :src="partido.logo_local" alt="" class="mx-auto mb-2 h-10 w-10 object-contain" /><div v-else class="mx-auto mb-2 h-10 w-10 rounded-full bg-gray-100"></div><p class="text-sm font-bold text-quiniela-verdeOscuro">{{ partido.equipo_local }}</p></div>
            <span class="text-xs font-bold text-gray-400">VS</span>
            <div><img v-if="partido.logo_visitante" :src="partido.logo_visitante" alt="" class="mx-auto mb-2 h-10 w-10 object-contain" /><div v-else class="mx-auto mb-2 h-10 w-10 rounded-full bg-gray-100"></div><p class="text-sm font-bold text-quiniela-verdeOscuro">{{ partido.equipo_visitante }}</p></div>
          </div>
          <div class="grid grid-cols-3 gap-2"><button v-for="opcion in opciones" :key="opcion.value" @click="resultados[partido.id] = opcion.value" class="min-h-11 rounded-xl border px-2 py-2 text-sm font-semibold" :class="resultados[partido.id] === opcion.value ? 'border-quiniela-doradoOscuro bg-quiniela-dorado text-quiniela-grisTexto' : 'border-gray-300 text-gray-600'">{{ opcion.label }}</button></div>
        </article>
      </section>

      <button @click="guardarManuales" :disabled="cargando" class="sticky bottom-3 w-full rounded-xl bg-quiniela-verde py-3 font-bold text-white shadow-lg disabled:opacity-50">{{ cargando ? 'Guardando…' : 'Guardar resultados manuales' }}</button>
    </template>
  </main>
</template>
