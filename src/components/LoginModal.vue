<!-- src/components/LoginModal.vue -->
<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useLoginModalStore } from '@/store/loginModal';
import { iniciarSesion, traducirErrorAuth } from '@/modules/auth/services/authService';

const loginModalStore = useLoginModalStore();
const route = useRoute();
const entrada = ref('');
const password = ref('');
const error = ref('');
const cargando = ref(false);
const emailInput = ref(null);
const modal = ref(null);
let focoAnterior = null;
let overflowAnterior = '';

watch(() => loginModalStore.abierto, async (abierto) => {
  cargando.value = false;
  if (abierto) {
    focoAnterior = document.activeElement;
    overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    entrada.value = '';
    password.value = '';
    error.value = '';
    await nextTick();
    emailInput.value?.focus();
  } else {
    document.body.style.overflow = overflowAnterior;
    focoAnterior?.focus?.();
  }
});

watch(() => route.fullPath, () => {
  if (loginModalStore.abierto) loginModalStore.cerrar();
});

async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    await iniciarSesion({ entrada: entrada.value, password: password.value });
    password.value = '';
    loginModalStore.cerrar();
  } catch (e) {
    error.value = traducirErrorAuth(e.message);
  } finally {
    cargando.value = false;
  }
}

function alPresionarTecla(e) {
  if (e.key === 'Escape' && loginModalStore.abierto) loginModalStore.cerrar();
  if (e.key !== 'Tab' || !loginModalStore.abierto) return;
  const controles = [...(modal.value?.querySelectorAll('button, a, input, [tabindex]:not([tabindex="-1"])') ?? [])].filter((elemento) => !elemento.disabled);
  if (!controles.length) return;
  const primero = controles[0];
  const ultimo = controles.at(-1);
  if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
  else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
}

onMounted(() => window.addEventListener('keydown', alPresionarTecla));
onUnmounted(() => {
  window.removeEventListener('keydown', alPresionarTecla);
  document.body.style.overflow = overflowAnterior;
});
</script>

<template>
  <div v-if="loginModalStore.abierto" ref="modal" role="dialog" aria-modal="true" aria-labelledby="login-modal-titulo" :aria-describedby="error ? 'login-modal-error' : 'login-modal-descripcion'" class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 px-3 py-4 backdrop-blur-[2px] sm:px-4 sm:py-6" @click.self="loginModalStore.cerrar()">
    <form @submit.prevent="onSubmit" class="relative max-h-[calc(100dvh-2rem)] w-full max-w-sm space-y-4 overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:p-8">
      <button type="button" @click="loginModalStore.cerrar()" class="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full text-2xl leading-none text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-quiniela-verde focus-visible:ring-offset-2 sm:right-4 sm:top-4" aria-label="Cerrar">×</button>
      <div class="flex justify-center px-12">
        <img src="@assets/logo.png" alt="" class="h-16 w-16 rounded-full object-contain sm:h-[4.5rem] sm:w-[4.5rem]" />
      </div>
      <div class="space-y-1 text-center">
        <h2 id="login-modal-titulo" class="text-2xl font-bold text-quiniela-verdeOscuro">Inicia sesión</h2>
        <p id="login-modal-descripcion" class="text-sm text-gray-500">Entra para registrar y consultar tus quinielas.</p>
      </div>
      <label class="form-label">Correo o usuario<input ref="emailInput" v-model="entrada" type="text" inputmode="email" autocomplete="username" placeholder="correo@ejemplo.com o tu usuario" required class="form-control min-h-11" /></label>
      <label class="form-label">Contraseña<input v-model="password" type="password" autocomplete="current-password" placeholder="Tu contraseña" required class="form-control min-h-11" /></label>
      <p v-if="error" id="login-modal-error" role="alert" class="rounded-lg bg-red-50 p-2 text-sm text-quiniela-error">{{ error }}</p>
      <button type="submit" :disabled="cargando" class="min-h-11 w-full rounded-xl bg-quiniela-dorado px-4 py-2.5 font-semibold text-quiniela-grisTexto transition hover:bg-quiniela-doradoOscuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-quiniela-verde focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70">
        {{ cargando ? 'Entrando...' : 'Iniciar sesión' }}
      </button>
      <div class="flex flex-col items-center gap-1 text-center text-sm sm:flex-row sm:justify-center sm:gap-4">
        <router-link :to="{ name: 'registro' }" @click="loginModalStore.cerrar()" class="rounded-md px-2 py-1.5 font-semibold text-quiniela-verde hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-quiniela-verde">Crear cuenta</router-link>
        <router-link :to="{ name: 'recuperar-password' }" @click="loginModalStore.cerrar()" class="rounded-md px-2 py-1.5 text-quiniela-verde hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-quiniela-verde">Olvidé mi contraseña</router-link>
      </div>
    </form>
  </div>
</template>
