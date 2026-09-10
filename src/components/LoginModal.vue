<!-- src/components/LoginModal.vue -->
<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useLoginModalStore } from '@/store/loginModal';
import { iniciarSesion, resolverCorreo, traducirErrorAuth } from '@/modules/auth/services/authService';

const loginModalStore = useLoginModalStore();
const route = useRoute();
const email = ref('');
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
    email.value = '';
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
    const correoFinal = resolverCorreo(email.value);
    await iniciarSesion({ email: correoFinal, password: password.value });
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
  <div v-if="loginModalStore.abierto" ref="modal" role="dialog" aria-modal="true" aria-labelledby="login-modal-titulo" :aria-describedby="error ? 'login-modal-error' : undefined" class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 px-4 py-6" @click.self="loginModalStore.cerrar()">
    <form @submit.prevent="onSubmit" class="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl sm:p-8">
      <div class="flex items-start justify-between">
        <img src="@assets/logo.png" alt="Quinielas JR" class="h-14 w-14 rounded-full" />
        <button type="button" @click="loginModalStore.cerrar()" class="grid h-11 w-11 place-items-center rounded-full text-2xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Cerrar">×</button>
      </div>
      <h2 id="login-modal-titulo" class="text-xl font-bold text-quiniela-verdeOscuro">Inicia sesión</h2>
      <label class="form-label">Correo<input ref="emailInput" v-model="email" type="text" inputmode="email" autocomplete="username" placeholder="correo@ejemplo.com o admin" required class="form-control min-h-11" /></label>
      <label class="form-label">Contraseña<input v-model="password" type="password" autocomplete="current-password" placeholder="Tu contraseña" required class="form-control min-h-11" /></label>
      <p v-if="error" id="login-modal-error" role="alert" class="rounded-lg bg-red-50 p-2 text-sm text-quiniela-error">{{ error }}</p>
      <button type="submit" :disabled="cargando" class="w-full rounded bg-quiniela-dorado py-2 font-semibold text-quiniela-grisTexto hover:bg-quiniela-doradoOscuro">
        {{ cargando ? 'Entrando...' : 'Iniciar sesión' }}
      </button>
      <div class="space-x-2 text-center text-sm">
        <router-link :to="{ name: 'registro' }" @click="loginModalStore.cerrar()" class="text-quiniela-verde">Crear cuenta</router-link>
        <router-link :to="{ name: 'recuperar-password' }" @click="loginModalStore.cerrar()" class="text-quiniela-verde">Olvidé mi contraseña</router-link>
      </div>
    </form>
  </div>
</template>
