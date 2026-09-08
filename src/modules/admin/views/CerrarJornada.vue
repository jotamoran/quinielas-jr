<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '@/lib/supabase';
import { cerrarJornada } from '../services/adminService';
import { alertaError, alertaExito, confirmarAccion } from '@/lib/alertas';

const jornadas = ref([]);
const resultado = ref(null);
const cargando = ref(false);

async function cargar() {
  const { data } = await supabase.from('jornadas').select('id, nombre, estatus').neq('estatus', 'finalizada');
  jornadas.value = data ?? [];
}

async function cerrar(id) {
  if (!await confirmarAccion({ title: 'Finalizar jornada', text: 'Se calcularán ganadores y se enviarán resultados. Esta acción no se puede editar después.', confirmText: 'Finalizar', danger: true })) return;
  cargando.value = true;
  try {
    resultado.value = await cerrarJornada(id);
    await cargar();
    await alertaExito('Jornada finalizada');
  } catch (error) {
    await alertaError(error);
  } finally {
    cargando.value = false;
  }
}

onMounted(cargar);
</script>

<template>
  <main class="page-shell max-w-3xl">
    <header><p class="eyebrow">Administración</p><h1 class="page-title">Cerrar jornada</h1><p class="page-description">Confirma primero los nueve resultados oficiales.</p></header>
    <div v-for="j in jornadas" :key="j.id" class="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <span>{{ j.nombre }} ({{ j.estatus }})</span>
      <button @click="cerrar(j.id)" :disabled="cargando" class="rounded-xl bg-quiniela-dorado px-4 py-3 font-semibold text-quiniela-grisTexto">
        Cerrar jornada y enviar resultados
      </button>
    </div>
    <pre v-if="resultado" class="bg-white rounded p-4 text-sm overflow-auto">{{ resultado }}</pre>
  </main>
</template>
