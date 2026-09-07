<script setup>
import { ref } from 'vue';

const emit = defineEmits(['confirmar']);
const metodo = ref('transferencia');
const archivo = ref(null);
const codigoCupon = ref('');

function onArchivo(evento) {
  archivo.value = evento.target.files[0] ?? null;
}

function confirmar() {
  emit('confirmar', { metodo: metodo.value, archivo: archivo.value, codigoCupon: codigoCupon.value });
}
</script>

<template>
  <div class="bg-white rounded-lg shadow p-4 space-y-4">
    <h2 class="font-semibold text-quiniela-verde">Método de pago</h2>
    <div class="flex gap-4">
      <label class="flex items-center gap-1"><input type="radio" value="transferencia" v-model="metodo" /> Transferencia SPEI</label>
      <label class="flex items-center gap-1"><input type="radio" value="efectivo" v-model="metodo" /> Efectivo</label>
      <label class="flex items-center gap-1"><input type="radio" value="cupon" v-model="metodo" /> Cupón</label>
    </div>

    <div v-if="metodo === 'transferencia'" class="space-y-2">
      <p class="text-sm bg-quiniela-grisClaro p-3 rounded">CLABE: 000000000000000000 · Banco: Ejemplo · Beneficiario: Quinielas JR</p>
      <input type="file" accept="image/*,application/pdf" @change="onArchivo" />
    </div>

    <p v-else-if="metodo === 'efectivo'" class="text-sm text-gray-600">
      Contacta al administrador para pagar en persona; tu quiniela quedará pendiente hasta que confirme el pago.
    </p>

    <div v-else class="space-y-2">
      <input v-model="codigoCupon" placeholder="Código de cupón" class="w-full border rounded px-3 py-2" />
    </div>

    <button @click="confirmar" class="w-full bg-quiniela-dorado text-quiniela-grisTexto font-semibold py-2 rounded">
      Confirmar quiniela
    </button>
  </div>
</template>
