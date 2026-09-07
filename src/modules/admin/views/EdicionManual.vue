<script setup>
import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { editarQuinielaManual } from '../services/adminService';

const quinielaId = ref('');
const quiniela = ref(null);
const mensaje = ref('');

async function buscar() {
  const { data } = await supabase.from('quinielas').select('*').eq('id', quinielaId.value).single();
  quiniela.value = data;
}

async function guardar() {
  await editarQuinielaManual(quiniela.value.id, {
    alias: quiniela.value.alias,
    estatus_pago: quiniela.value.estatus_pago,
    metodo_pago: quiniela.value.metodo_pago,
    monto_pagado: quiniela.value.monto_pagado,
  });
  mensaje.value = 'Quiniela actualizada.';
}
</script>

<template>
  <div class="p-6 max-w-xl mx-auto space-y-4">
    <h1 class="text-2xl font-bold text-quiniela-verdeOscuro">Edición manual de quiniela</h1>
    <div class="flex gap-2">
      <input v-model="quinielaId" placeholder="ID de la quiniela" class="flex-1 border rounded px-3 py-2" />
      <button @click="buscar" class="bg-quiniela-verde text-white px-4 py-2 rounded">Buscar</button>
    </div>
    <div v-if="quiniela" class="bg-white rounded-lg shadow p-4 space-y-3">
      <input v-model="quiniela.alias" placeholder="Alias" class="w-full border rounded px-3 py-2" />
      <select v-model="quiniela.estatus_pago" class="w-full border rounded px-3 py-2">
        <option value="pendiente">pendiente</option>
        <option value="aprobado">aprobado</option>
        <option value="rechazado">rechazado</option>
      </select>
      <select v-model="quiniela.metodo_pago" class="w-full border rounded px-3 py-2">
        <option value="transferencia">transferencia</option>
        <option value="efectivo">efectivo</option>
        <option value="cupon">cupon</option>
      </select>
      <input v-model="quiniela.monto_pagado" type="number" placeholder="Monto pagado" class="w-full border rounded px-3 py-2" />
      <button @click="guardar" class="bg-quiniela-dorado text-quiniela-grisTexto font-semibold px-4 py-2 rounded">Guardar</button>
      <p v-if="mensaje" class="text-quiniela-verdeAcento">{{ mensaje }}</p>
    </div>
  </div>
</template>
