<script setup>
import { computed, ref, onMounted } from 'vue';
import { listarPagosPendientes, aprobarPago, rechazarPago, registrarPagoEfectivo, obtenerComprobanteUrl } from '../services/adminService';
import { alertaError, alertaExito, confirmarAccion } from '@/lib/alertas';
import EsqueletoCarga from '@/components/EsqueletoCarga.vue';

const pendientes = ref([]);
const cargando = ref(true);
const procesando = ref('');
const filtro = ref('');
const filtroMetodo = ref('todos');
const desde = ref('');
const hasta = ref('');
const pagosFiltrados = computed(() => pendientes.value.filter((q) => {
  const texto = `${q.alias} ${q.perfiles?.nombre_completo} ${q.perfiles?.username} ${q.jornadas?.nombre}`.toLowerCase();
  const fecha = q.creado_el?.slice(0, 10);
  return texto.includes(filtro.value.trim().toLowerCase())
    && (filtroMetodo.value === 'todos' || q.metodo_pago === filtroMetodo.value)
    && (!desde.value || fecha >= desde.value)
    && (!hasta.value || fecha <= hasta.value);
}));

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
  procesando.value = `${id}:aprobar`;
  try { await aprobarPago(id); await cargar(); await alertaExito('Pago confirmado'); } catch (error) { await alertaError(error); }
  finally { procesando.value = ''; }
}

async function rechazar(id) {
  if (!await confirmarAccion({ title: 'Cancelar quiniela', text: 'La entrada dejará de participar.', confirmText: 'Cancelar quiniela', danger: true })) return;
  procesando.value = `${id}:rechazar`;
  try { await rechazarPago(id); await cargar(); await alertaExito('Quiniela cancelada'); } catch (error) { await alertaError(error); }
  finally { procesando.value = ''; }
}

async function marcarEfectivo(id, monto) {
  if (!await confirmarAccion({ title: 'Confirmar pago en efectivo', text: 'La entrada comenzará a participar.', confirmText: 'Confirmar pago' })) return;
  procesando.value = `${id}:efectivo`;
  try { await registrarPagoEfectivo(id, monto); await cargar(); await alertaExito('Pago en efectivo confirmado'); } catch (error) { await alertaError(error); }
  finally { procesando.value = ''; }
}

onMounted(async () => {
  try { await cargar(); } catch (error) { await alertaError(error, 'No se pudieron cargar los pagos'); }
  finally { cargando.value = false; }
});
</script>

<template>
  <main class="page-shell max-w-4xl">
    <header><p class="eyebrow">Administración</p><h1 class="page-title">Pagos pendientes</h1><p class="page-description">Revisa comprobantes y confirma el estatus de cada entrada.</p></header>
    <EsqueletoCarga v-if="cargando" :cantidad="2" />
    <template v-else>
      <div class="grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"><label class="form-label">Buscar pendiente<input v-model="filtro" type="search" placeholder="Nombre, usuario o jornada" class="form-control" /></label><label class="form-label">Método<select v-model="filtroMetodo" class="form-control"><option value="todos">Todos</option><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="cupon">Cupón</option></select></label><label class="form-label">Desde<input v-model="desde" type="date" class="form-control" /></label><label class="form-label">Hasta<input v-model="hasta" type="date" class="form-control" /></label></div>
      <div v-for="q in pagosFiltrados" :key="q.id" class="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="font-semibold">{{ q.perfiles?.nombre_completo }} <span v-if="q.perfiles?.username" class="font-normal text-gray-500">(@{{ q.perfiles.username }})</span> — {{ q.jornadas?.nombre }}</p>
          <p class="text-sm text-gray-600">{{ q.alias }} · {{ q.metodo_pago }} · ${{ q.monto_pagado ?? '—' }}<span v-if="q.creado_el"> · Registrado {{ new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone: 'America/Mexico_City' }).format(new Date(q.creado_el)) }}</span><span v-if="q.correo_contacto"> · {{ q.correo_contacto }}</span></p>
        </div>
        <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <button v-if="q.comprobante_url" @click="verComprobante(q.comprobante_url)" class="rounded-lg border px-3 py-2 text-sm font-semibold text-quiniela-verde">Comprobante</button>
          <button v-if="q.metodo_pago === 'efectivo'" @click="marcarEfectivo(q.id, q.monto_pagado)" :disabled="!!procesando" class="rounded-lg bg-quiniela-dorado px-3 py-2 text-sm font-semibold text-quiniela-grisTexto disabled:opacity-60">{{ procesando === `${q.id}:efectivo` ? 'Confirmando…' : 'Pago efectivo' }}</button>
          <button @click="aprobar(q.id)" :disabled="!!procesando" class="rounded-lg bg-quiniela-verdeAcento px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{{ procesando === `${q.id}:aprobar` ? 'Guardando…' : 'Marcar pagada' }}</button>
          <button @click="rechazar(q.id)" :disabled="!!procesando" class="rounded-lg bg-quiniela-error px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{{ procesando === `${q.id}:rechazar` ? 'Rechazando…' : 'Rechazar pago' }}</button>
        </div>
      </div>
    </template>
    <div v-if="!cargando && !pagosFiltrados.length" class="empty-state">{{ pendientes.length ? 'No hay coincidencias.' : 'No hay pagos pendientes.' }}</div>
  </main>
</template>
