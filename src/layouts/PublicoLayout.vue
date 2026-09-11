<script setup>
import { useAuthStore } from '@/store/auth';
import { useLoginModalStore } from '@/store/loginModal';

const authStore = useAuthStore();
const loginModalStore = useLoginModalStore();
</script>

<template>
  <div class="min-h-screen bg-quiniela-grisClaro">
    <header class="bg-quiniela-verdeOscuro px-4 py-3 text-white shadow-lg">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <router-link :to="{ name: 'llenar-quiniela' }" class="flex min-w-0 items-center gap-2 rounded-lg">
          <img src="@assets/logo.png" alt="Quinielas JR" class="h-10 w-10 rounded-full" />
          <div class="min-w-0"><p class="truncate font-bold leading-tight">Quinielas JR</p><p class="truncate text-xs text-green-100">Resultados en vivo</p></div>
        </router-link>
        <router-link v-if="authStore.isLoggedIn" :to="{ name: 'mis-quinielas' }" class="shrink-0 rounded-xl bg-quiniela-dorado px-3 py-2 text-sm font-bold text-quiniela-grisTexto sm:px-4">Mis quinielas</router-link>
        <button v-else type="button" @click="loginModalStore.abrir()" class="shrink-0 rounded-xl bg-quiniela-dorado px-3 py-2 text-sm font-bold text-quiniela-grisTexto sm:px-4">Iniciar sesión</button>
      </div>
    </header>
    <main><router-view /></main>
  </div>
</template>
