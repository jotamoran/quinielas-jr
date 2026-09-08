<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { actualizarPremioJornada, listarJornadasAdmin } from '../services/adminService';
import { generarImagenJornada } from '../utils/imagenJornada';
import { alertaError, alertaExito } from '@/lib/alertas';

const router = useRouter();
const jornadas = ref([]);
const abierta = ref(null);
const premioEditado = ref(0);
const cargando = ref(true);
const guardando = ref(false);

const jornadasOrdenadas = computed(() => [...jornadas.value].sort((a, b) => {
  const prioridad = { activa: 0, borrador: 1, cerrada: 2, finalizada: 3 };
  return (prioridad[a.estatus] ?? 4) - (prioridad[b.estatus] ?? 4) || new Date(b.creado_el) - new Date(a.creado_el);
}));

function formatoMoneda(valor) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(valor ?? 0);
}

function formatoFecha(fecha) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(fecha));
}

function abrir(jornada) {
  abierta.value = jornada;
  premioEditado.value = Number(jornada.premio ?? 0);
}

function enlacePublico(jornada) {
  return new URL(router.resolve({ name: 'tabla-publica', params: { jornadaId: jornada.id } }).href, window.location.origin).href;
}

async function copiarEnlace(jornada) {
  try {
    await navigator.clipboard.writeText(enlacePublico(jornada));
    await alertaExito('Enlace copiado', 'Ya puedes compartir la tabla pública de resultados.');
  } catch (error) {
    await alertaError(error, 'No se pudo copiar el enlace');
  }
}

async function compartirEnlace(jornada) {
  const url = enlacePublico(jornada);
  if (!navigator.share) return copiarEnlace(jornada);
  try {
    await navigator.share({ title: jornada.nombre, text: `Consulta los resultados de ${jornada.nombre}`, url });
  } catch (error) {
    if (error.name !== 'AbortError') await alertaError(error, 'No se pudo compartir');
  }
}

async function compartirImagen(jornada) {
  try {
    const blob = await generarImagenJornada(jornada);
    const nombre = `${jornada.nombre.toLowerCase().replace(/[^a-z0-9]+/gi, '-') || 'jornada'}.png`;
    const archivo = new File([blob], nombre, { type: 'image/png' });
    if (navigator.share && navigator.canShare?.({ files: [archivo] })) {
      await navigator.share({ title: jornada.nombre, text: `Pronósticos de ${jornada.nombre}`, files: [archivo] });
      return;
    }
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.click();
    URL.revokeObjectURL(url);
    await alertaExito('Imagen descargada', 'Ya está lista para compartir.');
  } catch (error) {
    if (error.name !== 'AbortError') await alertaError(error, 'No se pudo generar la imagen');
  }
}

async function guardarPremio() {
  if (!abierta.value || premioEditado.value < 0) return;
  guardando.value = true;
  try {
    await actualizarPremioJornada(abierta.value.id, premioEditado.value);
    abierta.value.premio = premioEditado.value;
    await alertaExito('Premio actualizado');
  } catch (error) {
    await alertaError(error, 'No se pudo actualizar el premio');
  } finally {
    guardando.value = false;
  }
}

onMounted(async () => {
  try {
    jornadas.value = await listarJornadasAdmin();
    if (jornadasOrdenadas.value[0]?.estatus === 'activa') abrir(jornadasOrdenadas.value[0]);
  } catch (error) {
    await alertaError(error, 'No se pudieron cargar las jornadas');
  } finally {
    cargando.value = false;
  }
});
</script>

<template>
  <main class="page-shell max-w-6xl">
    <header>
      <p class="eyebrow">Administración</p>
      <h1 class="page-title">Jornadas</h1>
      <p class="page-description">Consulta partidos, administra el premio y comparte cada jornada.</p>
    </header>

    <div v-if="cargando" class="empty-state">Cargando jornadas…</div>
    <div v-else-if="!jornadas.length" class="empty-state">Todavía no hay jornadas creadas.</div>

    <div v-else class="grid gap-5 lg:grid-cols-[340px_1fr]">
      <section class="space-y-3">
        <button v-for="jornada in jornadasOrdenadas" :key="jornada.id" type="button" @click="abrir(jornada)" class="w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition" :class="abierta?.id === jornada.id ? 'border-quiniela-verde ring-2 ring-green-100' : 'border-gray-200 hover:border-green-300'">
          <div class="flex items-start justify-between gap-3">
            <div><p class="font-bold text-quiniela-verdeOscuro">{{ jornada.nombre }}</p><p class="mt-1 text-sm text-gray-500">{{ formatoFecha(jornada.fecha_cierre) }}</p></div>
            <span class="rounded-full px-2.5 py-1 text-xs font-bold capitalize" :class="jornada.estatus === 'activa' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'">{{ jornada.estatus }}</span>
          </div>
          <p class="mt-3 text-sm font-semibold text-gray-700">{{ jornada.partidos?.length ?? 0 }} partidos · {{ formatoMoneda(jornada.premio) }}</p>
        </button>
      </section>

      <section v-if="abierta" class="space-y-5">
        <article class="rounded-2xl bg-quiniela-verdeOscuro p-5 text-white shadow-lg sm:p-6">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div><span class="text-xs font-bold uppercase tracking-widest text-green-200">{{ abierta.estatus }}</span><h2 class="mt-1 text-2xl font-bold">{{ abierta.nombre }}</h2><p class="mt-1 text-sm text-green-100">Cierre: {{ formatoFecha(abierta.fecha_cierre) }}</p></div>
            <div class="rounded-xl bg-white/10 px-4 py-3"><p class="text-xs uppercase tracking-wider text-green-100">Premio</p><p class="text-2xl font-bold text-quiniela-dorado">{{ formatoMoneda(abierta.premio) }}</p></div>
          </div>
          <div class="mt-5 grid gap-2 sm:grid-cols-3">
            <button @click="compartirEnlace(abierta)" class="rounded-xl bg-white px-3 py-2.5 font-semibold text-quiniela-verdeOscuro">Compartir resultados</button>
            <button @click="copiarEnlace(abierta)" class="rounded-xl border border-white/40 px-3 py-2.5 font-semibold">Copiar enlace</button>
            <button @click="compartirImagen(abierta)" class="rounded-xl bg-quiniela-dorado px-3 py-2.5 font-semibold text-quiniela-grisTexto">Compartir imagen</button>
          </div>
        </article>

        <form @submit.prevent="guardarPremio" class="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
          <label class="form-label flex-1">Premio de la jornada<input v-model.number="premioEditado" type="number" min="0" step="0.01" class="form-control mt-1" /></label>
          <button :disabled="guardando || premioEditado === abierta.premio" class="rounded-xl bg-quiniela-verde px-5 py-3 font-semibold text-white disabled:opacity-50">{{ guardando ? 'Guardando…' : 'Actualizar premio' }}</button>
        </form>

        <div class="grid gap-3 sm:grid-cols-2">
          <article v-for="(partido, index) in abierta.partidos" :key="partido.id" class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div class="mb-3 flex justify-between text-xs text-gray-500"><span>Partido {{ index + 1 }} · {{ partido.liga_nombre }}</span><span>{{ formatoFecha(partido.fecha_partido) }}</span></div>
            <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
              <div><img v-if="partido.logo_local" :src="partido.logo_local" alt="" class="mx-auto mb-2 h-10 w-10 object-contain" /><p class="text-sm font-bold">{{ partido.equipo_local }}</p></div>
              <span class="text-xs font-bold text-gray-400">VS</span>
              <div><img v-if="partido.logo_visitante" :src="partido.logo_visitante" alt="" class="mx-auto mb-2 h-10 w-10 object-contain" /><p class="text-sm font-bold">{{ partido.equipo_visitante }}</p></div>
            </div>
            <p v-if="partido.resultado_oficial" class="mt-3 text-center text-sm font-bold text-quiniela-verde">Resultado: {{ partido.resultado_oficial }}</p>
          </article>
        </div>
      </section>
    </div>
  </main>
</template>
