<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '@/lib/supabase';
import { cerrarJornada } from '../services/adminService';
import { alertaAdvertencia, alertaError, alertaExito, confirmarAccion } from '@/lib/alertas';

const jornadas = ref([]);
const resultado = ref(null);
const cargando = ref(false);

async function cargar() {
  const { data, error } = await supabase.from('jornadas').select('id, nombre, estatus').not('estatus', 'in', '(finalizada,cancelada)');
  if (error) throw error;
  jornadas.value = data ?? [];
}

async function cerrar(id) {
  if (!await confirmarAccion({ title: 'Finalizar jornada', text: 'Se calcularán ganadores y se enviarán resultados. Esta acción no se puede editar después.', confirmText: 'Finalizar', danger: true })) return;
  cargando.value = true;
  try {
    resultado.value = await cerrarJornada(id);
    await cargar();
    if (resultado.value.avisos?.length) {
      await alertaAdvertencia('Jornada finalizada con avisos', 'Revisa el resumen para conocer las notificaciones que no pudieron completarse.');
    } else {
      await alertaExito('Jornada finalizada', 'Ganadores y cupón quedaron registrados.');
    }
  } catch (error) {
    await alertaError(error);
  } finally {
    cargando.value = false;
  }
}

onMounted(async () => {
  try { await cargar(); } catch (error) { await alertaError(error, 'No se pudieron cargar las jornadas'); }
});
</script>

<template>
  <main class="page-shell max-w-3xl">
    <header><p class="eyebrow">Administración</p><h1 class="page-title">Cerrar jornada</h1><p class="page-description">Confirma primero los nueve resultados oficiales.</p></header>
    <div v-for="j in jornadas" :key="j.id" class="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <span>{{ j.nombre }} ({{ j.estatus }})</span>
      <button @click="cerrar(j.id)" :disabled="cargando" class="min-h-11 w-full rounded-xl bg-quiniela-dorado px-4 py-3 font-semibold text-quiniela-grisTexto disabled:opacity-60 sm:w-auto">
        Cerrar jornada y enviar resultados
      </button>
    </div>
    <section v-if="resultado" class="rounded-2xl border border-green-200 bg-white p-5 shadow-sm">
      <h2 class="text-lg font-bold text-quiniela-verdeOscuro">Resumen del cierre</h2>
      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div class="rounded-xl bg-green-50 p-4"><p class="text-sm text-gray-600">Ganadores</p><p class="text-2xl font-bold text-quiniela-verde">{{ resultado.ganadores?.length ?? 0 }}</p></div>
        <div class="rounded-xl bg-amber-50 p-4"><p class="text-sm text-gray-600">Cupón de consolación</p><p class="font-bold text-amber-800">{{ resultado.cuponGenerado ? 'Asignado' : resultado.peor ? 'Sin medio de contacto' : 'No aplica' }}</p></div>
      </div>
      <div v-if="resultado.avisos?.length" role="alert" class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <p class="font-bold">Revisa estos avisos</p>
        <ul class="mt-2 list-disc space-y-1 pl-5"><li v-for="aviso in resultado.avisos" :key="aviso">{{ aviso }}</li></ul>
      </div>
    </section>
  </main>
</template>
