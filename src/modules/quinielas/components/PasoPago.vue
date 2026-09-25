<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({ procesando: { type: Boolean, default: false }, datosBancarios: { type: Object, default: null }, error: { type: String, default: '' } });
const emit = defineEmits(['confirmar']);
const metodo = ref('transferencia');
const archivo = ref(null);
const errorArchivo = ref('');
const codigoCupon = ref('');
const cantidad = ref(1);
const transferenciaDisponible = computed(() => Boolean(props.datosBancarios?.clabe));
const valido = computed(() => metodo.value !== 'transferencia' || (transferenciaDisponible.value && Boolean(archivo.value)));

watch(transferenciaDisponible, (disponible) => {
  if (!disponible && metodo.value === 'transferencia') metodo.value = 'efectivo';
}, { immediate: true });

function onArchivo(evento) {
  const seleccionado = evento.target.files[0] ?? null;
  errorArchivo.value = '';
  if (seleccionado && !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(seleccionado.type)) {
    errorArchivo.value = 'El comprobante debe ser una imagen o un archivo PDF.';
    evento.target.value = '';
    archivo.value = null;
    return;
  }
  if (seleccionado && seleccionado.size > 8 * 1024 * 1024) {
    errorArchivo.value = 'El comprobante debe pesar como máximo 8 MB.';
    evento.target.value = '';
    archivo.value = null;
    return;
  }
  archivo.value = seleccionado;
}
function confirmar() { if (valido.value && !props.procesando) emit("confirmar", { metodo: metodo.value, archivo: archivo.value, codigoCupon: codigoCupon.value.trim(), cantidad: Math.min(10, Math.max(1, Number(cantidad.value) || 1)) }); }
</script>

<template>
  <div class="space-y-5 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
    <p v-if="props.error" role="alert" class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{{ props.error }}</p>
    <div><h2 class="text-xl font-bold text-quiniela-verdeOscuro">Método de pago</h2><p class="text-sm text-gray-500">Elige cómo quieres registrar tu entrada.</p></div>
    <fieldset><legend class="sr-only">Método de pago</legend><div class="grid gap-2 sm:grid-cols-3"><label v-for="opcion in [{ value: 'transferencia', label: 'Transferencia' }, { value: 'efectivo', label: 'Efectivo' }, { value: 'cupon', label: 'Cupón' }]" :key="opcion.value" class="rounded-xl border p-3 text-center font-semibold" :class="[metodo === opcion.value ? 'border-quiniela-verde bg-green-50 text-quiniela-verdeOscuro' : 'border-gray-200', opcion.value === 'transferencia' && !transferenciaDisponible ? 'cursor-not-allowed opacity-50' : 'cursor-pointer']"><input v-model="metodo" type="radio" :value="opcion.value" :disabled="opcion.value === 'transferencia' && !transferenciaDisponible" class="sr-only" />{{ opcion.label }}</label></div></fieldset>
    <p v-if="!transferenciaDisponible" role="status" class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">La transferencia estará disponible cuando el administrador configure los datos bancarios.</p>
    <div v-if="metodo === 'transferencia'" class="space-y-3">
      <p v-if="datosBancarios?.clabe" class="rounded-xl bg-quiniela-grisClaro p-3 text-sm">CLABE: {{ datosBancarios.clabe }}<br />Banco: {{ datosBancarios.banco }} · Beneficiario: {{ datosBancarios.titular }}</p>
      <p v-else class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Todavía no hay datos bancarios configurados. Contacta a quien organiza la quiniela.</p>
      <label class="block text-sm font-semibold">Número de quinielas<input v-model.number="cantidad" type="number" min="1" max="10" class="mt-1 w-full rounded-xl border-gray-300" /><span class="mt-1 block text-xs font-normal text-gray-500">Un comprobante cubre de 1 a 10 entradas de esta jornada. Después podrás editar los pronósticos de cada entrada antes del cierre.</span></label>
      <label class="block text-sm font-semibold">Comprobante<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" @change="onArchivo" class="mt-1 block w-full text-sm" /><span class="mt-1 block text-xs font-normal text-gray-500">JPG, PNG, WEBP o PDF, máximo 8 MB.</span><span v-if="archivo" class="mt-1 block text-xs font-normal text-quiniela-verde">Archivo seleccionado: {{ archivo.name }}</span><span v-if="errorArchivo" role="alert" class="mt-1 block text-xs font-normal text-red-700">{{ errorArchivo }}</span></label>
    </div>
    <p v-else-if="metodo === 'efectivo'" class="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">Tu quiniela quedará pendiente hasta que el administrador confirme el pago.</p>
    <label v-else class="block text-sm font-semibold">Código de cupón<input v-model="codigoCupon" class="mt-1 w-full rounded-xl border-gray-300 uppercase" /></label>
    <button @click="confirmar" :disabled="!valido || procesando || (metodo === 'cupon' && !codigoCupon.trim())" class="w-full rounded-xl bg-quiniela-dorado py-3 font-bold text-quiniela-grisTexto disabled:opacity-50">{{ procesando ? 'Registrando…' : 'Confirmar quiniela' }}</button>
  </div>
</template>
