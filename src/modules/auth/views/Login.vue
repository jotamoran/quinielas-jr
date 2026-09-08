<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { iniciarSesion } from '../services/authService';

const email = ref('');
const password = ref('');
const error = ref('');
const cargando = ref(false);
const router = useRouter();

async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    const correoFinal = email.value.trim().toLowerCase() === 'admin'
      ? import.meta.env.VITE_ADMIN_ALIAS_EMAIL
      : email.value;
    await iniciarSesion({ email: correoFinal, password: password.value });
    router.push({ name: 'mis-quinielas' });
  } catch (e) {
    error.value = e.message;
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
      <input v-model="email" type="text" inputmode="email" autocomplete="username" placeholder="Correo (o &quot;admin&quot;)" required
        class="w-full border rounded px-3 py-2" />
      <input v-model="password" type="password" placeholder="Contraseña" required
        class="w-full border rounded px-3 py-2" />
      <p v-if="error" class="text-quiniela-error text-sm">{{ error }}</p>
      <button type="submit" :disabled="cargando"
        class="w-full bg-quiniela-dorado hover:bg-quiniela-doradoOscuro text-quiniela-grisTexto font-semibold py-2 rounded">
        {{ cargando ? 'Entrando...' : 'Iniciar sesión' }}
      </button>
      <div class="text-center text-sm space-x-2">
        <router-link :to="{ name: 'registro' }" class="text-quiniela-verde">Crear cuenta</router-link>
        <router-link :to="{ name: 'recuperar-password' }" class="text-quiniela-verde">Olvidé mi contraseña</router-link>
      </div>
    </form>
  </div>
</template>
