<script setup>
import { ref } from 'vue';
import { useAuthStore } from '@/store/auth';
import { useLoginModalStore } from '@/store/loginModal';
import { useRouter } from 'vue-router';
import { confirmarAccion } from '@/lib/alertas';

const authStore = useAuthStore();
const loginModalStore = useLoginModalStore();
const router = useRouter();
const menuAbierto = ref(false);
const adminAbierto = ref(false);

async function salir() {
  const confirmed = await confirmarAccion({ title: 'Cerrar sesión', text: 'Tendrás que iniciar sesión nuevamente.', confirmText: 'Salir' });
  if (!confirmed) return;
  await authStore.cerrarSesion();
  router.push({ name: 'login' });
}

function cerrarMenu() {
  menuAbierto.value = false;
}
</script>

<template>
  <nav class="sticky top-0 z-40 bg-quiniela-verdeOscuro px-4 py-3 text-white shadow-lg sm:px-6">
    <div class="mx-auto flex max-w-7xl items-center justify-between">
      <div class="flex items-center gap-2">
        <img src="@assets/logo.png" alt="Quinielas JR" class="h-8 w-8 rounded-full" />
        <span class="font-bold">Quinielas JR</span>
      </div>

      <div class="hidden items-center gap-2 text-sm md:flex">
        <template v-if="authStore.isLoggedIn">
          <router-link :to="{ name: 'mis-quinielas' }" class="nav-link">Mis quinielas</router-link>
          <router-link :to="{ name: 'llenar-quiniela' }" class="nav-link">Jugar</router-link>
          <div v-if="authStore.isAdmin" class="relative"><button @click="adminAbierto = !adminAbierto" class="nav-link flex items-center gap-1">Administración <span class="text-xs">▾</span></button><div v-if="adminAbierto" class="absolute right-0 mt-2 w-60 rounded-xl bg-white p-2 text-gray-700 shadow-2xl"><router-link v-for="item in [{ name: 'admin-jornadas', label: 'Crear jornada' }, { name: 'admin-administrar-jornadas', label: 'Ver jornadas' }, { name: 'admin-edicion-manual', label: 'Administrar quinielas' }, { name: 'admin-pagos', label: 'Pagos pendientes' }, { name: 'admin-sincronizar', label: 'Resultados' }, { name: 'admin-cerrar-jornada', label: 'Cerrar jornada' }]" :key="item.name" :to="{ name: item.name }" @click="adminAbierto = false" class="block rounded-lg px-3 py-2 hover:bg-green-50 hover:text-quiniela-verde">{{ item.label }}</router-link></div></div>
          <button @click="salir" class="rounded-lg bg-quiniela-dorado px-3 py-2 font-semibold text-quiniela-grisTexto">Salir</button>
        </template>
        <button v-else type="button" @click="loginModalStore.abrir()" class="rounded-lg bg-quiniela-dorado px-3 py-2 font-semibold text-quiniela-grisTexto">Iniciar sesión</button>
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

    <div v-if="menuAbierto" class="mx-auto mt-3 flex max-w-7xl flex-col gap-1 border-t border-white/20 pt-3 text-sm md:hidden">
      <template v-if="authStore.isLoggedIn">
        <p class="px-3 pb-1 text-xs font-bold uppercase tracking-widest text-white/60">Mi cuenta</p>
        <router-link :to="{ name: 'mis-quinielas' }" @click="cerrarMenu" class="mobile-nav-link">Mis quinielas</router-link>
        <router-link :to="{ name: 'llenar-quiniela' }" @click="cerrarMenu" class="mobile-nav-link">Llenar quiniela</router-link>
        <template v-if="authStore.isAdmin">
          <p class="mt-2 px-3 pb-1 text-xs font-bold uppercase tracking-widest text-white/60">Administración</p>
          <router-link :to="{ name: 'admin-jornadas' }" @click="cerrarMenu" class="mobile-nav-link">Crear jornada</router-link>
          <router-link :to="{ name: 'admin-administrar-jornadas' }" @click="cerrarMenu" class="mobile-nav-link">Ver jornadas</router-link>
          <router-link :to="{ name: 'admin-edicion-manual' }" @click="cerrarMenu" class="mobile-nav-link">Administrar quinielas</router-link>
          <router-link :to="{ name: 'admin-pagos' }" @click="cerrarMenu" class="mobile-nav-link">Pagos pendientes</router-link>
          <router-link :to="{ name: 'admin-sincronizar' }" @click="cerrarMenu" class="mobile-nav-link">Resultados</router-link>
          <router-link :to="{ name: 'admin-cerrar-jornada' }" @click="cerrarMenu" class="mobile-nav-link">Cerrar jornada</router-link>
        </template>
        <button @click="salir(); cerrarMenu()" class="mt-2 rounded-lg bg-quiniela-dorado px-3 py-2 font-semibold text-quiniela-grisTexto">Cerrar sesión</button>
      </template>
      <button v-else type="button" @click="loginModalStore.abrir(); cerrarMenu()" class="mobile-nav-link text-left">Iniciar sesión</button>
    </div>
  </nav>
</template>
