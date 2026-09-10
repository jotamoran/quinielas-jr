<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { supabase } from '@/lib/supabase';
import TarjetaPartido from '@/modules/quinielas/components/TarjetaPartido.vue';
import { actualizarQuinielaAdmin, crearQuinielaAdmin, listarQuinielasAdmin } from '../services/adminService';
import { alertaError, alertaExito, confirmarAccion } from '@/lib/alertas';

const tab = ref('listado');
const quinielas = ref([]);
const jornadas = ref([]);
const partidos = ref([]);
const jornadaId = ref('');
const alias = ref('');
const correo = ref('');
const estatus = ref('pendiente');
const pronosticos = ref({});
const search = ref('');
const filtroEstatus = ref('todos');
const loading = ref(false);

const estados = [{ value: 'pendiente', label: 'Pendiente' }, { value: 'aprobado', label: 'Pagada' }, { value: 'rechazado', label: 'Cancelada' }];
const partidosActivos = computed(() => partidos.value.filter((p) => !p.cancelado));
const completas = computed(() => partidosActivos.value.length > 0 && partidosActivos.value.every((partido) => pronosticos.value[partido.id]));
const filtradas = computed(() => quinielas.value.filter((item) => {
  const text = `${item.alias} ${item.perfiles?.nombre_completo ?? ''} ${item.jornadas?.nombre ?? ''}`.toLowerCase();
  return (filtroEstatus.value === 'todos' || item.estatus_pago === filtroEstatus.value) && text.includes(search.value.toLowerCase());
}));

async function cargar() {
  const [{ quinielas: entries }, jornadasResult] = await Promise.all([
    listarQuinielasAdmin(),
    supabase.from('jornadas').select('id, nombre, fecha_cierre').eq('estatus', 'activa').gt('fecha_cierre', new Date().toISOString()).order('fecha_cierre'),
  ]);
  quinielas.value = entries.map((item) => ({ ...item, editando: false, aliasEditado: item.alias, correoEditado: item.correo_contacto ?? '', estatusEditado: item.estatus_pago }));
  if (jornadasResult.error) throw jornadasResult.error;
  jornadas.value = jornadasResult.data ?? [];
}

watch(jornadaId, async (id) => {
  partidos.value = [];
  pronosticos.value = {};
  if (!id) return;
  const { data, error } = await supabase.from('partidos').select('*').eq('jornada_id', id).order('fecha_partido');
  if (error) return alertaError(error);
  partidos.value = data ?? [];
});

async function registrar() {
  if (!completas.value || !alias.value.trim()) return;
  const confirmed = await confirmarAccion({ title: 'Registrar quiniela', text: `${alias.value.trim()} quedará como ${etiquetaEstatus(estatus.value).toLowerCase()}.`, confirmText: 'Registrar' });
  if (!confirmed) return;
  loading.value = true;
  try {
    await crearQuinielaAdmin({ jornada_id: jornadaId.value, alias: alias.value, correo_contacto: correo.value, estatus_pago: estatus.value, predicciones: Object.entries(pronosticos.value).map(([partido_id, pronostico]) => ({ partido_id, pronostico })) });
    await alertaExito('Quiniela registrada', `La entrada presencial quedó guardada con sus ${partidosActivos.value.length} pronósticos.`);
    alias.value = '';
    correo.value = '';
    jornadaId.value = '';
    tab.value = 'listado';
    await cargar();
  } catch (error) {
    await alertaError(error);
  } finally {
    loading.value = false;
  }
}

async function guardar(item) {
  const confirmed = await confirmarAccion({ title: 'Guardar cambios', text: `El estatus será ${etiquetaEstatus(item.estatusEditado).toLowerCase()}.`, confirmText: 'Guardar', danger: item.estatusEditado === 'rechazado' });
  if (!confirmed) return;
  try {
    await actualizarQuinielaAdmin({ quiniela_id: item.id, alias: item.aliasEditado, correo_contacto: item.correoEditado, estatus_pago: item.estatusEditado });
    item.alias = item.aliasEditado;
    item.correo_contacto = item.correoEditado;
    item.estatus_pago = item.estatusEditado;
    item.editando = false;
    await alertaExito('Cambios guardados');
  } catch (error) {
    await alertaError(error);
  }
}

function etiquetaEstatus(value) { return estados.find((item) => item.value === value)?.label ?? value; }
function statusClass(value) { return ({ pendiente: 'bg-amber-100 text-amber-800', aprobado: 'bg-green-100 text-green-800', rechazado: 'bg-red-100 text-red-800' })[value]; }

onMounted(async () => { try { await cargar(); } catch (error) { await alertaError(error); } });
</script>

<template>
  <main class="page-shell max-w-6xl">
    <header><p class="eyebrow">Administración</p><h1 class="page-title">Administrar quinielas</h1><p class="page-description">Registra entradas presenciales y administra las creadas por los usuarios.</p></header>

    <div class="grid grid-cols-2 rounded-xl bg-gray-200 p-1 sm:w-fit"><button @click="tab = 'listado'" class="rounded-lg px-4 py-2 text-sm font-semibold" :class="tab === 'listado' ? 'bg-white text-quiniela-verde shadow-sm' : 'text-gray-600'">Todas las quinielas</button><button @click="tab = 'nueva'" class="rounded-lg px-4 py-2 text-sm font-semibold" :class="tab === 'nueva' ? 'bg-white text-quiniela-verde shadow-sm' : 'text-gray-600'">+ Registro presencial</button></div>

    <section v-if="tab === 'listado'" class="space-y-4">
      <div class="grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-[1fr_180px]"><input v-model="search" class="rounded-xl border-gray-300" placeholder="Buscar por entrada, persona o jornada" /><select v-model="filtroEstatus" class="rounded-xl border-gray-300"><option value="todos">Todos los estatus</option><option v-for="item in estados" :key="item.value" :value="item.value">{{ item.label }}</option></select></div>
      <div v-if="filtradas.length" class="grid gap-3 lg:grid-cols-2">
        <article v-for="item in filtradas" :key="item.id" class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div class="mb-3 flex items-start justify-between gap-3"><div><span class="mb-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold" :class="statusClass(item.estatus_pago)">{{ etiquetaEstatus(item.estatus_pago) }}</span><h2 class="font-bold text-quiniela-verdeOscuro">{{ item.alias }}</h2><p class="text-sm text-gray-500">{{ item.jornadas?.nombre }}</p></div><span class="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">{{ item.origen === 'manual_admin' ? 'Presencial' : 'Web' }}</span></div>
          <dl class="grid grid-cols-2 gap-2 border-y py-3 text-sm"><div><dt class="text-gray-500">Participante</dt><dd class="font-semibold">{{ item.perfiles?.nombre_completo ?? 'Sin cuenta' }}</dd></div><div><dt class="text-gray-500">Aciertos</dt><dd class="font-semibold">{{ item.aciertos }}</dd></div><div v-if="item.correo_contacto" class="col-span-2"><dt class="text-gray-500">Correo de contacto</dt><dd class="font-semibold">{{ item.correo_contacto }}</dd></div></dl>
          <div v-if="item.editando" class="mt-4 space-y-3"><input v-model="item.aliasEditado" class="w-full rounded-xl border-gray-300" placeholder="Nombre de la entrada" /><input v-model="item.correoEditado" type="email" class="w-full rounded-xl border-gray-300" placeholder="Correo de contacto (opcional)" /><select v-model="item.estatusEditado" class="w-full rounded-xl border-gray-300"><option v-for="estadoItem in estados" :key="estadoItem.value" :value="estadoItem.value">{{ estadoItem.label }}</option></select><div class="grid grid-cols-2 gap-2"><button @click="item.editando = false" class="rounded-xl border py-2 font-semibold text-gray-600">Cancelar</button><button @click="guardar(item)" class="rounded-xl bg-quiniela-verde py-2 font-semibold text-white">Guardar</button></div></div>
          <button v-else @click="item.editando = true" class="mt-4 w-full rounded-xl border border-quiniela-verde py-2 font-semibold text-quiniela-verde">Editar entrada y estatus</button>
        </article>
      </div>
      <div v-else class="empty-state">No encontramos quinielas con esos filtros.</div>
    </section>

    <section v-else class="space-y-5">
      <div class="rounded-2xl bg-white p-4 shadow-sm sm:p-6"><div class="grid gap-4 sm:grid-cols-2"><label class="form-label">Jornada<select v-model="jornadaId" class="form-control"><option value="">Selecciona una jornada</option><option v-for="jornada in jornadas" :key="jornada.id" :value="jornada.id">{{ jornada.nombre }}</option></select></label><label class="form-label">Nombre de la entrada<input v-model="alias" class="form-control" placeholder="Ej. Carlos oficina #1" /></label><label class="form-label">Correo de contacto (opcional)<input v-model="correo" type="email" class="form-control" placeholder="Para avisarle si gana el cupón" /></label><label class="form-label">Estatus del pago<select v-model="estatus" class="form-control"><option v-for="item in estados" :key="item.value" :value="item.value">{{ item.label }}</option></select></label></div><p class="mt-3 text-xs text-gray-500">Si esta entrada resulta ser la que menos aciertos tuvo, le enviaremos el código del cupón "Por tarugo" a este correo para que se lo hagas llegar.</p></div>
      <div v-if="partidos.length" class="grid gap-4 md:grid-cols-2"><TarjetaPartido v-for="partido in partidos" :key="partido.id" v-model="pronosticos[partido.id]" :partido="partido" /></div>
      <div v-else-if="jornadaId" class="empty-state">La jornada no tiene partidos disponibles.</div>
      <button v-if="partidos.length" @click="registrar" :disabled="!completas || !alias.trim() || loading" class="sticky bottom-3 w-full rounded-xl bg-quiniela-verde py-3 font-bold text-white shadow-xl disabled:opacity-50">{{ loading ? 'Registrando…' : `${Object.keys(pronosticos).length} de ${partidosActivos.length} · Registrar quiniela` }}</button>
    </section>
  </main>
</template>
