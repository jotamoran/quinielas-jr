<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { onBeforeRouteLeave } from 'vue-router';
import TarjetaPartido from '../components/TarjetaPartido.vue';
import { actualizarPredicciones, obtenerQuinielaParaEditar } from '../services/quinielasService';
import { alertaError, alertaExito, confirmarAccion } from '@/lib/alertas';

const route = useRoute();
const router = useRouter();
const entrada = ref(null);
const pronosticos = ref({});
const cargando = ref(true);
const guardando = ref(false);
const error = ref('');
const original = ref({});
const bloqueada = computed(() => !entrada.value || entrada.value.jornadas?.estatus !== 'activa' || new Date(entrada.value.jornadas.fecha_cierre) <= new Date());
const partidos = computed(() => (entrada.value?.predicciones ?? []).map((item) => ({ ...item.partidos, id: item.partido_id })));
const completo = computed(() => partidos.value.filter((partido) => !partido.cancelado).every((partido) => pronosticos.value[partido.id]));
const tieneCambios = computed(() => JSON.stringify(pronosticos.value) !== JSON.stringify(original.value));

async function cargar() {
  try {
    entrada.value = await obtenerQuinielaParaEditar(route.params.quinielaId);
    for (const item of entrada.value.predicciones ?? []) pronosticos.value[item.partido_id] = item.pronostico;
    original.value = { ...pronosticos.value };
  } catch (e) { error.value = e.message; } finally { cargando.value = false; }
}

async function guardar() {
  if (bloqueada.value || !completo.value) return;
  guardando.value = true;
  try {
    await actualizarPredicciones(entrada.value.id, Object.entries(pronosticos.value).map(([partidoId, pronostico]) => ({ partidoId, pronostico })));
    original.value = { ...pronosticos.value };
    await alertaExito('Pronósticos actualizados');
    router.push({ name: 'mis-quinielas' });
  } catch (e) { await alertaError(e, 'No se pudieron actualizar tus pronósticos'); } finally { guardando.value = false; }
}

onMounted(cargar);
onBeforeRouteLeave(async () => {
  if (!tieneCambios.value || guardando.value) return true;
  return confirmarAccion({ title: 'Salir sin guardar', text: 'Perderás los cambios que hiciste en esta quiniela.', confirmText: 'Salir sin guardar', danger: true });
});
function advertirSalida(evento) { if (tieneCambios.value && !guardando.value) { evento.preventDefault(); evento.returnValue = ''; } }
async function volver() {
  if (tieneCambios.value && !guardando.value) {
    const confirmado = await confirmarAccion({ title: 'Salir sin guardar', text: 'Perderás los cambios que hiciste en esta quiniela.', confirmText: 'Salir sin guardar', danger: true });
    if (!confirmado) return;
  }
  router.back();
}
onMounted(() => window.addEventListener('beforeunload', advertirSalida));
onUnmounted(() => window.removeEventListener('beforeunload', advertirSalida));
</script>

<template>
  <main class="page-shell max-w-3xl">
    <header><p class="eyebrow">Mi cuenta</p><h1 class="page-title">Editar quiniela</h1><p v-if="entrada" class="page-description">{{ entrada.alias }} · {{ entrada.jornadas?.nombre }}</p></header>
    <p v-if="cargando" class="rounded-2xl bg-white p-6 text-center text-sm text-gray-500" role="status">Cargando pronósticos…</p>
    <p v-else-if="error" role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">{{ error }}</p>
    <template v-else-if="entrada">
      <p v-if="bloqueada" role="status" class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">El cierre ya pasó; esta quiniela es solo de consulta.</p>
      <div class="grid gap-4"><TarjetaPartido v-for="partido in partidos" :key="partido.id" :partido="partido" v-model="pronosticos[partido.id]" :deshabilitado="bloqueada" /></div>
      <div class="sticky bottom-3 flex gap-3 rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur"><button type="button" @click="volver" class="flex-1 rounded-xl border border-gray-300 py-3 font-semibold">Volver</button><button type="button" @click="guardar" :disabled="bloqueada || guardando || !completo || !tieneCambios" class="flex-1 rounded-xl bg-quiniela-verde py-3 font-bold text-white disabled:opacity-50">{{ guardando ? 'Guardando…' : 'Guardar cambios' }}</button></div>
    </template>
  </main>
</template>
