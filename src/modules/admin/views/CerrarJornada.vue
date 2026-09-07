<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '@/lib/supabase';
import { cerrarJornada } from '../services/adminService';

const jornadas = ref([]);
const resultado = ref(null);
const cargando = ref(false);

async function cargar() {
  const { data } = await supabase.from('jornadas').select('id, nombre, estatus').neq('estatus', 'finalizada');
  jornadas.value = data ?? [];
}

async function cerrar(id) {
  cargando.value = true;
  try {
    resultado.value = await cerrarJornada(id);
    await cargar();
  } finally {
    cargando.value = false;
  }
}

onMounted(cargar);
</script>

<template>
  <div class="p-6 max-w-2xl mx-auto space-y-4">
    <h1 class="text-2xl font-bold text-quiniela-verdeOscuro">Cerrar jornada</h1>
    <p class="text-sm text-gray-600">Sincroniza los resultados antes de cerrar la jornada.</p>
    <div v-for="j in jornadas" :key="j.id" class="bg-white rounded-lg shadow p-4 flex justify-between items-center">
      <span>{{ j.nombre }} ({{ j.estatus }})</span>
      <button @click="cerrar(j.id)" :disabled="cargando" class="bg-quiniela-dorado text-quiniela-grisTexto font-semibold px-4 py-2 rounded">
        Cerrar jornada y enviar resultados
      </button>
    </div>
    <pre v-if="resultado" class="bg-white rounded p-4 text-sm overflow-auto">{{ resultado }}</pre>
  </div>
</template>
