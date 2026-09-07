<script setup>
import { ref } from 'vue';
import { buscarFixtures, crearJornada } from '../services/adminService';
import { LIGAS_DISPONIBLES } from '../utils/ligas';

const ligasSeleccionadas = ref(['4350']); // Liga MX por default
const desde = ref('');
const hasta = ref('');
const fixtures = ref([]);
const seleccionados = ref([]);
const nombreJornada = ref('');
const costo = ref(50);
const premio = ref(0);
const fechaCierre = ref('');
const mensaje = ref('');

async function buscar() {
  mensaje.value = '';
  const { fixtures: encontrados } = await buscarFixtures({
    leagues: ligasSeleccionadas.value,
    from: desde.value,
    to: hasta.value,
  });
  fixtures.value = encontrados;
}

function alternarSeleccion(fixture) {
  const index = seleccionados.value.findIndex((f) => f.fixture.id === fixture.fixture.id);
  if (index >= 0) seleccionados.value.splice(index, 1);
  else seleccionados.value.push(fixture);
}

async function guardarJornada() {
  await crearJornada({
    nombre: nombreJornada.value,
    costo: costo.value,
    premio: premio.value,
    fechaCierre: fechaCierre.value,
    partidosSeleccionados: seleccionados.value,
  });
  mensaje.value = 'Jornada creada correctamente.';
  seleccionados.value = [];
  fixtures.value = [];
  nombreJornada.value = '';
  costo.value = 50;
  premio.value = 0;
  fechaCierre.value = '';
}
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto space-y-6">
    <h1 class="text-2xl font-bold text-quiniela-verdeOscuro">Gestión de jornadas</h1>

    <section class="bg-white rounded-lg shadow p-4 space-y-3">
      <p class="text-sm font-semibold text-quiniela-verde">Ligas / competiciones</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label v-for="liga in LIGAS_DISPONIBLES" :key="liga.id" class="flex items-center gap-2">
          <input type="checkbox" :value="liga.id" v-model="ligasSeleccionadas" />
          <span>{{ liga.nombre }}</span>
        </label>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input v-model="desde" type="date" class="border rounded px-3 py-2" />
        <input v-model="hasta" type="date" class="border rounded px-3 py-2" />
      </div>
      <button @click="buscar" :disabled="!ligasSeleccionadas.length" class="bg-quiniela-verde text-white px-4 py-2 rounded disabled:opacity-50">
        Buscar partidos
      </button>
    </section>

    <section v-if="fixtures.length" class="bg-white rounded-lg shadow p-4 space-y-2">
      <label v-for="f in fixtures" :key="f.fixture.id" class="flex items-center gap-2 border-b py-2">
        <input type="checkbox" :checked="seleccionados.some(s => s.fixture.id === f.fixture.id)" @change="alternarSeleccion(f)" />
        <span>{{ f.league.name }} — {{ f.teams.home.name }} vs {{ f.teams.away.name }}</span>
      </label>
      <p v-if="!fixtures.length" class="text-gray-500 text-sm">No se encontraron partidos en ese rango de fechas.</p>
    </section>

    <section v-if="seleccionados.length" class="bg-white rounded-lg shadow p-4 space-y-3">
      <h2 class="font-semibold text-quiniela-verde">Datos de la jornada ({{ seleccionados.length }} partidos)</h2>
      <input v-model="nombreJornada" placeholder="Nombre de la jornada" class="w-full border rounded px-3 py-2" />
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input v-model="costo" type="number" placeholder="Costo" class="border rounded px-3 py-2" />
        <input v-model="premio" type="number" placeholder="Premio (opcional)" class="border rounded px-3 py-2" />
        <input v-model="fechaCierre" type="datetime-local" class="border rounded px-3 py-2" />
      </div>
      <button @click="guardarJornada" class="bg-quiniela-dorado text-quiniela-grisTexto font-semibold px-4 py-2 rounded">
        Publicar jornada
      </button>
    </section>

    <p v-if="mensaje" class="text-quiniela-verdeAcento font-semibold">{{ mensaje }}</p>
  </div>
</template>
