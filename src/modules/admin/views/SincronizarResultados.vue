<script setup>
import { computed, onMounted, ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { guardarResultadosManuales, sincronizarResultados } from '../services/adminService';
import { alertaAdvertencia, alertaError, alertaExito } from '@/lib/alertas';
import EsqueletoCarga from '@/components/EsqueletoCarga.vue';
import { formatearFecha } from '@/lib/fechas';

const jornadas = ref([]);
const jornadaSeleccionada = ref(null);
const partidos = ref([]);
const resultados = ref({});
const cargando = ref(false);
const cargandoInicial = ref(true);
const accionEnCurso = ref('');
const opciones = [{ value: 'L', label: 'Local' }, { value: 'E', label: 'Empate' }, { value: 'V', label: 'Visita' }];
const cambiosPendientes = computed(() => partidos.value.filter((p) => resultados.value[p.id] && resultados.value[p.id] !== p.resultado_oficial));

async function cargar() {
  const { data, error: queryError } = await supabase.from('jornadas').select('id, nombre, estatus').not('estatus', 'in', '(finalizada,cancelada)').order('creado_el', { ascending: false });
  if (queryError) throw queryError;
  jornadas.value = data ?? [];
}

async function abrirJornada(jornada) {
  jornadaSeleccionada.value = jornada;
  const { data, error: queryError } = await supabase.from('partidos').select('id, liga_nombre, equipo_local, equipo_visitante, logo_local, logo_visitante, fecha_partido, resultado_oficial, estado, puntos_local, puntos_visitante, provider, cancelado').eq('jornada_id', jornada.id).order('fecha_partido');
  if (queryError) {
    await alertaError(queryError, 'No se pudieron cargar los partidos');
    return;
  }
  partidos.value = data ?? [];
  resultados.value = Object.fromEntries(partidos.value.filter((partido) => partido.resultado_oficial).map((partido) => [partido.id, partido.resultado_oficial]));
}

async function sincronizar() {
  cargando.value = true;
  accionEnCurso.value = 'sincronizar';
  try {
    const response = await sincronizarResultados(jornadaSeleccionada.value.id);
    await abrirJornada(jornadaSeleccionada.value);
    await alertaExito('Resultados sincronizados', `${response.actualizados} resultado(s) actualizado(s) automáticamente.`);
  } catch (e) {
    await alertaError(e, 'No se pudieron sincronizar los resultados');
  } finally {
    cargando.value = false;
    accionEnCurso.value = '';
  }
}

async function guardarManuales() {
  const cambios = partidos.value
    .filter((partido) => resultados.value[partido.id] && resultados.value[partido.id] !== partido.resultado_oficial)
    .map((partido) => ({ partido_id: partido.id, resultado: resultados.value[partido.id] }));
  if (!cambios.length) {
    await alertaAdvertencia('No hay cambios', 'Selecciona o modifica al menos un resultado antes de guardar.');
    return;
  }
  cargando.value = true;
  accionEnCurso.value = 'guardar';
  try {
    const response = await guardarResultadosManuales(jornadaSeleccionada.value.id, cambios);
    await abrirJornada(jornadaSeleccionada.value);
    await alertaExito('Resultados guardados', `${response.actualizados} resultado(s) actualizado(s) y puntos recalculados.`);
  } catch (e) {
    await alertaError(e, 'No se pudieron guardar los resultados');
  } finally {
    cargando.value = false;
    accionEnCurso.value = '';
  }
}

function fechaPartido(fecha) {
  return formatearFecha(fecha, { dateStyle: 'medium', timeStyle: 'short' });
}

onMounted(async () => {
  try { await cargar(); } catch (e) { await alertaError(e, 'No se pudieron cargar las jornadas'); } finally { cargandoInicial.value = false; }
});
</script>

<template>
  <main class="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
    <header><p class="text-sm font-semibold uppercase tracking-widest text-quiniela-verde">Administración</p><h1 class="text-3xl font-bold text-quiniela-verdeOscuro">Resultados de partidos</h1><p class="mt-1 text-gray-600">Actualiza resultados automáticamente o captura el resultado manualmente.</p></header>

    <EsqueletoCarga v-if="cargandoInicial" />
    <section v-else-if="!jornadaSeleccionada" class="grid gap-3 sm:grid-cols-2">
      <button v-for="jornada in jornadas" :key="jornada.id" @click="abrirJornada(jornada)" class="rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-quiniela-verde"><p class="font-bold text-quiniela-verdeOscuro">{{ jornada.nombre }}</p><p class="mt-1 text-sm capitalize text-gray-500">{{ jornada.estatus }}</p></button>
      <p v-if="!jornadas.length" class="text-gray-500">No hay jornadas pendientes.</p>
    </section>

    <template v-else>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><button @click="jornadaSeleccionada = null" :disabled="cargando" class="text-left text-sm font-semibold text-quiniela-verde disabled:opacity-50">← Ver jornadas</button><button @click="sincronizar" :disabled="cargando" class="rounded-xl border border-quiniela-verde px-4 py-2 font-semibold text-quiniela-verde disabled:opacity-50">{{ accionEnCurso === 'sincronizar' ? 'Sincronizando…' : 'Actualizar automáticamente' }}</button></div>
      <h2 class="text-xl font-bold text-quiniela-verdeOscuro">{{ jornadaSeleccionada.nombre }}</h2>

      <section class="space-y-3">
        <article v-for="partido in partidos" :key="partido.id" class="rounded-2xl border p-4 shadow-sm" :class="partido.cancelado ? 'border-red-200 bg-red-50/50' : 'border-gray-200 bg-white'">
          <div class="mb-3 flex flex-wrap justify-between gap-2 text-xs text-gray-500"><span>{{ partido.liga_nombre }} · {{ partido.provider === 'manual' ? 'Manual' : 'Automático' }}</span><span>{{ fechaPartido(partido.fecha_partido) }}</span></div>
          <div class="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <div class="min-w-0"><img v-if="partido.logo_local" :src="partido.logo_local" alt="" loading="lazy" decoding="async" class="mx-auto mb-2 h-10 w-10 object-contain" /><div v-else class="mx-auto mb-2 h-10 w-10 rounded-full bg-gray-100"></div><p class="flex min-h-10 items-start justify-center break-words text-sm font-bold leading-tight text-quiniela-verdeOscuro">{{ partido.equipo_local }}</p></div>
            <span v-if="partido.puntos_local != null || partido.puntos_visitante != null" class="text-lg font-bold tabular-nums text-quiniela-verdeOscuro">{{ partido.puntos_local ?? '—' }} - {{ partido.puntos_visitante ?? '—' }}</span><span v-else class="text-xs font-bold text-gray-400">VS</span>
            <div class="min-w-0"><img v-if="partido.logo_visitante" :src="partido.logo_visitante" alt="" loading="lazy" decoding="async" class="mx-auto mb-2 h-10 w-10 object-contain" /><div v-else class="mx-auto mb-2 h-10 w-10 rounded-full bg-gray-100"></div><p class="flex min-h-10 items-start justify-center break-words text-sm font-bold leading-tight text-quiniela-verdeOscuro">{{ partido.equipo_visitante }}</p></div>
          </div>
          <p v-if="partido.cancelado" class="rounded-xl bg-red-50 py-3 text-center text-sm font-bold text-red-700">Cancelado — no se le captura resultado</p><p v-else-if="partido.estado === 'en_vivo'" class="rounded-xl bg-red-50 py-3 text-center text-sm font-bold text-red-700">En vivo — marcador actualizado automáticamente</p><p v-else-if="partido.estado === 'finalizado'" class="rounded-xl bg-green-50 py-3 text-center text-sm font-bold text-quiniela-verde">Finalizado</p>
          <div v-else class="grid grid-cols-3 gap-2" role="radiogroup" :aria-label="`Resultado de ${partido.equipo_local} contra ${partido.equipo_visitante}`"><button v-for="opcion in opciones" :key="opcion.value" type="button" @click="resultados[partido.id] = opcion.value" :aria-pressed="resultados[partido.id] === opcion.value" class="min-h-11 rounded-xl border px-2 py-2 text-sm font-semibold" :class="resultados[partido.id] === opcion.value ? 'border-quiniela-doradoOscuro bg-quiniela-dorado text-quiniela-grisTexto' : 'border-gray-300 text-gray-600'">{{ opcion.label }}</button></div>
        </article>
      </section>

      <div v-if="cambiosPendientes.length" class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><p class="font-bold">Vista previa</p><p class="mt-1">Se actualizarán {{ cambiosPendientes.length }} resultado(s): {{ cambiosPendientes.map((p) => `${p.equipo_local}–${p.equipo_visitante}`).join(', ') }}.</p></div>
      <button @click="guardarManuales" :disabled="cargando || !cambiosPendientes.length" class="sticky bottom-3 w-full rounded-xl bg-quiniela-verde py-3 font-bold text-white shadow-lg disabled:opacity-50">{{ accionEnCurso === 'guardar' ? 'Guardando…' : 'Guardar resultados manuales' }}</button>
    </template>
  </main>
</template>
