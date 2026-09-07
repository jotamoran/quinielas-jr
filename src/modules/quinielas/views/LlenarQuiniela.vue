<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import TarjetaPartido from '../components/TarjetaPartido.vue';
import PasoPago from '../components/PasoPago.vue';
import { calcularTiempoRestante, estaBloqueado } from '../utils/countdown';
import {
  obtenerJornadaActiva, obtenerPartidos, crearQuiniela, guardarPredicciones,
  subirComprobante, notificarRegistro, aplicarCupon,
} from '../services/quinielasService';

const jornada = ref(null);
const partidos = ref([]);
const pronosticos = ref({});
const alias = ref('Entrada 1');
const mostrarPago = ref(false);
const mensaje = ref('');
const tiempoRestante = ref(null);
let intervalo;

const bloqueado = computed(() => jornada.value && estaBloqueado(jornada.value.fecha_cierre));
const completo = computed(() => partidos.value.length > 0 && partidos.value.every((p) => pronosticos.value[p.id]));

async function cargar() {
  jornada.value = await obtenerJornadaActiva();
  if (jornada.value) partidos.value = await obtenerPartidos(jornada.value.id);
}

function actualizarTiempo() {
  if (jornada.value) tiempoRestante.value = calcularTiempoRestante(jornada.value.fecha_cierre);
}

async function confirmarPago({ metodo, archivo, codigoCupon }) {
  mensaje.value = '';
  let comprobanteUrl = null;
  if (metodo === 'transferencia' && archivo) {
    comprobanteUrl = await subirComprobante(archivo);
  }

  const quiniela = await crearQuiniela({
    jornadaId: jornada.value.id,
    alias: alias.value,
    metodoPago: metodo,
    montoPagado: metodo === 'cupon' ? 0 : jornada.value.costo,
    comprobanteUrl,
  });

  await guardarPredicciones(quiniela.id, Object.entries(pronosticos.value).map(([partidoId, pronostico]) => ({ partidoId, pronostico })));

  if (metodo === 'cupon') {
    await aplicarCupon(codigoCupon, quiniela.id);
  }

  await notificarRegistro(quiniela.id);
  mensaje.value = 'Quiniela registrada. Revisa tu correo para la confirmación.';
  mostrarPago.value = false;
  pronosticos.value = {};
}

onMounted(async () => {
  await cargar();
  actualizarTiempo();
  intervalo = setInterval(actualizarTiempo, 1000);
});
onUnmounted(() => clearInterval(intervalo));
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto space-y-4">
    <h1 class="text-2xl font-bold text-quiniela-verdeOscuro">Llenar quiniela</h1>

    <div v-if="!jornada" class="text-gray-500">No hay una jornada activa en este momento.</div>

    <template v-else>
      <div class="bg-quiniela-verdeOscuro text-white rounded-lg p-4 flex justify-between items-center">
        <span class="font-semibold">{{ jornada.nombre }}</span>
        <span v-if="tiempoRestante && !tiempoRestante.vencido">
          Cierra en {{ tiempoRestante.dias }}d {{ tiempoRestante.horas }}h {{ tiempoRestante.minutos }}m {{ tiempoRestante.segundos }}s
        </span>
        <span v-else class="text-quiniela-error font-semibold">Cerrada</span>
      </div>

      <input v-model="alias" placeholder="Nombre de tu entrada" class="w-full border rounded px-3 py-2" :disabled="bloqueado" />

      <div class="grid gap-3">
        <TarjetaPartido
          v-for="p in partidos" :key="p.id"
          :partido="p"
          v-model="pronosticos[p.id]"
          :deshabilitado="bloqueado"
        />
      </div>

      <button v-if="!mostrarPago" :disabled="bloqueado || !completo" @click="mostrarPago = true"
        class="w-full bg-quiniela-verde text-white font-semibold py-2 rounded disabled:opacity-50">
        Continuar al pago
      </button>

      <PasoPago v-if="mostrarPago" @confirmar="confirmarPago" />

      <p v-if="mensaje" class="text-quiniela-verdeAcento">{{ mensaje }}</p>
    </template>
  </div>
</template>
