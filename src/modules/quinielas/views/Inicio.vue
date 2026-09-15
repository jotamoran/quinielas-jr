<script setup>
import { ref, onMounted } from 'vue';
import { obtenerJornadaActiva } from '../services/quinielasService';

const jornada = ref(null);
onMounted(async () => {
  try { jornada.value = await obtenerJornadaActiva(null, { soloAbierta: true }); } catch { jornada.value = null; }
});
</script>

<template>
  <main class="page-shell max-w-5xl">
    <section class="overflow-hidden rounded-3xl bg-quiniela-verdeOscuro px-5 py-10 text-white shadow-xl sm:px-10 sm:py-16">
      <p class="eyebrow text-green-200">Quinielas JR</p>
      <h1 class="mt-2 max-w-2xl text-3xl font-bold leading-tight sm:text-5xl">Participa, suma puntos y sigue la jornada en vivo.</h1>
      <p class="mt-4 max-w-xl text-base leading-relaxed text-green-100 sm:text-lg">Registra tus pronósticos, consulta tu posición y revisa los resultados conforme avanza cada partido.</p>
      <div class="mt-7 flex flex-col gap-3 sm:flex-row">
        <router-link v-if="jornada" :to="{ name: 'llenar-quiniela', params: { jornadaId: jornada.id } }" class="rounded-xl bg-quiniela-dorado px-5 py-3 text-center font-bold text-quiniela-grisTexto">Llenar quiniela</router-link>
        <router-link v-else :to="{ name: 'llenar-quiniela' }" class="rounded-xl bg-quiniela-dorado px-5 py-3 text-center font-bold text-quiniela-grisTexto">Ver jornadas disponibles</router-link>
        <router-link :to="{ name: 'mis-quinielas' }" class="rounded-xl border border-white/40 px-5 py-3 text-center font-bold text-white">Mis quinielas</router-link>
      </div>
    </section>
    <section class="grid gap-4 sm:grid-cols-3" aria-label="Cómo participar">
      <article v-for="item in [{ icon: '1', title: 'Regístrate', text: 'Crea tu entrada y elige un nombre para identificarla.' }, { icon: '2', title: 'Pronostica', text: 'Selecciona local, empate o visita en cada partido.' }, { icon: '3', title: 'Sigue tu posición', text: 'Consulta puntos y resultados desde cualquier dispositivo.' }]" :key="item.icon" class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><span class="grid h-9 w-9 place-items-center rounded-full bg-green-100 font-bold text-quiniela-verde">{{ item.icon }}</span><h2 class="mt-4 font-bold text-quiniela-verdeOscuro">{{ item.title }}</h2><p class="mt-1 text-sm leading-relaxed text-gray-600">{{ item.text }}</p></article>
    </section>
  </main>
</template>
