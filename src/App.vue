<script setup>
import { onMounted } from 'vue';
import { useAuthStore } from '@/store/auth';

const authStore = useAuthStore();
onMounted(() => authStore.init());
</script>

<template>
  <router-view />
</template>
