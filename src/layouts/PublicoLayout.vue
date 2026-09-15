<script setup>
import { useAuthStore } from '@/store/auth';
import { useLoginModalStore } from '@/store/loginModal';

const authStore = useAuthStore();
const loginModalStore = useLoginModalStore();
</script>

<template>
  <div class="min-h-screen bg-quiniela-grisClaro">
    <a href="#contenido-publico" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-quiniela-dorado focus:px-4 focus:py-3 focus:font-bold">Saltar al contenido</a>
    <header class="bg-quiniela-verdeOscuro px-4 py-3 text-white shadow-lg">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <router-link :to="{ name: 'inicio' }" class="flex min-w-0 items-center gap-2 rounded-lg">
          <img src="@assets/logo.png" alt="Quinielas JR" class="h-10 w-10 rounded-full" />
          <div class="min-w-0"><p class="truncate font-bold leading-tight">Quinielas JR</p><p class="truncate text-xs text-green-100">Resultados en vivo</p></div>
        </router-link>
        <router-link v-if="authStore.isLoggedIn" :to="{ name: 'mis-quinielas' }" class="shrink-0 rounded-xl bg-quiniela-dorado px-3 py-2 text-sm font-bold text-quiniela-grisTexto sm:px-4">Mis quinielas</router-link>
        <button v-else type="button" @click="loginModalStore.abrir()" class="shrink-0 rounded-xl bg-quiniela-dorado px-3 py-2 text-sm font-bold text-quiniela-grisTexto sm:px-4">Iniciar sesión</button>
      </div>
    </header>
    <main id="contenido-publico"><router-view /></main>
  </div>
</template>
