<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useLoginModalStore } from '@/store/loginModal';
import TablaPosiciones from '@/modules/quinielas/components/TablaPosiciones.vue';
import EsqueletoCarga from '@/components/EsqueletoCarga.vue';

const route = useRoute();
const authStore = useAuthStore();
const loginModalStore = useLoginModalStore();
const jornadaId = computed(() => route.params.jornadaId);
const jornada = ref(null);
const partidos = ref([]);
const cargando = ref(true);
const error = ref('');
const tablaPosiciones = ref(null);
const actualizadoEl = ref(null);
let intervalo;
const esCancelada = computed(() => jornada.value?.estatus === 'cancelada');
const esDefinitiva = computed(() => jornada.value?.estatus === 'finalizada');
const bloqueada = computed(() => jornada.value && (jornada.value.estatus !== 'activa' || new Date(jornada.value.fecha_cierre) <= new Date()));
const empezaronPartidos = computed(() => partidos.value.some((p) => new Date(p.fecha_partido) <= new Date()));
const mostrarDestacados = computed(() => !esCancelada.value && (bloqueada.value || empezaronPartidos.value));

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
  const { data: j, error: jornadaError } = await supabase.from('vista_jornada_publica').select('id, nombre, premio, fecha_cierre, estatus').eq('id', jornadaId.value).maybeSingle();
  if (jornadaError) throw jornadaError;
  if (!j) throw new Error('La jornada no existe o ya no está disponible.');
  jornada.value = j;
  const { data: p, error: partidosError } = await supabase.from('partidos').select('id, liga_nombre, equipo_local, equipo_visitante, logo_local, logo_visitante, fecha_partido, resultado_oficial, estado, puntos_local, puntos_visitante, actualizado_el, cancelado').eq('jornada_id', jornadaId.value).order('fecha_partido');
  if (partidosError) throw partidosError;
  partidos.value = p ?? [];
}

async function obtenerPronosticosPublicos(quinielaId) {
  const { data, error: queryError } = await supabase
    .from('vista_pronosticos_publicos')
    .select('partido_id, pronostico')
    .eq('jornada_id', jornadaId.value)
    .eq('quiniela_id', quinielaId);
  if (queryError) throw queryError;
  const porPartido = new Map((data ?? []).map((item) => [item.partido_id, item.pronostico]));
  return partidos.value.map((partido) => ({
    partido_id: partido.id,
    equipo_local: partido.equipo_local,
    equipo_visitante: partido.equipo_visitante,
    logo_local: partido.logo_local,
    logo_visitante: partido.logo_visitante,
    pronostico: porPartido.get(partido.id),
    resultado_oficial: partido.resultado_oficial,
    estado: partido.estado,
    puntos_local: partido.puntos_local,
    puntos_visitante: partido.puntos_visitante,
    cancelado: partido.cancelado,
    fecha_partido: partido.fecha_partido,
  }));
}

function formatoMoneda(valor) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(valor ?? 0);
}

function formatoFecha(fecha) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'America/Mexico_City' }).format(new Date(fecha));
}

function formatoFechaPartido(fecha) {
  return new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' }).format(new Date(fecha));
}

function formatoActualizacion(fecha) {
  return fecha?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Mexico_City' }) ?? '';
}

async function actualizar() {
  try {
    await cargar();
    await tablaPosiciones.value?.recargar();
    actualizadoEl.value = new Date();
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
watch(jornadaId, actualizar);
onUnmounted(() => clearInterval(intervalo));
</script>

<template>
  <main class="page-shell max-w-3xl">
    <EsqueletoCarga v-if="cargando" :cantidad="4" />
    <div v-else-if="error" role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">{{ error }}</div>

    <template v-else>
    <header class="rounded-2xl bg-quiniela-verdeOscuro p-5 text-center text-white shadow-lg sm:p-7">
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-green-200">Resultados de la jornada</p>
      <h1 class="mt-1 text-3xl font-bold">{{ jornada?.nombre }}</h1>
      <div class="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
        <span class="text-sm text-green-100">Premio</span>
        <strong v-if="bloqueada && !esCancelada" class="text-xl text-quiniela-dorado">{{ formatoMoneda(jornada?.premio) }}</strong>
        <span v-else-if="esCancelada" class="text-sm italic text-green-100">Sin premio por cancelación</span>
        <span v-else class="text-sm italic text-green-100">Se revela al cierre del registro</span>
      </div>
      <p class="mt-4 text-sm text-green-100">Cierre de registro: {{ formatoFecha(jornada?.fecha_cierre) }}</p>
      <span v-if="jornada?.estatus !== 'cancelada'" class="mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold" :class="bloqueada ? 'bg-white/15 text-white' : 'bg-green-200 text-quiniela-verdeOscuro'">{{ bloqueada ? 'Registro cerrado' : 'Registro abierto' }}</span>
      <p v-if="jornada?.estatus === 'cancelada'" role="alert" class="mt-3 rounded-xl bg-red-500/90 px-3 py-2 text-sm font-bold text-white">Esta jornada fue cancelada.</p>
      <span v-else class="mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold" :class="esDefinitiva ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'">{{ esDefinitiva ? 'Resultado definitivo' : 'Resultados provisionales' }}</span>
    </header>

    <section class="space-y-3">
      <div><p class="eyebrow">Clasificación</p><h2 class="text-2xl font-bold text-quiniela-verdeOscuro">{{ esDefinitiva ? 'Tabla de posiciones' : 'Tabla de posiciones en vivo' }}</h2></div>
      <p v-if="!esCancelada && !bloqueada" class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Los pronósticos de cada participante estarán disponibles cuando cierre el registro.</p>
      <p v-if="!esCancelada && !esDefinitiva" class="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">Los aciertos y posiciones son provisionales: cambian con el marcador de los partidos en vivo. Los resultados oficiales solo se confirman al finalizar cada partido.</p>
      <p v-if="!esCancelada" class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Solo aparecen aquí las quinielas con el pago confirmado. Si registraste una entrada y no aparece en la tabla, debes completar tu pago para participar.</p>
      <div v-if="!bloqueada && jornada?.estatus !== 'cancelada'" class="flex flex-col items-start gap-2 rounded-xl border border-quiniela-verde bg-green-50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm font-semibold text-quiniela-verdeOscuro">{{ authStore.isLoggedIn ? '¿Todavía no te registras?' : 'Crea tu cuenta o inicia sesión para registrar una entrada' }}</p>
        <router-link v-if="authStore.isLoggedIn" :to="{ name: 'llenar-quiniela', params: { jornadaId } }" class="rounded-lg bg-quiniela-verde px-4 py-2 text-sm font-bold text-white">Registrar</router-link>
        <div v-else class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><router-link :to="{ name: 'registro' }" class="rounded-lg border border-quiniela-verde px-4 py-2 text-center text-sm font-bold text-quiniela-verde">Crear cuenta</router-link><button type="button" @click="loginModalStore.abrir()" class="rounded-lg bg-quiniela-verde px-4 py-2 text-sm font-bold text-white">Iniciar sesión</button></div>
      </div>
      <TablaPosiciones v-if="!esCancelada" ref="tablaPosiciones" :jornadaId="jornadaId" :obtenerRankingFn="obtenerRankingPublico" :obtenerPronosticosFn="obtenerPronosticosPublicos" :bloqueada="bloqueada" :resaltarExtremos="mostrarDestacados" />
      <p v-else class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">No hay clasificación ni pronósticos públicos porque esta jornada fue cancelada.</p>
    </section>

    <section class="space-y-3">
      <div><p class="eyebrow">Seguimiento</p><h2 class="text-2xl font-bold text-quiniela-verdeOscuro">Resultados al momento</h2></div>
      <div class="grid gap-3 sm:grid-cols-2">
        <article v-for="(p, index) in partidos" :key="p.id" class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div class="mb-1 flex items-center justify-between gap-2 text-xs text-gray-500"><span>Partido {{ index + 1 }} · {{ p.liga_nombre }}</span><span class="rounded-full px-2 py-1 font-bold" :class="p.cancelado ? 'bg-red-50 text-red-700' : p.estado === 'en_vivo' ? 'bg-red-100 text-red-700' : p.estado === 'finalizado' || p.resultado_oficial ? 'bg-green-50 text-quiniela-verde' : 'bg-gray-100 text-gray-600'">{{ p.cancelado ? 'Cancelado' : p.estado === 'en_vivo' ? 'En vivo' : p.estado === 'finalizado' || p.resultado_oficial ? 'Finalizado' : 'Pendiente' }}</span></div>
          <p class="mb-3 text-center text-xs capitalize text-gray-400">{{ formatoFechaPartido(p.fecha_partido) }} · hora CDMX</p>
          <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <div class="min-w-0"><img v-if="p.logo_local" :src="p.logo_local" alt="" loading="lazy" decoding="async" class="mx-auto mb-2 h-10 w-10 object-contain" /><div v-else class="mx-auto mb-2 h-10 w-10 rounded-full bg-gray-100"></div><p class="flex min-h-10 items-start justify-center break-words text-sm font-bold leading-tight text-quiniela-verdeOscuro">{{ p.equipo_local }}</p></div>
            <span v-if="p.puntos_local != null || p.puntos_visitante != null" class="text-lg font-bold tabular-nums text-quiniela-verdeOscuro">{{ p.puntos_local ?? '—' }} - {{ p.puntos_visitante ?? '—' }}</span><span v-else class="text-xs font-bold text-gray-400">VS</span>
            <div class="min-w-0"><img v-if="p.logo_visitante" :src="p.logo_visitante" alt="" loading="lazy" decoding="async" class="mx-auto mb-2 h-10 w-10 object-contain" /><div v-else class="mx-auto mb-2 h-10 w-10 rounded-full bg-gray-100"></div><p class="flex min-h-10 items-start justify-center break-words text-sm font-bold leading-tight text-quiniela-verdeOscuro">{{ p.equipo_visitante }}</p></div>
          </div>
          <p v-if="!p.cancelado && p.resultado_oficial" class="mt-3 text-center text-sm font-semibold text-quiniela-verde">Ganador: {{ p.resultado_oficial === 'L' ? p.equipo_local : p.resultado_oficial === 'V' ? p.equipo_visitante : 'Empate' }}</p>
        </article>
      </div>
      <p v-if="!partidos.length" class="empty-state">Esta jornada todavía no tiene partidos.</p>
    </section>
    <p class="text-center text-xs text-gray-500">Actualización automática cada 30 segundos<span v-if="actualizadoEl"> · Última actualización: {{ formatoActualizacion(actualizadoEl) }} · CDMX</span>.</p>
    </template>
  </main>
</template>
