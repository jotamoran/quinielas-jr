<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '@/lib/supabase';
import { sincronizarResultados } from '../services/adminService';

const jornadas = ref([]);
const mensaje = ref('');
const cargando = ref(false);

async function cargar() {
  const { data } = await supabase.from('jornadas').select('id, nombre, estatus').neq('estatus', 'finalizada');
  jornadas.value = data ?? [];
}

async function sincronizar(id) {
  cargando.value = true;
  mensaje.value = '';
  try {
    await sincronizarResultados(id);
    mensaje.value = 'Resultados sincronizados.';
  } finally {
    cargando.value = false;
  }
}

onMounted(cargar);
</script>

<template>
  <div class="p-6 max-w-2xl mx-auto space-y-4">
    <h1 class="text-2xl font-bold text-quiniela-verdeOscuro">Sincronizar resultados</h1>
    <div v-for="j in jornadas" :key="j.id" class="bg-white rounded-lg shadow p-4 flex justify-between items-center">
      <span>{{ j.nombre }} ({{ j.estatus }})</span>
      <button @click="sincronizar(j.id)" :disabled="cargando" class="bg-quiniela-verde text-white px-4 py-2 rounded">
        Sincronizar marcadores
      </button>
    </div>
    <p v-if="mensaje" class="text-quiniela-verdeAcento">{{ mensaje }}</p>
  </div>
</template>
