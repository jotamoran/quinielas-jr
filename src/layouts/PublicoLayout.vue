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
        <div class="flex items-center gap-2">
          <img src="@assets/logo.png" alt="Quinielas JR" class="h-10 w-10 rounded-full" />
          <div><p class="font-bold leading-tight">Quinielas JR</p><p class="text-xs text-green-100">Resultados en vivo</p></div>
        </div>
        <router-link v-if="authStore.isLoggedIn" :to="{ name: 'mis-quinielas' }" class="rounded-xl bg-quiniela-dorado px-4 py-2 text-sm font-bold text-quiniela-grisTexto">Mis quinielas</router-link>
        <button v-else type="button" @click="loginModalStore.abrir()" class="rounded-xl bg-quiniela-dorado px-4 py-2 text-sm font-bold text-quiniela-grisTexto">Iniciar sesión</button>
      </div>
    </header>
    <main><router-view /></main>
  </div>
</template>
