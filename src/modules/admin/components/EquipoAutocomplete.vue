<script setup>
import { onUnmounted, ref, watch } from 'vue';
import { buscarEquipos } from '../services/adminService';

const props = defineProps({ modelValue: { type: Object, default: null }, label: { type: String, required: true } });
const emit = defineEmits(['update:modelValue']);
const query = ref(props.modelValue?.name ?? '');
const options = ref([]);
const loading = ref(false);
const error = ref('');
const activo = ref(-1);
let timer;
let busquedaId = 0;
let seleccionando = false;

watch(() => props.modelValue, (value) => { if (value?.name !== query.value) query.value = value?.name ?? ''; });
watch(query, (value) => {
  clearTimeout(timer);
  if (seleccionando) {
    seleccionando = false;
    return;
  }
  const id = ++busquedaId;
  error.value = '';
  if (value !== props.modelValue?.name) emit('update:modelValue', value.trim() ? { name: value, logo: null, manual: true } : null);
  if (value.trim().length < 2) { options.value = []; activo.value = -1; loading.value = false; return; }
  timer = setTimeout(async () => {
    loading.value = true;
    try {
      const respuesta = await buscarEquipos(value.trim());
      if (id !== busquedaId) return;
      options.value = respuesta.teams;
      activo.value = -1;
    } catch (e) {
      if (id !== busquedaId) return;
      options.value = [];
      error.value = e.message || 'No se pudo buscar el equipo.';
    } finally {
      if (id === busquedaId) loading.value = false;
    }
  }, 450);
});

function select(team) {
  const mismoTexto = query.value === team.name;
  seleccionando = true;
  busquedaId += 1;
  query.value = team.name;
  options.value = [];
  emit('update:modelValue', team);
  if (mismoTexto) seleccionando = false;
}

function navegar(evento) {
  if (!options.value.length) return;
  if (evento.key === 'ArrowDown') { evento.preventDefault(); activo.value = (activo.value + 1) % options.value.length; }
  if (evento.key === 'ArrowUp') { evento.preventDefault(); activo.value = (activo.value - 1 + options.value.length) % options.value.length; }
  if (evento.key === 'Enter' && activo.value >= 0) { evento.preventDefault(); select(options.value[activo.value]); }
  if (evento.key === 'Escape') { options.value = []; activo.value = -1; }
}

onUnmounted(() => { clearTimeout(timer); busquedaId += 1; });
</script>

<template>
  <label class="relative block text-sm font-semibold">
    {{ label }}
    <div class="relative mt-1"><img v-if="modelValue?.logo" :src="modelValue.logo" alt="" loading="lazy" decoding="async" class="absolute left-3 top-1/2 h-7 w-7 -translate-y-1/2 object-contain" /><input v-model="query" autocomplete="off" role="combobox" :aria-expanded="Boolean(options.length)" aria-autocomplete="list" :aria-activedescendant="activo >= 0 ? `equipo-opcion-${activo}` : undefined" class="w-full rounded-xl border-gray-300 pr-10" :class="modelValue?.logo ? 'pl-12' : ''" :placeholder="loading ? 'Buscando…' : 'Escribe el nombre del equipo'" @keydown="navegar" /><span v-if="loading" class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400" aria-live="polite">Buscando…</span></div>
    <ul v-if="options.length" role="listbox" class="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-xl border bg-white p-1 shadow-xl">
      <li v-for="(team, index) in options" :key="team.id" :id="`equipo-opcion-${index}`" role="option" :aria-selected="activo === index"><button type="button" @click="select(team)" class="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-green-50" :class="activo === index ? 'bg-green-50' : ''"><img v-if="team.logo" :src="team.logo" alt="" loading="lazy" decoding="async" class="h-8 w-8 object-contain" /><span>{{ team.name }}</span></button></li>
    </ul>
    <span v-if="error" role="alert" class="mt-1 block text-xs font-normal text-red-700">{{ error }}</span>
    <span v-else-if="query.length >= 2 && modelValue?.manual && !loading && !options.length" class="mt-1 block text-xs font-normal text-gray-500">Si no aparece, conserva el nombre escrito y se guardará sin escudo.</span>
  </label>
</template>
