<script setup>
import { ref, onMounted } from 'vue';
import { obtenerMisQuinielas, obtenerRanking, obtenerJornadaActiva } from '../services/quinielasService';
import { calcularResumenBalance } from '../utils/balance';
import TablaPosiciones from '../components/TablaPosiciones.vue';

const quinielas = ref([]);
const resumen = ref(null);
const jornadaActivaId = ref(null);

async function cargar() {
  quinielas.value = await obtenerMisQuinielas();
  resumen.value = calcularResumenBalance(quinielas.value);
  const jornadaActiva = await obtenerJornadaActiva();
  jornadaActivaId.value = jornadaActiva?.id ?? null;
}

onMounted(cargar);
</script>

<template>
  <main class="page-shell max-w-4xl">
    <header><p class="eyebrow">Mi cuenta</p><h1 class="page-title">Mis quinielas</h1><p class="page-description">Consulta tus entradas, pagos y resultados.</p></header>

    <div v-if="resumen" class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="bg-white rounded-lg shadow p-4 text-center">
        <p class="text-xs text-gray-500">Gastado</p>
        <p class="text-xl font-bold text-quiniela-verde">${{ resumen.totalGastado }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4 text-center">
        <p class="text-xs text-gray-500">Jornadas jugadas</p>
        <p class="text-xl font-bold text-quiniela-verde">{{ resumen.jornadasJugadas }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4 text-center">
        <p class="text-xs text-gray-500">Aciertos promedio</p>
        <p class="text-xl font-bold text-quiniela-verde">{{ resumen.aciertosPromedio }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4 text-center">
        <p class="text-xs text-gray-500">Mejor posición</p>
        <p class="text-xl font-bold text-quiniela-dorado">{{ resumen.mejorPosicion ?? '—' }}</p>
      </div>
    </div>

    <p v-if="quinielas.some((q) => q.estatus_pago !== 'aprobado')" class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
      Solo participan en el sorteo y en la tabla de posiciones las quinielas con el pago confirmado. Si una entrada tuya aparece como <b>Pendiente</b>, complétala pagando (o preséntate con quien organiza) para poder participar.
    </p>

    <div v-if="quinielas.length" class="grid gap-3 sm:hidden">
      <article v-for="q in quinielas" :key="q.id" class="rounded-2xl bg-white p-4 shadow-sm"><div class="flex items-start justify-between gap-3"><div><p class="font-bold text-quiniela-verdeOscuro">{{ q.alias }}</p><p class="text-sm text-gray-500">{{ q.jornadas?.nombre }}</p></div><span class="rounded-full px-2 py-1 text-xs font-bold" :class="q.estatus_pago === 'aprobado' ? 'bg-green-100 text-green-800' : q.estatus_pago === 'rechazado' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'">{{ q.estatus_pago === 'aprobado' ? 'Pagada' : q.estatus_pago === 'rechazado' ? 'Cancelada' : 'Pendiente' }}</span></div><p v-if="q.estatus_pago !== 'aprobado'" class="mt-2 text-xs text-amber-700">No estás participando todavía — falta confirmar tu pago.</p><p class="mt-4 border-t pt-3 text-sm"><span class="text-gray-500">Aciertos:</span> <strong class="text-quiniela-verde">{{ q.aciertos }}</strong></p></article>
    </div>
    <div v-if="quinielas.length" class="hidden overflow-x-auto sm:block">
      <table class="w-full bg-white rounded-lg shadow overflow-hidden">
        <thead class="bg-quiniela-verdeOscuro text-white">
          <tr>
            <th class="px-4 py-2 text-left">Jornada</th>
            <th class="px-4 py-2 text-left">Entrada</th>
            <th class="px-4 py-2 text-left">Pago</th>
            <th class="px-4 py-2 text-right">Aciertos</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="q in quinielas" :key="q.id" class="border-b">
            <td class="px-4 py-2">{{ q.jornadas?.nombre }}</td>
            <td class="px-4 py-2">{{ q.alias }}</td>
            <td class="px-4 py-2">{{ q.estatus_pago === 'aprobado' ? 'Pagada' : q.estatus_pago === 'rechazado' ? 'Cancelada' : 'Pendiente' }}<span v-if="q.estatus_pago !== 'aprobado'" class="ml-2 text-xs text-amber-700">(no participa todavía)</span></td>
            <td class="px-4 py-2 text-right">{{ q.aciertos }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-if="!quinielas.length" class="empty-state">Aún no has registrado una quiniela.</div>

    <div v-if="jornadaActivaId">
      <h2 class="font-semibold text-quiniela-verde mb-2">Tabla de posiciones</h2>
      <TablaPosiciones :jornadaId="jornadaActivaId" :obtenerRankingFn="obtenerRanking" />
    </div>
  </main>
</template>
