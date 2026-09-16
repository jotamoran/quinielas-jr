<script setup>
import { computed, onMounted, ref } from 'vue';
import { buscarFixtures, crearJornada } from '../services/adminService';
import { LIGAS_DISPONIBLES } from '../utils/ligas';
import EquipoAutocomplete from '../components/EquipoAutocomplete.vue';
import { alertaError, alertaExito } from '@/lib/alertas';
import { ahoraParaDatetimeInput, fechaCDMXaISO, formatearFecha, hoyParaInput } from '@/lib/fechas';

const MAX_PARTIDOS = 9;
const hoy = hoyParaInput();
const hoyDatetime = ahoraParaDatetimeInput();
const ligaPrincipal = LIGAS_DISPONIBLES.find((liga) => liga.principal);
const ligasComplementarias = LIGAS_DISPONIBLES.filter((liga) => !liga.principal);
const ligasSeleccionadas = ref([ligaPrincipal.id]);
const desde = ref('');
const hasta = ref('');
const numeroJornada = ref(null);
const fixtures = ref([]);
const seleccionados = ref([]);
const nombreJornada = ref('');
const costo = ref(50);
const premio = ref(0);
const fechaCierre = ref('');
const cargando = ref(false);
const accionEnCurso = ref('');
const mostrarManual = ref(false);
const partidoManual = ref({ liga: 'Liga MX', local: null, visitante: null, fecha: '' });
const detectandoJornada = ref(true);

const faltantes = computed(() => MAX_PARTIDOS - seleccionados.value.length);
const completo = computed(() => seleccionados.value.length === MAX_PARTIDOS);
const grupos = computed(() => {
  const agrupados = new Map();
  fixtures.value.forEach((fixture) => {
    if (!agrupados.has(fixture.league.id)) agrupados.set(fixture.league.id, { league: fixture.league, fixtures: [] });
    agrupados.get(fixture.league.id).fixtures.push(fixture);
  });
  return [...agrupados.values()].sort((a, b) => (a.league.id === ligaPrincipal.id ? -1 : b.league.id === ligaPrincipal.id ? 1 : 0));
});

function estaSeleccionado(fixture) {
  return seleccionados.value.some((item) => item.fixture.id === fixture.fixture.id);
}

async function buscarLigas(leagues, reiniciar = false) {
  cargando.value = true;
  accionEnCurso.value = reiniciar ? 'buscar-rango' : 'agregar-liga';
  try {
    const { fixtures: encontrados } = await buscarFixtures({ leagues, from: desde.value, to: hasta.value });
    const existentes = new Map((reiniciar ? [] : fixtures.value).map((fixture) => [fixture.fixture.id, fixture]));
    encontrados.forEach((fixture) => existentes.set(fixture.fixture.id, fixture));
    fixtures.value = [...existentes.values()];
  } catch (e) {
    await alertaError(e, 'No se pudieron buscar los partidos');
  } finally {
    cargando.value = false;
    accionEnCurso.value = '';
  }
}

async function buscar() {
  ligasSeleccionadas.value = [ligaPrincipal.id];
  seleccionados.value = [];
  await buscarLigas([ligaPrincipal.id], true);
}

async function buscarPorJornada() {
  ligasSeleccionadas.value = [ligaPrincipal.id];
  seleccionados.value = [];
  cargando.value = true;
  accionEnCurso.value = 'buscar-jornada';
  try {
    const { fixtures: encontrados } = await buscarFixtures({ leagues: [ligaPrincipal.id], numeroJornada: numeroJornada.value });
    fixtures.value = encontrados;
    if (encontrados.length) {
      const fechas = encontrados.map((f) => f.fixture.date.slice(0, 10)).sort();
      desde.value = fechas[0];
      hasta.value = fechas.at(-1);
    }
  } catch (e) {
    await alertaError(e, 'No se pudo buscar la jornada');
  } finally {
    cargando.value = false;
    accionEnCurso.value = '';
  }
}

async function agregarLiga(liga) {
  if (!ligasSeleccionadas.value.includes(liga.id)) ligasSeleccionadas.value.push(liga.id);
  await buscarLigas([liga.id]);
}

async function alternarSeleccion(fixture) {
  const index = seleccionados.value.findIndex((item) => item.fixture.id === fixture.fixture.id);
  if (index >= 0) return seleccionados.value.splice(index, 1);
  if (completo.value) {
    await alertaError(new Error('Deselecciona uno para poder cambiarlo.'), 'Ya seleccionaste 9 partidos');
    return;
  }
  seleccionados.value.push(fixture);
}

async function detectarProximaJornada() {
  try {
    const respuesta = await buscarFixtures({ leagues: [ligaPrincipal.id], proximaJornada: true });
    // No pisar lo que el admin ya haya escrito mientras esta consulta estaba en curso.
    if (respuesta.numeroJornada && !numeroJornada.value) numeroJornada.value = respuesta.numeroJornada;
  } catch {
    // El administrador todavía puede escribir la jornada manualmente.
  } finally {
    detectandoJornada.value = false;
  }
}

async function agregarPartidoManual() {
  const { liga, local, visitante, fecha } = partidoManual.value;
  if (!liga.trim() || !local?.name?.trim() || !visitante?.name?.trim() || !fecha) {
    await alertaError(new Error('Completa liga, fecha y ambos equipos.'), 'Faltan datos del partido');
    return;
  }
  if (fecha < hoyDatetime) {
    await alertaError(new Error('Selecciona una fecha y hora futura.'), 'Fecha no válida');
    return;
  }
  if (local.name.trim().toLowerCase() === visitante.name.trim().toLowerCase()) {
    await alertaError(new Error('El equipo local y visitante deben ser distintos.'), 'Partido no válido');
    return;
  }
  if (completo.value) {
    await alertaError(new Error('Deselecciona uno para poder cambiarlo.'), 'Ya seleccionaste 9 partidos');
    return;
  }
  const fixture = {
    fixture: { id: `manual-${crypto.randomUUID()}`, date: fechaCDMXaISO(fecha.slice(0, 10), `${fecha.slice(11)}:00`) },
    league: { id: 'manual', name: liga.trim() },
    teams: { home: { name: local.name.trim(), logo: local.logo ?? null }, away: { name: visitante.name.trim(), logo: visitante.logo ?? null } },
    provider: 'manual',
  };
  fixtures.value.push(fixture);
  seleccionados.value.push(fixture);
  partidoManual.value = { liga: liga.trim(), local: null, visitante: null, fecha: '' };
  mostrarManual.value = false;
}

async function guardarJornada() {
  if (!completo.value) {
    await alertaError(new Error(`Selecciona los ${MAX_PARTIDOS} partidos requeridos.`), 'Jornada incompleta');
    return;
  }
  if (!nombreJornada.value.trim()) {
    await alertaError(new Error('Escribe un nombre para identificar la jornada.'), 'Falta el nombre');
    return;
  }
  if (!Number.isFinite(Number(costo.value)) || Number(costo.value) < 0 || !Number.isFinite(Number(premio.value)) || Number(premio.value) < 0) {
    await alertaError(new Error('Costo y premio deben ser cantidades iguales o mayores a cero.'), 'Importes no válidos');
    return;
  }
  if (!fechaCierre.value || fechaCierre.value < hoyDatetime) {
    await alertaError(new Error('Selecciona una fecha y hora futura.'), 'Fecha de cierre no válida');
    return;
  }
  const equipos = seleccionados.value.flatMap((partido) => [partido.teams.home.name.trim().toLowerCase(), partido.teams.away.name.trim().toLowerCase()]);
  if (new Set(equipos).size !== equipos.length) {
    await alertaError(new Error('Hay un equipo repetido entre los partidos seleccionados.'), 'Equipos duplicados');
    return;
  }
  cargando.value = true;
  accionEnCurso.value = 'publicar';
  try {
    const cierreIso = fechaCDMXaISO(fechaCierre.value.slice(0, 10), `${fechaCierre.value.slice(11)}:00`);
    const primerPartido = Math.min(...seleccionados.value.map((partido) => new Date(partido.fixture.date).getTime()));
    if (new Date(cierreIso).getTime() > primerPartido - 5 * 60 * 1000) {
      await alertaError(new Error('El cierre debe quedar al menos cinco minutos antes del primer partido.'), 'Fecha de cierre no válida');
      return;
    }
    await crearJornada({ nombre: nombreJornada.value, costo: costo.value, premio: premio.value, fechaCierre: cierreIso, partidosSeleccionados: seleccionados.value });
    await alertaExito('Jornada publicada', 'Los 9 partidos ya están disponibles para los participantes.');
    seleccionados.value = [];
    fixtures.value = [];
    nombreJornada.value = '';
    fechaCierre.value = '';
  } catch (e) {
    await alertaError(e, 'No se pudo publicar la jornada');
  } finally {
    cargando.value = false;
    accionEnCurso.value = '';
  }
}

function fechaPartido(fecha) {
  return formatearFecha(fecha, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function irADatos() {
  document.getElementById('datos-jornada')?.scrollIntoView({ behavior: 'smooth' });
}

onMounted(detectarProximaJornada);
</script>

<template>
  <main class="mx-auto max-w-5xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
    <header>
      <p class="text-sm font-semibold uppercase tracking-widest text-quiniela-verde">Administración</p>
      <h1 class="text-3xl font-bold text-quiniela-verdeOscuro">Nueva quiniela</h1>
      <p class="mt-1 text-gray-600">Selecciona exactamente nueve partidos y publica la jornada.</p>
    </header>

    <ol class="grid grid-cols-2 gap-x-2 gap-y-4 text-center text-xs min-[420px]:grid-cols-4 sm:text-sm">
      <li v-for="(paso, index) in ['Buscar', 'Seleccionar 9', 'Datos', 'Publicar']" :key="paso" class="space-y-1">
        <span class="mx-auto grid h-8 w-8 place-items-center rounded-full font-bold" :class="index === 0 || (index === 1 && fixtures.length) || (index > 1 && completo) ? 'bg-quiniela-verde text-white' : 'bg-gray-200 text-gray-500'">{{ index + 1 }}</span>
        <span class="block">{{ paso }}</span>
      </li>
    </ol>

    <section class="rounded-2xl border border-green-100 bg-white p-4 shadow-sm sm:p-6">
      <div class="mb-5 flex items-center gap-3 rounded-xl bg-green-50 p-4">
        <span class="text-2xl">🇲🇽</span>
        <div><p class="font-bold text-quiniela-verdeOscuro">Liga MX</p><p class="text-sm text-gray-600">Competición principal</p></div>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="text-sm font-semibold text-gray-700">Del<input v-model="desde" type="date" :min="hoy" class="mt-1 w-full rounded-xl border-gray-300" /></label>
        <label class="text-sm font-semibold text-gray-700">Al<input v-model="hasta" type="date" :min="hoy" class="mt-1 w-full rounded-xl border-gray-300" /></label>
      </div>
      <button @click="buscar" :disabled="!desde || !hasta || cargando" class="mt-4 w-full rounded-xl bg-quiniela-verde px-5 py-3 font-semibold text-white disabled:opacity-50 sm:w-auto">
        {{ accionEnCurso === 'buscar-rango' ? 'Buscando…' : 'Buscar partidos' }}
      </button>
      <div class="mt-5 border-t border-green-100 pt-5">
        <label class="text-sm font-semibold text-gray-700">O buscar por jornada (solo Liga MX)<input v-model.number="numeroJornada" type="number" min="1" class="mt-1 w-full max-w-[160px] rounded-xl border-gray-300" :placeholder="detectandoJornada ? 'Detectando…' : 'Ej. 8'" /><span class="mt-1 block text-xs font-normal text-gray-500">{{ detectandoJornada ? 'Consultando la próxima jornada…' : numeroJornada ? `Próxima jornada detectada: ${numeroJornada}` : 'Escribe el número si no pudo detectarse.' }}</span></label>
        <button @click="buscarPorJornada" :disabled="!numeroJornada || cargando" class="mt-3 w-full rounded-xl border border-quiniela-verde bg-white px-5 py-3 font-semibold text-quiniela-verde disabled:opacity-50 sm:w-auto">
          {{ accionEnCurso === 'buscar-jornada' ? 'Buscando…' : 'Buscar por jornada' }}
        </button>
      </div>
    </section>

    <section class="rounded-2xl border border-dashed border-quiniela-verde bg-green-50/50 p-4 sm:p-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 class="font-bold text-quiniela-verdeOscuro">¿No aparece un partido?</h2><p class="text-sm text-gray-600">Agrégalo manualmente y contará dentro de los nueve.</p></div>
        <button type="button" @click="mostrarManual = !mostrarManual" class="rounded-xl border border-quiniela-verde bg-white px-4 py-2 font-semibold text-quiniela-verde">{{ mostrarManual ? 'Cancelar' : '+ Agregar partido manual' }}</button>
      </div>
      <form v-if="mostrarManual" class="mt-5 grid gap-4 sm:grid-cols-2" @submit.prevent="agregarPartidoManual">
        <label class="text-sm font-semibold">Liga<input v-model="partidoManual.liga" class="mt-1 w-full rounded-xl border-gray-300" placeholder="Liga o competición" /></label>
        <label class="text-sm font-semibold">Fecha y hora<input v-model="partidoManual.fecha" type="datetime-local" :min="hoyDatetime" class="mt-1 w-full rounded-xl border-gray-300" /></label>
        <EquipoAutocomplete v-model="partidoManual.local" label="Equipo local" />
        <EquipoAutocomplete v-model="partidoManual.visitante" label="Equipo visitante" />
        <button type="submit" class="rounded-xl bg-quiniela-verde px-4 py-3 font-semibold text-white sm:col-span-2">Agregar y seleccionar</button>
      </form>
    </section>

    <section v-if="fixtures.length" class="space-y-6">
      <div v-for="grupo in grupos" :key="grupo.league.id">
        <div class="mb-3 flex items-end justify-between"><h2 class="text-xl font-bold text-quiniela-verdeOscuro">{{ grupo.league.name }}</h2><span class="text-sm text-gray-500">{{ grupo.fixtures.length }} partidos</span></div>
        <div class="grid gap-3 md:grid-cols-2">
          <button v-for="fixture in grupo.fixtures" :key="fixture.fixture.id" type="button" @click="alternarSeleccion(fixture)" :aria-pressed="estaSeleccionado(fixture)" class="rounded-2xl border bg-white p-4 text-left shadow-sm transition" :class="estaSeleccionado(fixture) ? 'border-quiniela-verde ring-2 ring-green-100' : 'border-gray-200 hover:border-green-300'">
            <div class="mb-4 flex justify-between text-xs text-gray-500"><span>{{ fixture.league.name }}<span v-if="fixture.provider === 'manual'"> · Manual</span></span><span>{{ fechaPartido(fixture.fixture.date) }}</span></div>
            <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
              <div class="min-w-0"><img v-if="fixture.teams.home.logo" :src="fixture.teams.home.logo" alt="" loading="lazy" decoding="async" class="mx-auto mb-2 h-10 w-10 object-contain" /><div v-else class="mx-auto mb-2 h-10 w-10 rounded-full bg-gray-100"></div><p class="flex min-h-10 items-start justify-center break-words text-sm font-semibold leading-tight">{{ fixture.teams.home.name }}</p></div>
              <span class="text-xs font-bold text-gray-400">VS</span>
              <div class="min-w-0"><img v-if="fixture.teams.away.logo" :src="fixture.teams.away.logo" alt="" loading="lazy" decoding="async" class="mx-auto mb-2 h-10 w-10 object-contain" /><div v-else class="mx-auto mb-2 h-10 w-10 rounded-full bg-gray-100"></div><p class="flex min-h-10 items-start justify-center break-words text-sm font-semibold leading-tight">{{ fixture.teams.away.name }}</p></div>
            </div>
            <p class="mt-3 text-center text-sm font-semibold" :class="estaSeleccionado(fixture) ? 'text-quiniela-verde' : 'text-gray-500'">{{ estaSeleccionado(fixture) ? '✓ Seleccionado' : 'Seleccionar' }}</p>
          </button>
        </div>
      </div>

      <div v-if="faltantes > 0" class="rounded-2xl border border-dashed border-gray-300 bg-white p-4 sm:p-6">
        <h2 class="font-bold text-quiniela-verdeOscuro">Te faltan {{ faltantes }} partidos</h2>
        <p class="mb-3 text-sm text-gray-600">Agrega partidos de otras competiciones.</p>
        <div class="flex flex-wrap gap-2">
          <button v-for="liga in ligasComplementarias" :key="liga.id" @click="agregarLiga(liga)" :disabled="ligasSeleccionadas.includes(liga.id) || cargando" class="rounded-full border border-gray-300 px-3 py-2 text-sm font-semibold disabled:bg-gray-100 disabled:text-gray-400">{{ liga.nombre }}</button>
        </div>
      </div>
    </section>

    <section v-if="completo" id="datos-jornada" class="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
      <h2 class="mb-4 text-xl font-bold text-quiniela-verdeOscuro">Datos de la jornada</h2>
      <div class="grid gap-4 sm:grid-cols-2"><label class="text-sm font-semibold">Nombre<input v-model="nombreJornada" class="mt-1 w-full rounded-xl border-gray-300" /></label><label class="text-sm font-semibold">Cierre (hora CDMX)<input v-model="fechaCierre" type="datetime-local" :min="hoyDatetime" class="mt-1 w-full rounded-xl border-gray-300" /><span class="mt-1 block text-xs font-normal text-gray-500">Debe ser al menos 5 minutos antes del primer partido.</span></label><label class="text-sm font-semibold">Costo<input v-model.number="costo" type="number" min="0" class="mt-1 w-full rounded-xl border-gray-300" /></label><label class="text-sm font-semibold">Premio<input v-model.number="premio" type="number" min="0" class="mt-1 w-full rounded-xl border-gray-300" /></label></div>
      <button @click="guardarJornada" :disabled="!nombreJornada || !fechaCierre || cargando" class="mt-5 w-full rounded-xl bg-quiniela-dorado py-3 font-bold text-quiniela-grisTexto disabled:opacity-50">{{ accionEnCurso === 'publicar' ? 'Publicando…' : 'Publicar jornada' }}</button>
    </section>

    <div v-if="fixtures.length" class="mt-4 border-t bg-white/95 p-3 shadow-2xl backdrop-blur sm:sticky sm:bottom-3 sm:rounded-2xl sm:border">
      <div class="mx-auto flex max-w-5xl items-center gap-4"><div class="flex-1"><p class="font-bold text-quiniela-verdeOscuro">{{ seleccionados.length }} de 9 seleccionados</p><div class="mt-1 h-2 overflow-hidden rounded-full bg-gray-200"><div class="h-full bg-quiniela-verde transition-all" :style="{ width: `${seleccionados.length / 9 * 100}%` }"></div></div></div><button :disabled="!completo || cargando" @click="irADatos" class="rounded-xl bg-quiniela-verde px-5 py-3 font-semibold text-white disabled:opacity-40">Continuar</button></div>
    </div>
  </main>
</template>
