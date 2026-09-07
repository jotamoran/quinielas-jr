<script setup>
import { ref } from 'vue';
import { buscarFixtures, crearJornada } from '../services/adminService';

const ligas = ref('262');
const temporada = ref(new Date().getFullYear());
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
  const { fixtures: encontrados } = await buscarFixtures({
    leagues: ligas.value.split(',').map((l) => l.trim()),
    season: temporada.value,
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
}
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto space-y-6">
    <h1 class="text-2xl font-bold text-quiniela-verdeOscuro">Gestión de jornadas</h1>

    <section class="bg-white rounded-lg shadow p-4 space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input v-model="ligas" placeholder="IDs de liga separados por coma (ej. 262,2)" class="border rounded px-3 py-2" />
        <input v-model="temporada" type="number" placeholder="Temporada" class="border rounded px-3 py-2" />
        <input v-model="desde" type="date" class="border rounded px-3 py-2" />
        <input v-model="hasta" type="date" class="border rounded px-3 py-2" />
      </div>
      <button @click="buscar" class="bg-quiniela-verde text-white px-4 py-2 rounded">Buscar partidos</button>
    </section>

    <section v-if="fixtures.length" class="bg-white rounded-lg shadow p-4 space-y-2">
      <label v-for="f in fixtures" :key="f.fixture.id" class="flex items-center gap-2 border-b py-2">
        <input type="checkbox" :checked="seleccionados.some(s => s.fixture.id === f.fixture.id)" @change="alternarSeleccion(f)" />
        <span>{{ f.league.name }} — {{ f.teams.home.name }} vs {{ f.teams.away.name }}</span>
      </label>
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
      <p v-if="mensaje" class="text-quiniela-verdeAcento">{{ mensaje }}</p>
    </section>
  </div>
</template>
