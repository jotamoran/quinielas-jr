<!-- src/components/LoginModal.vue -->
<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useLoginModalStore } from '@/store/loginModal';
import { iniciarSesion, resolverCorreo } from '@/modules/auth/services/authService';

const loginModalStore = useLoginModalStore();
const route = useRoute();
const email = ref('');
const password = ref('');
const error = ref('');
const cargando = ref(false);
const emailInput = ref(null);

watch(() => loginModalStore.abierto, async (abierto) => {
  cargando.value = false;
  if (abierto) {
    email.value = '';
    password.value = '';
    error.value = '';
    await nextTick();
    emailInput.value?.focus();
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
    error.value = e.message;
  } finally {
    cargando.value = false;
  }
}

function alPresionarTecla(e) {
  if (e.key === 'Escape' && loginModalStore.abierto) loginModalStore.cerrar();
}

onMounted(() => window.addEventListener('keydown', alPresionarTecla));
onUnmounted(() => window.removeEventListener('keydown', alPresionarTecla));
</script>

<template>
  <div v-if="loginModalStore.abierto" role="dialog" aria-modal="true" aria-labelledby="login-modal-titulo" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" @click.self="loginModalStore.cerrar()">
    <form @submit.prevent="onSubmit" class="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl sm:p-8">
      <div class="flex items-start justify-between">
        <img src="@assets/logo.png" alt="Quinielas JR" class="h-14 w-14 rounded-full" />
        <button type="button" @click="loginModalStore.cerrar()" class="text-2xl leading-none text-gray-400 hover:text-gray-600" aria-label="Cerrar">×</button>
      </div>
      <h2 id="login-modal-titulo" class="text-xl font-bold text-quiniela-verdeOscuro">Inicia sesión</h2>
      <input ref="emailInput" v-model="email" type="text" inputmode="email" autocomplete="username" placeholder="Correo (o &quot;admin&quot;)" required class="w-full rounded border px-3 py-2" />
      <input v-model="password" type="password" autocomplete="current-password" placeholder="Contraseña" required class="w-full rounded border px-3 py-2" />
      <p v-if="error" class="text-sm text-quiniela-error">{{ error }}</p>
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
