<script setup>
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const router = useRouter();

async function salir() {
  await authStore.cerrarSesion();
  router.push({ name: 'login' });
}
</script>

<template>
  <nav class="bg-quiniela-verdeOscuro text-white px-6 py-3 flex justify-between items-center">
    <div class="flex items-center gap-2">
      <img src="@assets/logo.png" alt="Quinielas JR" class="h-8 w-8 rounded-full" />
      <span class="font-bold">Quinielas JR</span>
    </div>
    <div class="flex gap-4 text-sm items-center">
      <router-link :to="{ name: 'mis-quinielas' }">Mis quinielas</router-link>
      <router-link :to="{ name: 'llenar-quiniela' }">Llenar quiniela</router-link>
      <template v-if="authStore.isAdmin">
        <router-link :to="{ name: 'admin-jornadas' }">Jornadas</router-link>
        <router-link :to="{ name: 'admin-pagos' }">Pagos</router-link>
        <router-link :to="{ name: 'admin-sincronizar' }">Sincronizar</router-link>
        <router-link :to="{ name: 'admin-cerrar-jornada' }">Cerrar jornada</router-link>
        <router-link :to="{ name: 'admin-edicion-manual' }">Edición manual</router-link>
      </template>
      <button @click="salir" class="bg-quiniela-dorado text-quiniela-grisTexto px-3 py-1 rounded font-semibold">Salir</button>
    </div>
  </nav>
</template>
