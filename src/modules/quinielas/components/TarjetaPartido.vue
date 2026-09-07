<script setup>
defineProps({
  partido: { type: Object, required: true },
  modelValue: { type: String, default: null },
  deshabilitado: { type: Boolean, default: false },
});
defineEmits(['update:modelValue']);
</script>

<template>
  <div class="bg-white rounded-lg shadow p-4">
    <p class="text-xs text-quiniela-verde font-semibold mb-2">{{ partido.liga_nombre }}</p>
    <p class="text-center font-semibold mb-3">{{ partido.equipo_local }} vs {{ partido.equipo_visitante }}</p>
    <div class="grid grid-cols-3 gap-2">
      <button v-for="opcion in ['L', 'E', 'V']" :key="opcion"
        :disabled="deshabilitado"
        @click="$emit('update:modelValue', opcion)"
        :class="[
          'py-2 rounded font-semibold border',
          modelValue === opcion ? 'bg-quiniela-dorado border-quiniela-doradoOscuro text-quiniela-grisTexto' : 'border-gray-300 text-gray-600',
          deshabilitado ? 'opacity-50 cursor-not-allowed' : 'hover:border-quiniela-verde'
        ]">
        {{ opcion }}
      </button>
    </div>
  </div>
</template>
