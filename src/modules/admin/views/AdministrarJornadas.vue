<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { actualizarCierreJornada, actualizarPremioJornada, cancelarJornada, cancelarPartido, listarJornadasAdmin, obtenerResumenCierreJornada } from '../services/adminService';
import { generarImagenJornada } from '../utils/imagenJornada';
import { alertaAdvertencia, alertaError, alertaExito, confirmarAccion } from '@/lib/alertas';
import EsqueletoCarga from '@/components/EsqueletoCarga.vue';
import { fechaCDMXaISO, fechaParaInput, formatearFecha, hoyParaInput } from '@/lib/fechas';

const router = useRouter();
const jornadas = ref([]);
const abierta = ref(null);
const premioEditado = ref(0);
const cierreEditado = ref('');
const cargando = ref(true);
const guardando = ref(false);
const accionEnCurso = ref('');
const hoy = hoyParaInput();
const resumenCierre = ref(null);
const cargandoResumen = ref(false);
const errorResumen = ref('');

const jornadasOrdenadas = computed(() => [...jornadas.value].sort((a, b) => {
  const prioridad = { activa: 0, borrador: 1, cerrada: 2, finalizada: 3 };
  return (prioridad[a.estatus] ?? 4) - (prioridad[b.estatus] ?? 4) || new Date(b.creado_el) - new Date(a.creado_el);
}));

function formatoMoneda(valor) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(valor ?? 0);
}

function formatoFecha(fecha) {
  return formatearFecha(fecha, { dateStyle: 'medium' });
}

function formatoFechaPartido(fecha) {
  return formatearFecha(fecha, { dateStyle: 'medium', timeStyle: 'short' });
}

function abrir(jornada) {
  abierta.value = jornada;
  premioEditado.value = Number(jornada.premio ?? 0);
  cierreEditado.value = fechaParaInput(jornada.fecha_cierre);
  resumenCierre.value = null;
  errorResumen.value = '';
  if (jornada.estatus === 'finalizada') cargarResumenCierre(jornada.id);
}

async function cargarResumenCierre(jornadaId) {
  cargandoResumen.value = true;
  try { resumenCierre.value = await obtenerResumenCierreJornada(jornadaId); } catch (error) { errorResumen.value = error.message; } finally { cargandoResumen.value = false; }
}

function enlacePublico(jornada) {
  return new URL(router.resolve({ name: 'tabla-publica', params: { jornadaId: jornada.id } }).href, window.location.origin).href;
}

function enlaceRegistro(jornada) {
  return new URL(router.resolve({ name: 'llenar-quiniela', params: { jornadaId: jornada.id } }).href, window.location.origin).href;
}

async function compartirRegistro(jornada) {
  const url = enlaceRegistro(jornada);
  if (!navigator.share) {
    try {
      await navigator.clipboard.writeText(url);
      await alertaExito('Enlace copiado', 'Ya puedes compartirlo para que se registren.');
    } catch (error) {
      await alertaError(error, 'No se pudo copiar el enlace');
    }
    return;
  }
  try {
    await navigator.share({ title: jornada.nombre, text: `Regístrate en ${jornada.nombre}`, url });
  } catch (error) {
    if (error.name !== 'AbortError') await alertaError(error, 'No se pudo compartir');
  }
}

async function compartirEnlace(jornada) {
  const url = enlacePublico(jornada);
  if (!navigator.share) {
    try {
      await navigator.clipboard.writeText(url);
      await alertaExito('Enlace copiado', 'Ya puedes compartir la tabla pública de resultados.');
    } catch (error) {
      await alertaError(error, 'No se pudo copiar el enlace');
    }
    return;
  }
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
  if (!abierta.value || ['finalizada', 'cancelada'].includes(abierta.value.estatus) || premioEditado.value < 0) return;
  guardando.value = true;
  accionEnCurso.value = 'premio';
  try {
    await actualizarPremioJornada(abierta.value.id, premioEditado.value);
    abierta.value.premio = premioEditado.value;
    await alertaExito('Premio actualizado');
  } catch (error) {
    await alertaError(error, 'No se pudo actualizar el premio');
  } finally {
    guardando.value = false;
    accionEnCurso.value = '';
  }
}

async function guardarCierre() {
  if (!abierta.value || ['finalizada', 'cancelada'].includes(abierta.value.estatus) || !cierreEditado.value) return;
  if (cierreEditado.value < hoy) {
    await alertaError(new Error('La fecha de cierre no puede ser anterior a hoy'));
    return;
  }
  guardando.value = true;
  accionEnCurso.value = 'fecha';
  try {
    const fecha = fechaCDMXaISO(cierreEditado.value);
    await actualizarCierreJornada(abierta.value.id, fecha);
    abierta.value.fecha_cierre = fecha;
    await alertaExito('Fecha límite actualizada');
  } catch (error) {
    await alertaError(error, 'No se pudo actualizar el cierre');
  } finally {
    guardando.value = false;
    accionEnCurso.value = '';
  }
}

async function cerrarRegistro() {
  if (!abierta.value || ['finalizada', 'cancelada'].includes(abierta.value.estatus)) return;
  const confirmado = await confirmarAccion({ title: 'Cerrar registro ahora', text: 'Desde este momento ya no se podrán registrar nuevas quinielas.', confirmText: 'Cerrar registro', danger: true });
  if (!confirmado) return;
  guardando.value = true;
  accionEnCurso.value = 'cierre';
  try {
    const fecha = new Date().toISOString();
    await actualizarCierreJornada(abierta.value.id, fecha);
    abierta.value.fecha_cierre = fecha;
    cierreEditado.value = fechaParaInput(fecha);
    await alertaExito('Registro cerrado');
  } catch (error) {
    await alertaError(error, 'No se pudo cerrar el registro');
  } finally {
    guardando.value = false;
    accionEnCurso.value = '';
  }
}

async function cancelarJornadaCompleta() {
  if (!abierta.value) return;
  const confirmado = await confirmarAccion({
    title: 'Cancelar jornada',
    text: 'Se avisará por correo a quien ya tenga una entrada registrada. Esta acción no se puede deshacer.',
    confirmText: 'Cancelar jornada',
    danger: true,
  });
  if (!confirmado) return;
  guardando.value = true;
  accionEnCurso.value = 'cancelar-jornada';
  try {
    const resultado = await cancelarJornada(abierta.value.id);
    abierta.value.estatus = 'cancelada';
    const jornadaEnLista = jornadas.value.find((j) => j.id === abierta.value.id);
    if (jornadaEnLista) jornadaEnLista.estatus = 'cancelada';
    if (resultado.avisos?.length) {
      await alertaAdvertencia('Jornada cancelada con avisos', resultado.avisos.join(' '));
    } else {
      await alertaExito('Jornada cancelada', 'Los participantes fueron notificados correctamente.');
    }
  } catch (error) {
    await alertaError(error, 'No se pudo cancelar la jornada');
  } finally {
    guardando.value = false;
    accionEnCurso.value = '';
  }
}

async function alternarCancelacion(partido) {
  if (!abierta.value || ['finalizada', 'cancelada'].includes(abierta.value.estatus)) return;
  const accion = partido.cancelado ? 'reactivar' : 'cancelar';
  const yaPasoElCierre = new Date(abierta.value.fecha_cierre) <= new Date();
  const confirmado = await confirmarAccion({
    title: partido.cancelado ? 'Reactivar partido' : 'Cancelar partido',
    text: partido.cancelado
      ? (yaPasoElCierre
          ? 'Ya cerró el registro; quienes se registraron con el partido cancelado no podrán ganar ese punto. Volverá a contar para el cierre de la jornada.'
          : 'Volverá a contar para los pronósticos y para el cierre de la jornada.')
      : 'Ya no contará para ninguna quiniela ni bloqueará el cierre de la jornada.',
    confirmText: partido.cancelado ? 'Reactivar' : 'Cancelar partido',
    danger: !partido.cancelado,
  });
  if (!confirmado) return;
  guardando.value = true;
  accionEnCurso.value = `partido:${partido.id}`;
  try {
    await cancelarPartido(partido.id, !partido.cancelado);
    partido.cancelado = !partido.cancelado;
    await alertaExito(partido.cancelado ? 'Partido cancelado' : 'Partido reactivado');
  } catch (error) {
    await alertaError(error, `No se pudo ${accion} el partido`);
  } finally {
    guardando.value = false;
    accionEnCurso.value = '';
  }
}

onMounted(async () => {
  try {
    jornadas.value = await listarJornadasAdmin();
    if (jornadasOrdenadas.value[0]) abrir(jornadasOrdenadas.value[0]);
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

    <EsqueletoCarga v-if="cargando" :cantidad="4" />
    <div v-else-if="!jornadas.length" class="empty-state">Todavía no hay jornadas creadas.</div>

    <div v-else class="grid gap-5 lg:grid-cols-[340px_1fr]">
      <section class="space-y-3">
        <button v-for="jornada in jornadasOrdenadas" :key="jornada.id" type="button" @click="abrir(jornada)" class="w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition" :class="abierta?.id === jornada.id ? 'border-quiniela-verde ring-2 ring-green-100' : 'border-gray-200 hover:border-green-300'">
          <div class="flex items-start justify-between gap-3">
            <div><p class="font-bold text-quiniela-verdeOscuro">{{ jornada.nombre }}</p><p class="mt-1 text-sm text-gray-500">{{ formatoFecha(jornada.fecha_cierre) }}</p></div>
            <span class="rounded-full px-2.5 py-1 text-xs font-bold capitalize" :class="jornada.estatus === 'activa' ? 'bg-green-100 text-green-800' : jornada.estatus === 'cancelada' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'">{{ jornada.estatus }}</span>
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
            <template v-if="!['finalizada', 'cancelada'].includes(abierta.estatus)">
              <button @click="compartirEnlace(abierta)" class="rounded-xl bg-white px-3 py-2.5 font-semibold text-quiniela-verdeOscuro">Compartir resultados</button>
              <button @click="compartirRegistro(abierta)" class="rounded-xl border border-white/40 px-3 py-2.5 font-semibold">Compartir quiniela</button>
              <button @click="compartirImagen(abierta)" class="rounded-xl bg-quiniela-dorado px-3 py-2.5 font-semibold text-quiniela-grisTexto">Compartir imagen</button>
            </template>
            <p v-else class="rounded-xl bg-white/10 px-4 py-3 text-center text-sm font-semibold text-green-100 sm:col-span-3">Jornada finalizada: solo consulta</p>
          </div>
        </article>

        <form v-if="!['finalizada', 'cancelada'].includes(abierta.estatus)" @submit.prevent="guardarPremio" class="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
          <label class="form-label flex-1">Premio de la jornada<input v-model.number="premioEditado" type="number" min="0" step="0.01" class="form-control mt-1" /></label>
          <button :disabled="guardando || premioEditado === abierta.premio" class="rounded-xl bg-quiniela-verde px-5 py-3 font-semibold text-white disabled:opacity-50">{{ accionEnCurso === 'premio' ? 'Guardando…' : 'Actualizar premio' }}</button>
        </form>

        <form v-if="!['finalizada', 'cancelada'].includes(abierta.estatus)" @submit.prevent="guardarCierre" class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label class="form-label flex-1">Fecha límite de registro<input v-model="cierreEditado" type="date" :min="hoy" class="form-control mt-1" /></label>
            <button :disabled="guardando || !cierreEditado" class="rounded-xl bg-quiniela-verde px-5 py-3 font-semibold text-white disabled:opacity-50">{{ accionEnCurso === 'fecha' ? 'Guardando…' : 'Guardar fecha' }}</button>
            <button v-if="new Date(abierta.fecha_cierre) > new Date()" type="button" @click="cerrarRegistro" :disabled="guardando" class="rounded-xl border border-red-300 px-5 py-3 font-semibold text-red-700 disabled:opacity-50">{{ accionEnCurso === 'cierre' ? 'Cerrando…' : 'Cerrar registro ahora' }}</button>
            <span v-else class="rounded-xl bg-gray-100 px-4 py-3 text-center text-sm font-bold text-gray-600">Registro cerrado</span>
          </div>
          <p class="mt-2 text-xs text-gray-500">Al llegar esta fecha, el sistema bloquea automáticamente nuevas entradas y habilita los pronósticos públicos.</p>
        </form>

        <section v-if="abierta.estatus === 'finalizada'" class="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm" aria-labelledby="resumen-cierre-titulo">
          <p class="eyebrow text-amber-700">Resultado definitivo</p>
          <h3 id="resumen-cierre-titulo" class="mt-1 text-xl font-bold text-quiniela-verdeOscuro">Ganadores y cupón</h3>
          <p v-if="cargandoResumen" class="mt-3 text-sm text-gray-600">Cargando el resumen del cierre…</p>
          <p v-else-if="errorResumen" role="alert" class="mt-3 text-sm text-red-700">{{ errorResumen }}</p>
          <div v-else-if="resumenCierre" class="mt-4 grid gap-4 sm:grid-cols-2">
            <div class="rounded-xl bg-white p-4">
              <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Ganador(es) del premio</p>
              <p v-if="!resumenCierre.ganadores.length" class="mt-2 text-sm text-gray-600">No hubo entradas elegibles.</p>
              <ul v-else class="mt-2 space-y-2 text-sm">
                <li v-for="ganador in resumenCierre.ganadores" :key="ganador.quiniela_id" class="flex items-center justify-between gap-3"><span class="font-semibold text-quiniela-verdeOscuro">{{ ganador.username ? `@${ganador.username}` : ganador.alias || ganador.nombre_completo || 'Registro presencial' }}</span><span class="font-bold text-quiniela-verde">{{ formatoMoneda((abierta.premio ?? 0) / resumenCierre.ganadores.length) }}</span></li>
              </ul>
            </div>
            <div class="rounded-xl bg-white p-4">
              <p class="text-xs font-bold uppercase tracking-wider text-gray-500">Cupón de consolación</p>
              <template v-if="resumenCierre.cupon">
                <p class="mt-2 font-semibold text-quiniela-verdeOscuro">{{ resumenCierre.cupon.username ? `@${resumenCierre.cupon.username}` : resumenCierre.cupon.correo_contacto || 'Registro presencial' }}</p>
                <p class="mt-1 text-sm text-gray-600">Código: <strong>{{ resumenCierre.cupon.codigo }}</strong></p>
              </template>
              <p v-else class="mt-2 text-sm text-gray-600">No se asignó cupón en esta jornada.</p>
            </div>
          </div>
        </section>

        <div v-if="abierta.estatus !== 'finalizada' && abierta.estatus !== 'cancelada'" class="rounded-2xl border border-red-200 bg-red-50/50 p-4 shadow-sm">
          <p class="text-sm font-semibold text-red-800">Zona de peligro</p>
          <p class="mt-1 text-xs text-red-700">Cancela esta jornada completa si se creó por error o ya no se va a jugar. Se avisará por correo a quien ya se haya registrado. No se puede deshacer.</p>
          <button type="button" @click="cancelarJornadaCompleta" :disabled="guardando" class="mt-3 w-full rounded-xl border border-red-300 bg-white px-5 py-3 font-semibold text-red-700 disabled:opacity-50 sm:w-auto">{{ accionEnCurso === 'cancelar-jornada' ? 'Cancelando…' : 'Cancelar jornada' }}</button>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <article v-for="(partido, index) in abierta.partidos" :key="partido.id" class="rounded-2xl border p-4 shadow-sm" :class="partido.cancelado ? 'border-red-200 bg-red-50/50' : 'border-gray-200 bg-white'">
            <div class="mb-3 flex justify-between text-xs text-gray-500"><span>Partido {{ index + 1 }} · {{ partido.liga_nombre }}</span><span>{{ formatoFechaPartido(partido.fecha_partido) }}</span></div>
            <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
              <div class="min-w-0"><img v-if="partido.logo_local" :src="partido.logo_local" alt="" class="mx-auto mb-2 h-10 w-10 object-contain" /><p class="flex min-h-10 items-start justify-center break-words text-sm font-bold leading-tight">{{ partido.equipo_local }}</p></div>
              <span class="text-xs font-bold text-gray-400">VS</span>
              <div class="min-w-0"><img v-if="partido.logo_visitante" :src="partido.logo_visitante" alt="" class="mx-auto mb-2 h-10 w-10 object-contain" /><p class="flex min-h-10 items-start justify-center break-words text-sm font-bold leading-tight">{{ partido.equipo_visitante }}</p></div>
            </div>
            <p v-if="partido.cancelado" class="mt-3 text-center text-sm font-bold text-red-700">Cancelado — no cuenta para las quinielas</p>
            <p v-else-if="partido.resultado_oficial" class="mt-3 text-center text-sm font-bold text-quiniela-verde">Resultado: {{ partido.resultado_oficial }}</p>
            <button v-if="!['finalizada', 'cancelada'].includes(abierta.estatus)" type="button" @click="alternarCancelacion(partido)" :disabled="guardando" class="mt-3 min-h-11 w-full rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50" :class="partido.cancelado ? 'border-quiniela-verde text-quiniela-verde' : 'border-red-300 text-red-700'">{{ accionEnCurso === `partido:${partido.id}` ? 'Guardando…' : partido.cancelado ? 'Reactivar partido' : 'Cancelar partido' }}</button>
          </article>
        </div>
      </section>
    </div>
  </main>
</template>
