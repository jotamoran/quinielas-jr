<script setup>
import { useAuthStore } from '@/store/auth';

const authStore = useAuthStore();
</script>

<template>
  <div class="min-h-screen bg-quiniela-grisClaro">
    <header class="bg-quiniela-verdeOscuro px-4 py-3 text-white shadow-lg">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <img src="@assets/logo.png" alt="Quinielas JR" class="h-10 w-10 rounded-full" />
          <div><p class="font-bold leading-tight">Quinielas JR</p><p class="text-xs text-green-100">Resultados en vivo</p></div>
        </div>
        <router-link :to="{ name: authStore.isLoggedIn ? 'mis-quinielas' : 'login' }" class="rounded-xl bg-quiniela-dorado px-4 py-2 text-sm font-bold text-quiniela-grisTexto">
          {{ authStore.isLoggedIn ? 'Mis quinielas' : 'Iniciar sesión' }}
        </router-link>
      </div>
    </header>
    <main><router-view /></main>
  </div>
</template>
