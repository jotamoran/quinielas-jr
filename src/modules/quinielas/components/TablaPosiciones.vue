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
  <div v-if="filas.length" class="grid gap-2 sm:hidden">
    <div v-for="fila in filas" :key="fila.quiniela_id ?? fila.mostrar_como" class="grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-xl bg-white p-3 shadow-sm"><span class="grid h-9 w-9 place-items-center rounded-full bg-green-50 font-bold text-quiniela-verde">{{ fila.posicion }}</span><span class="font-semibold">{{ fila.alias ?? fila.mostrar_como ?? fila.nombre_completo }}</span><span class="font-bold text-quiniela-verde">{{ fila.aciertos }}</span></div>
  </div>
  <div v-if="filas.length" class="hidden overflow-x-auto sm:block">
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
  </div>
  <div v-else class="empty-state">La tabla de posiciones aparecerá cuando existan entradas pagadas.</div>
</template>
