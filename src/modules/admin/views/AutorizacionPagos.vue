<script setup>
import { ref, onMounted } from 'vue';
import { listarPagosPendientes, aprobarPago, rechazarPago, registrarPagoEfectivo, obtenerComprobanteUrl } from '../services/adminService';
import { alertaError, alertaExito, confirmarAccion } from '@/lib/alertas';

const pendientes = ref([]);
const cargando = ref(true);

async function cargar() {
  pendientes.value = await listarPagosPendientes();
}

async function verComprobante(path) {
  try {
    const url = await obtenerComprobanteUrl(path);
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (error) {
    await alertaError(error, 'No se pudo abrir el comprobante');
  }
}

async function aprobar(id) {
  if (!await confirmarAccion({ title: 'Marcar como pagada', confirmText: 'Confirmar pago' })) return;
  try { await aprobarPago(id); await cargar(); await alertaExito('Pago confirmado'); } catch (error) { await alertaError(error); }
}

async function rechazar(id) {
  if (!await confirmarAccion({ title: 'Cancelar quiniela', text: 'La entrada dejará de participar.', confirmText: 'Cancelar quiniela', danger: true })) return;
  try { await rechazarPago(id); await cargar(); await alertaExito('Quiniela cancelada'); } catch (error) { await alertaError(error); }
}

async function marcarEfectivo(id, monto) {
  if (!await confirmarAccion({ title: 'Confirmar pago en efectivo', text: 'La entrada comenzará a participar.', confirmText: 'Confirmar pago' })) return;
  try { await registrarPagoEfectivo(id, monto); await cargar(); await alertaExito('Pago en efectivo confirmado'); } catch (error) { await alertaError(error); }
}

onMounted(async () => {
  try { await cargar(); } catch (error) { await alertaError(error, 'No se pudieron cargar los pagos'); }
  finally { cargando.value = false; }
});
</script>

<template>
  <main class="page-shell max-w-4xl">
    <header><p class="eyebrow">Administración</p><h1 class="page-title">Pagos pendientes</h1><p class="page-description">Revisa comprobantes y confirma el estatus de cada entrada.</p></header>
    <div v-if="cargando" class="empty-state">Cargando pagos…</div>
    <template v-else>
      <div v-for="q in pendientes" :key="q.id" class="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="font-semibold">{{ q.perfiles?.nombre_completo }} — {{ q.jornadas?.nombre }}</p>
          <p class="text-sm text-gray-600">{{ q.alias }} · {{ q.metodo_pago }} · ${{ q.monto_pagado ?? '—' }}</p>
        </div>
        <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <button v-if="q.comprobante_url" @click="verComprobante(q.comprobante_url)" class="rounded-lg border px-3 py-2 text-sm font-semibold text-quiniela-verde">Comprobante</button>
          <button v-if="q.metodo_pago === 'efectivo'" @click="marcarEfectivo(q.id, q.monto_pagado)" class="rounded-lg bg-quiniela-dorado px-3 py-2 text-sm font-semibold text-quiniela-grisTexto">Pago efectivo</button>
          <button @click="aprobar(q.id)" class="rounded-lg bg-quiniela-verdeAcento px-3 py-2 text-sm font-semibold text-white">Marcar pagada</button>
          <button @click="rechazar(q.id)" class="rounded-lg bg-quiniela-error px-3 py-2 text-sm font-semibold text-white">Cancelar</button>
        </div>
      </div>
    </template>
    <div v-if="!cargando && !pendientes.length" class="empty-state">No hay pagos pendientes.</div>
  </main>
</template>
