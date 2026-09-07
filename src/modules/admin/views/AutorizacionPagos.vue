<script setup>
import { ref, onMounted } from 'vue';
import { listarPagosPendientes, aprobarPago, rechazarPago, registrarPagoEfectivo, obtenerComprobanteUrl } from '../services/adminService';

const pendientes = ref([]);

async function cargar() {
  pendientes.value = await listarPagosPendientes();
}

async function verComprobante(path) {
  const url = await obtenerComprobanteUrl(path);
  window.open(url, '_blank');
}

async function aprobar(id) {
  await aprobarPago(id);
  await cargar();
}

async function rechazar(id) {
  await rechazarPago(id);
  await cargar();
}

async function marcarEfectivo(id, monto) {
  await registrarPagoEfectivo(id, monto);
  await cargar();
}

onMounted(cargar);
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto space-y-4">
    <h1 class="text-2xl font-bold text-quiniela-verdeOscuro">Autorización de pagos</h1>
    <div v-for="q in pendientes" :key="q.id" class="bg-white rounded-lg shadow p-4 flex justify-between items-center">
      <div>
        <p class="font-semibold">{{ q.perfiles?.nombre_completo }} — {{ q.jornadas?.nombre }}</p>
        <p class="text-sm text-gray-600">{{ q.alias }} · {{ q.metodo_pago }} · ${{ q.monto_pagado ?? '—' }}</p>
      </div>
      <div class="flex gap-2">
        <button v-if="q.comprobante_url" @click="verComprobante(q.comprobante_url)" class="text-quiniela-verde underline text-sm">Ver comprobante</button>
        <button v-if="q.metodo_pago === 'efectivo'" @click="marcarEfectivo(q.id, q.monto_pagado)" class="bg-quiniela-dorado text-quiniela-grisTexto px-3 py-1 rounded text-sm">Marcar pagado</button>
        <button @click="aprobar(q.id)" class="bg-quiniela-verdeAcento text-white px-3 py-1 rounded text-sm">Aprobar</button>
        <button @click="rechazar(q.id)" class="bg-quiniela-error text-white px-3 py-1 rounded text-sm">Rechazar</button>
      </div>
    </div>
    <p v-if="!pendientes.length" class="text-gray-500">No hay pagos pendientes.</p>
  </div>
</template>
