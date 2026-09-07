<template>
  <SistemaInicio :sistema="sistemaActual" />
</template>

<script setup>
import { computed } from 'vue';

import SistemaInicio from '@/components/SistemaInicio.vue';
import { useAuthStore } from '@/store/auth';

const authStore = useAuthStore();

const sistemaActual = computed(() => {
  return authStore.sistemaActual;
});
</script>