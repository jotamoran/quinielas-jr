<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { iniciarSesion, traducirErrorAuth } from '../services/authService';

const entrada = ref('');
const password = ref('');
const error = ref('');
const cargando = ref(false);
const router = useRouter();

async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    await iniciarSesion({ entrada: entrada.value, password: password.value });
    router.push({ name: 'mis-quinielas' });
  } catch (e) {
    error.value = traducirErrorAuth(e.message);
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-quiniela-grisClaro px-4 py-8">
    <form @submit.prevent="onSubmit" class="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-md sm:p-8">
      <img src="@assets/logo.png" alt="Quinielas JR" class="h-16 w-16 mx-auto rounded-full mb-2" />
      <h1 class="text-2xl font-bold text-quiniela-verdeOscuro text-center">Quinielas JR</h1>
      <label class="form-label">Correo o usuario<input v-model="entrada" type="text" inputmode="email" autocomplete="username" placeholder="correo@ejemplo.com o tu usuario" required class="form-control min-h-11" /></label>
      <label class="form-label">Contraseña<input v-model="password" type="password" autocomplete="current-password" placeholder="Tu contraseña" required class="form-control min-h-11" /></label>
      <p v-if="error" role="alert" class="rounded-lg bg-red-50 p-2 text-quiniela-error text-sm">{{ error }}</p>
      <button type="submit" :disabled="cargando"
        class="min-h-11 w-full rounded-xl bg-quiniela-dorado py-2 font-semibold text-quiniela-grisTexto hover:bg-quiniela-doradoOscuro">
        {{ cargando ? 'Entrando...' : 'Iniciar sesión' }}
      </button>
      <div class="text-center text-sm space-x-2">
        <router-link :to="{ name: 'registro' }" class="text-quiniela-verde">Crear cuenta</router-link>
        <router-link :to="{ name: 'recuperar-password' }" class="text-quiniela-verde">Olvidé mi contraseña</router-link>
      </div>
    </form>
  </div>
</template>
