<script setup>
import { ref, watch } from 'vue';
import { buscarEquipos } from '../services/adminService';

const props = defineProps({ modelValue: { type: Object, default: null }, label: { type: String, required: true } });
const emit = defineEmits(['update:modelValue']);
const query = ref(props.modelValue?.name ?? '');
const options = ref([]);
const loading = ref(false);
let timer;

watch(() => props.modelValue, (value) => { if (value?.name !== query.value) query.value = value?.name ?? ''; });
watch(query, (value) => {
  clearTimeout(timer);
  if (value !== props.modelValue?.name) emit('update:modelValue', value.trim() ? { name: value, logo: null, manual: true } : null);
  if (value.trim().length < 2) { options.value = []; return; }
  timer = setTimeout(async () => {
    loading.value = true;
    try { options.value = (await buscarEquipos(value.trim())).teams; } catch { options.value = []; } finally { loading.value = false; }
  }, 450);
});

function select(team) {
  query.value = team.name;
  options.value = [];
  emit('update:modelValue', team);
}
</script>

<template>
  <label class="relative block text-sm font-semibold">
    {{ label }}
    <div class="relative mt-1"><img v-if="modelValue?.logo" :src="modelValue.logo" alt="" class="absolute left-3 top-1/2 h-7 w-7 -translate-y-1/2 object-contain" /><input v-model="query" autocomplete="off" class="w-full rounded-xl border-gray-300 pr-10" :class="modelValue?.logo ? 'pl-12' : ''" :placeholder="loading ? 'Buscando…' : 'Escribe el nombre del equipo'" /><span v-if="loading" class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">•••</span></div>
    <ul v-if="options.length" class="absolute z-30 mt-1 max-h-52 w-full overflow-auto rounded-xl border bg-white p-1 shadow-xl">
      <li v-for="team in options" :key="team.id"><button type="button" @click="select(team)" class="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-green-50"><img v-if="team.logo" :src="team.logo" alt="" class="h-8 w-8 object-contain" /><span>{{ team.name }}</span></button></li>
    </ul>
    <span v-if="query.length >= 2 && modelValue?.manual && !loading && !options.length" class="mt-1 block text-xs font-normal text-gray-500">Si no aparece, conserva el nombre escrito y se guardará sin escudo.</span>
  </label>
</template>
