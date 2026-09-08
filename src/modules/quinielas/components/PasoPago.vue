<script setup>
import { computed, ref } from 'vue';

const props = defineProps({ procesando: { type: Boolean, default: false } });
const emit = defineEmits(['confirmar']);
const metodo = ref('transferencia');
const archivo = ref(null);
const codigoCupon = ref('');
const valido = computed(() => metodo.value !== 'transferencia' || Boolean(archivo.value));

function onArchivo(evento) { archivo.value = evento.target.files[0] ?? null; }
function confirmar() { if (valido.value && !props.procesando) emit('confirmar', { metodo: metodo.value, archivo: archivo.value, codigoCupon: codigoCupon.value.trim() }); }
</script>

<template>
  <div class="space-y-5 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
    <div><h2 class="text-xl font-bold text-quiniela-verdeOscuro">Método de pago</h2><p class="text-sm text-gray-500">Elige cómo quieres registrar tu entrada.</p></div>
    <div class="grid gap-2 sm:grid-cols-3"><label v-for="opcion in [{ value: 'transferencia', label: 'Transferencia' }, { value: 'efectivo', label: 'Efectivo' }, { value: 'cupon', label: 'Cupón' }]" :key="opcion.value" class="cursor-pointer rounded-xl border p-3 text-center font-semibold" :class="metodo === opcion.value ? 'border-quiniela-verde bg-green-50 text-quiniela-verdeOscuro' : 'border-gray-200'"><input v-model="metodo" type="radio" :value="opcion.value" class="sr-only" />{{ opcion.label }}</label></div>
    <div v-if="metodo === 'transferencia'" class="space-y-3"><p class="rounded-xl bg-quiniela-grisClaro p-3 text-sm">CLABE: 000000000000000000<br />Banco: Ejemplo · Beneficiario: Quinielas JR</p><label class="block text-sm font-semibold">Comprobante<input type="file" accept="image/*,application/pdf" @change="onArchivo" class="mt-1 block w-full text-sm" /></label></div>
    <p v-else-if="metodo === 'efectivo'" class="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">Tu quiniela quedará pendiente hasta que el administrador confirme el pago.</p>
    <label v-else class="block text-sm font-semibold">Código de cupón<input v-model="codigoCupon" class="mt-1 w-full rounded-xl border-gray-300 uppercase" /></label>
    <button @click="confirmar" :disabled="!valido || procesando || (metodo === 'cupon' && !codigoCupon.trim())" class="w-full rounded-xl bg-quiniela-dorado py-3 font-bold text-quiniela-grisTexto disabled:opacity-50">{{ procesando ? 'Registrando…' : 'Confirmar quiniela' }}</button>
  </div>
</template>
