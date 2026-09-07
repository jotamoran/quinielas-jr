<script setup>
import { ref, onMounted } from 'vue';
import { obtenerMisQuinielas, obtenerRanking } from '../services/quinielasService';
import { calcularResumenBalance } from '../utils/balance';
import TablaPosiciones from '../components/TablaPosiciones.vue';

const quinielas = ref([]);
const resumen = ref(null);
const jornadaActivaId = ref(null);

async function cargar() {
  quinielas.value = await obtenerMisQuinielas();
  resumen.value = calcularResumenBalance(quinielas.value);
  jornadaActivaId.value = quinielas.value[0]?.jornada_id ?? null;
}

onMounted(cargar);
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto space-y-6">
    <h1 class="text-2xl font-bold text-quiniela-verdeOscuro">Mis quinielas</h1>

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
          <td class="px-4 py-2">{{ q.estatus_pago }} ({{ q.metodo_pago }})</td>
          <td class="px-4 py-2 text-right">{{ q.aciertos }}</td>
        </tr>
      </tbody>
    </table>

    <div v-if="jornadaActivaId">
      <h2 class="font-semibold text-quiniela-verde mb-2">Tabla de posiciones</h2>
      <TablaPosiciones :jornadaId="jornadaActivaId" :obtenerRankingFn="obtenerRanking" />
    </div>
  </div>
</template>
