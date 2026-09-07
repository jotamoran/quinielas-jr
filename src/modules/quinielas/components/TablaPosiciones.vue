<script setup>
import { ref, onMounted, watch } from 'vue';

const props = defineProps({
  jornadaId: { type: String, required: true },
  obtenerRankingFn: { type: Function, required: true },
});

const filas = ref([]);

async function cargar() {
  if (!props.jornadaId) return;
  filas.value = await props.obtenerRankingFn(props.jornadaId);
}

onMounted(cargar);
watch(() => props.jornadaId, cargar);

defineExpose({ recargar: cargar });
</script>

<template>
  <table class="w-full bg-white rounded-lg shadow overflow-hidden">
    <thead class="bg-quiniela-verdeOscuro text-white">
      <tr>
        <th class="px-4 py-2 text-left">Pos.</th>
        <th class="px-4 py-2 text-left">Participante</th>
        <th class="px-4 py-2 text-right">Aciertos</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="fila in filas" :key="fila.quiniela_id ?? fila.mostrar_como" class="border-b">
        <td class="px-4 py-2">{{ fila.posicion }}</td>
        <td class="px-4 py-2">{{ fila.alias ?? fila.mostrar_como ?? fila.nombre_completo }}</td>
        <td class="px-4 py-2 text-right font-semibold text-quiniela-verde">{{ fila.aciertos }}</td>
      </tr>
    </tbody>
  </table>
</template>
