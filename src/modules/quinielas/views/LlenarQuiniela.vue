<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { useLoginModalStore } from '@/store/loginModal';
import TarjetaPartido from '../components/TarjetaPartido.vue';
import PasoPago from '../components/PasoPago.vue';
import { calcularTiempoRestante, estaBloqueado } from '../utils/countdown';
import { obtenerJornadaActiva, obtenerPartidos, obtenerPronosticosDeQuiniela, crearQuiniela, guardarPredicciones, subirComprobante, notificarRegistro, aplicarCupon, obtenerDatosBancarios } from '../services/quinielasService';
import { alertaError } from '@/lib/alertas';
import { formatearFecha } from '@/lib/fechas';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const loginModalStore = useLoginModalStore();
const jornada = ref(null);
const partidos = ref([]);
const pronosticos = ref({});
const datosBancarios = ref(null);
const alias = ref('Entrada 1');
const paso = ref('pronosticos');
const confirmacion = ref(null);
const error = ref('');
const errorPago = ref('');
const procesando = ref(false);
const tiempoRestante = ref(null);
let intervalo;

const bloqueado = computed(() => Boolean(jornada.value && (jornada.value.estatus !== 'activa' || estaBloqueado(jornada.value.fecha_cierre) || tiempoRestante.value?.vencido)));
const necesitaLogin = computed(() => !authStore.isLoggedIn);
watch(necesitaLogin, (v) => {
  if (v && paso.value === 'pago') paso.value = 'pronosticos';
});
const partidosActivos = computed(() => partidos.value.filter((p) => !p.cancelado));
const completo = computed(() => partidosActivos.value.length > 0 && partidosActivos.value.every((partido) => pronosticos.value[partido.id]));
const urgencia = computed(() => {
  if (!tiempoRestante.value || tiempoRestante.value.vencido) return 'cerrada';
  const totalMinutos = tiempoRestante.value.dias * 1440 + tiempoRestante.value.horas * 60 + tiempoRestante.value.minutos;
  if (totalMinutos < 30) return 'critica';
  if (totalMinutos < 120) return 'alta';
  if (totalMinutos < 1440) return 'media';
  return 'normal';
});
const colorContador = computed(() => ({ normal: 'bg-green-700', media: 'bg-amber-500', alta: 'bg-orange-600', critica: 'bg-red-700', cerrada: 'bg-gray-700' })[urgencia.value]);
const horasTotales = computed(() => (tiempoRestante.value?.dias ?? 0) * 24 + (tiempoRestante.value?.horas ?? 0));
const faltantes = computed(() => partidosActivos.value.filter((partido) => !pronosticos.value[partido.id]).length);
const progreso = computed(() => partidosActivos.value.length ? Math.round(((partidosActivos.value.length - faltantes.value) / partidosActivos.value.length) * 100) : 0);

async function cargar() {
  error.value = '';
  jornada.value = null;
  partidos.value = [];
  pronosticos.value = {};
  paso.value = 'pronosticos';
  try {
    jornada.value = await obtenerJornadaActiva(route.params.jornadaId ?? null, { soloAbierta: !route.params.jornadaId });
    if (jornada.value) {
      partidos.value = await obtenerPartidos(jornada.value.id);
      if (route.query.duplicar) {
        try {
          const anterior = await obtenerPronosticosDeQuiniela(route.query.duplicar);
          const porPartido = new Map(anterior.map((item) => [item.partido_id, item.pronostico]));
          partidos.value.forEach((partido) => { if (porPartido.has(partido.id)) pronosticos.value[partido.id] = porPartido.get(partido.id); });
          alias.value = 'Entrada copia';
        } catch {
          // La entrada original puede pertenecer a una jornada distinta.
        }
      }
    }
  } catch (e) {
    error.value = e.message;
    return;
  }
  try {
    datosBancarios.value = await obtenerDatosBancarios();
  } catch {
    datosBancarios.value = null;
  }
}

function actualizarTiempo() {
  if (jornada.value) tiempoRestante.value = calcularTiempoRestante(jornada.value.fecha_cierre);
}

async function confirmarPago({ metodo, archivo, codigoCupon }) {
  error.value = '';
  errorPago.value = '';
  procesando.value = true;
  try {
    let comprobanteUrl = null;
    if (metodo === 'transferencia' && archivo) comprobanteUrl = await subirComprobante(archivo);
    const quiniela = await crearQuiniela({ jornadaId: jornada.value.id, alias: alias.value, metodoPago: metodo, montoPagado: metodo === 'cupon' ? 0 : jornada.value.costo, comprobanteUrl });
    await guardarPredicciones(quiniela.id, Object.entries(pronosticos.value).map(([partidoId, pronostico]) => ({ partidoId, pronostico })));
    if (metodo === 'cupon') await aplicarCupon(codigoCupon, quiniela.id);
    await notificarRegistro(quiniela.id);
    confirmacion.value = { alias: alias.value, jornada: jornada.value.nombre };
    paso.value = 'confirmacion';
  } catch (e) {
    errorPago.value = e.message?.toLowerCase().includes('comprobante') || e.message?.toLowerCase().includes('storage')
      ? 'No se pudo cargar el comprobante. Verifica que sea una imagen o PDF de máximo 8 MB e inténtalo de nuevo.'
      : e.message || 'No se pudo confirmar el pago. Revisa los datos e inténtalo de nuevo.';
    await alertaError(e, 'No se pudo registrar la quiniela');
  } finally {
    procesando.value = false;
  }
}

function revisarPronosticos() {
  if (!completo.value || bloqueado.value || necesitaLogin.value) return;
  paso.value = 'resumen';
}

onMounted(async () => { await cargar(); actualizarTiempo(); intervalo = setInterval(actualizarTiempo, 1000); });
onUnmounted(() => clearInterval(intervalo));
watch(() => route.params.jornadaId, async () => { await cargar(); actualizarTiempo(); });
</script>

<template>
  <main class="mx-auto max-w-3xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
    <header><p class="text-sm font-semibold uppercase tracking-widest text-quiniela-verde">Quinielas JR</p><h1 class="text-3xl font-bold text-quiniela-verdeOscuro">Llenar quiniela</h1></header>
    <div v-if="error" role="alert" class="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{{ error }}</div>
    <div v-if="!jornada" class="rounded-2xl border border-dashed bg-white p-8 text-center text-gray-500">No hay una jornada activa en este momento.</div>

    <template v-else>
      <nav class="flex items-center" aria-label="Progreso">
        <template v-for="(item, index) in ['Pronósticos', 'Resumen', 'Pago', 'Confirmación']" :key="item">
          <div class="flex min-w-0 flex-col items-center gap-1"><span class="grid h-8 w-8 place-items-center rounded-full text-sm font-bold" :class="(['pronosticos', 'resumen', 'pago', 'confirmacion'].indexOf(paso) >= index) ? 'bg-quiniela-verde text-white' : 'bg-gray-200 text-gray-500'">{{ ['pronosticos', 'resumen', 'pago', 'confirmacion'].indexOf(paso) > index ? '✓' : index + 1 }}</span><span class="text-center text-[11px] sm:text-sm">{{ item }}</span></div>
          <div v-if="index < 3" class="mb-5 h-0.5 flex-1" :class="['pronosticos', 'resumen', 'pago', 'confirmacion'].indexOf(paso) > index ? 'bg-quiniela-verde' : 'bg-gray-200'"></div>
        </template>
      </nav>

      <section v-if="paso !== 'confirmacion'" class="overflow-hidden rounded-2xl text-white shadow-lg" :class="colorContador">
        <div class="p-4 text-center sm:p-6"><p class="text-sm font-bold uppercase tracking-[0.2em]">Cierre de quiniela</p><div v-if="tiempoRestante && !tiempoRestante.vencido && jornada.estatus === 'activa'" class="mt-3 flex items-start justify-center gap-3 sm:gap-6"><div><strong class="text-3xl tabular-nums sm:text-4xl">{{ String(horasTotales).padStart(2, '0') }}</strong><span class="block text-[10px] tracking-widest">HRS</span></div><span class="text-3xl">:</span><div><strong class="text-3xl tabular-nums sm:text-4xl">{{ String(tiempoRestante.minutos).padStart(2, '0') }}</strong><span class="block text-[10px] tracking-widest">MIN</span></div><span class="text-3xl">:</span><div><strong class="text-3xl tabular-nums sm:text-4xl">{{ String(tiempoRestante.segundos).padStart(2, '0') }}</strong><span class="block text-[10px] tracking-widest">SEG</span></div></div><p v-else class="mt-3 text-2xl font-bold">Cerrada</p><p class="mt-3 font-semibold">{{ jornada.nombre }}</p><p class="text-sm opacity-90">{{ formatearFecha(jornada.fecha_cierre, { dateStyle: 'long', timeStyle: 'short' }) }} h CDMX</p></div>
      </section>

      <section v-if="paso === 'pronosticos'" class="space-y-4">
        <div v-if="bloqueado" role="status" class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm font-semibold text-amber-800">El registro ya cerró. Esta jornada solo está disponible para consulta.</div>
        <div v-if="necesitaLogin" class="rounded-2xl border border-quiniela-verde bg-green-50 p-4 text-center">
          <p class="mb-3 font-semibold text-quiniela-verdeOscuro">Regístrate o inicia sesión para llenar tu quiniela</p>
          <button type="button" @click="loginModalStore.abrir()" class="rounded-xl bg-quiniela-verde px-5 py-2.5 font-bold text-white">Iniciar sesión</button>
        </div>
        <label class="block text-sm font-semibold text-gray-700">Nombre de tu entrada<input v-model="alias" placeholder="Ej. José #2" maxlength="40" class="mt-1 w-full rounded-xl border-gray-300" :disabled="bloqueado || necesitaLogin" /></label>
        <div v-if="urgencia !== 'normal' && !bloqueado" role="status" class="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm font-semibold text-orange-800">El cierre está próximo. Revisa tus pronósticos y confirma tu entrada antes de {{ formatearFecha(jornada.fecha_cierre, { timeStyle: 'short' }) }} h CDMX.</div>
        <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><div class="flex items-center justify-between gap-3 text-sm"><span class="font-semibold text-quiniela-verdeOscuro">Progreso de pronósticos</span><strong :class="faltantes ? 'text-amber-700' : 'text-quiniela-verde'">{{ faltantes ? `Faltan ${faltantes}` : 'Completo' }}</strong></div><div class="mt-2 h-2 overflow-hidden rounded-full bg-gray-200"><div class="h-full bg-quiniela-verde transition-all" :style="{ width: `${progreso}%` }"></div></div></div>
        <div class="grid gap-4"><TarjetaPartido v-for="partido in partidos" :key="partido.id" :partido="partido" v-model="pronosticos[partido.id]" :deshabilitado="bloqueado || necesitaLogin" /></div>
        <button :disabled="bloqueado || necesitaLogin || !completo || !alias.trim()" @click="revisarPronosticos" class="w-full rounded-xl bg-quiniela-verde py-3 font-bold text-white disabled:opacity-50">Revisar quiniela</button>
        <p v-if="partidos.length !== 9" class="text-center text-sm text-amber-700">Esta jornada no contiene los 9 partidos requeridos.</p>
      </section>

      <section v-else-if="paso === 'resumen'" class="space-y-4"><button @click="paso = 'pronosticos'" class="text-sm font-semibold text-quiniela-verde">← Volver a pronósticos</button><article class="rounded-2xl bg-white p-5 shadow-sm sm:p-6"><div class="flex flex-col gap-1 border-b pb-4 sm:flex-row sm:items-end sm:justify-between"><div><p class="eyebrow">Resumen</p><h2 class="text-2xl font-bold text-quiniela-verdeOscuro">{{ alias }}</h2><p class="text-sm text-gray-500">{{ jornada.nombre }}</p></div><span class="rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-800">{{ partidosActivos.length }} de {{ partidosActivos.length }} seleccionados</span></div><ul class="mt-4 divide-y divide-gray-100"> <li v-for="partido in partidosActivos" :key="partido.id" class="flex items-center justify-between gap-3 py-3 text-sm"><span class="min-w-0 truncate font-semibold text-gray-700">{{ partido.equipo_local }} <span class="font-normal text-gray-400">vs</span> {{ partido.equipo_visitante }}</span><span class="shrink-0 rounded-full bg-green-50 px-2.5 py-1 font-bold text-quiniela-verde">{{ pronosticos[partido.id] === 'L' ? 'Local' : pronosticos[partido.id] === 'V' ? 'Visita' : 'Empate' }}</span></li></ul><dl class="mt-4 rounded-xl bg-gray-50 p-4 text-sm"><div class="flex justify-between gap-3"><dt class="text-gray-500">Costo</dt><dd class="font-bold">${{ Number(jornada.costo ?? 0).toLocaleString('es-MX') }}</dd></div><div class="mt-2 flex justify-between gap-3"><dt class="text-gray-500">Cierre</dt><dd class="text-right font-semibold">{{ formatearFecha(jornada.fecha_cierre, { dateStyle: 'medium', timeStyle: 'short' }) }} h CDMX</dd></div></dl></article><button @click="paso = 'pago'" class="w-full rounded-xl bg-quiniela-verde py-3 font-bold text-white">Continuar al pago</button></section>
      <section v-else-if="paso === 'pago'" class="space-y-3"><button @click="paso = 'resumen'" class="text-sm font-semibold text-quiniela-verde">← Volver al resumen</button><PasoPago :procesando="procesando" :datos-bancarios="datosBancarios" :error="errorPago" @confirmar="confirmarPago" /></section>

      <section v-else class="rounded-2xl bg-white p-6 text-center shadow-sm sm:p-10"><div class="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-green-100 text-3xl">✓</div><h2 class="text-2xl font-bold text-quiniela-verdeOscuro">¡Quiniela registrada!</h2><dl class="my-6 rounded-xl bg-gray-50 p-4 text-left"><div class="flex justify-between gap-4"><dt class="text-gray-500">Entrada</dt><dd class="font-semibold">{{ confirmacion.alias }}</dd></div><div class="mt-2 flex justify-between gap-4"><dt class="text-gray-500">Jornada</dt><dd class="font-semibold">{{ confirmacion.jornada }}</dd></div></dl><button @click="router.push('/mis-quinielas')" class="w-full rounded-xl bg-quiniela-verde py-3 font-bold text-white">Ver mi quiniela</button><p class="mt-3 text-sm text-gray-500">También enviamos la confirmación a tu correo.</p></section>
    </template>
  </main>
</template>
