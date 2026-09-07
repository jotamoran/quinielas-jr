<script setup>
import { ref } from 'vue';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const router = useRouter();
const menuAbierto = ref(false);

async function salir() {
  await authStore.cerrarSesion();
  router.push({ name: 'login' });
}

function cerrarMenu() {
  menuAbierto.value = false;
}
</script>

<template>
  <nav class="bg-quiniela-verdeOscuro text-white px-6 py-3">
    <div class="flex justify-between items-center">
      <div class="flex items-center gap-2">
        <img src="@assets/logo.png" alt="Quinielas JR" class="h-8 w-8 rounded-full" />
        <span class="font-bold">Quinielas JR</span>
      </div>

      <!-- Links en desktop -->
      <div class="hidden md:flex md:flex-wrap gap-4 text-sm items-center">
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

      <!-- Botón hamburguesa en móvil -->
      <button
        class="md:hidden text-white"
        @click="menuAbierto = !menuAbierto"
        aria-label="Abrir menú"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path v-if="!menuAbierto" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Panel desplegable en móvil -->
    <div v-if="menuAbierto" class="md:hidden flex flex-col gap-3 text-sm mt-3 pb-2">
      <router-link :to="{ name: 'mis-quinielas' }" @click="cerrarMenu">Mis quinielas</router-link>
      <router-link :to="{ name: 'llenar-quiniela' }" @click="cerrarMenu">Llenar quiniela</router-link>
      <template v-if="authStore.isAdmin">
        <router-link :to="{ name: 'admin-jornadas' }" @click="cerrarMenu">Jornadas</router-link>
        <router-link :to="{ name: 'admin-pagos' }" @click="cerrarMenu">Pagos</router-link>
        <router-link :to="{ name: 'admin-sincronizar' }" @click="cerrarMenu">Sincronizar</router-link>
        <router-link :to="{ name: 'admin-cerrar-jornada' }" @click="cerrarMenu">Cerrar jornada</router-link>
        <router-link :to="{ name: 'admin-edicion-manual' }" @click="cerrarMenu">Edición manual</router-link>
      </template>
      <button @click="salir(); cerrarMenu()" class="bg-quiniela-dorado text-quiniela-grisTexto px-3 py-1 rounded font-semibold w-fit">Salir</button>
    </div>
  </nav>
</template>
