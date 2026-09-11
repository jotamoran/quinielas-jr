<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { registrar, usernameDisponible } from '../services/authService';

const nombreCompleto = ref('');
const email = ref('');
const username = ref('');
const password = ref('');
const error = ref('');
const cargando = ref(false);
const router = useRouter();

async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    const usernameNormalizado = username.value.trim().toLowerCase();
    if (!(await usernameDisponible(usernameNormalizado))) {
      error.value = 'Ese nombre de usuario ya está en uso.';
      return;
    }
    await registrar({ email: email.value, password: password.value, nombreCompleto: nombreCompleto.value, username: usernameNormalizado });
    router.push({ name: 'verificar-codigo', query: { email: email.value } });
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
      <h1 class="text-2xl font-bold text-quiniela-verdeOscuro text-center">Crear cuenta</h1>
      <label class="form-label">Nombre completo<input v-model="nombreCompleto" type="text" autocomplete="name" placeholder="Tu nombre" required class="form-control min-h-11" /></label>
      <label class="form-label">Correo<input v-model="email" type="email" autocomplete="email" placeholder="correo@ejemplo.com" required class="form-control min-h-11" /></label>
      <label class="form-label">Nombre de usuario<input v-model="username" type="text" autocomplete="username" placeholder="letras, números y _ (3-20)" required minlength="3" maxlength="20" pattern="[a-z0-9_]{3,20}" class="form-control min-h-11" @input="username = username.toLowerCase()" /></label>
      <label class="form-label">Contraseña<input v-model="password" type="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres" required minlength="6" class="form-control min-h-11" /></label>
      <p v-if="error" role="alert" class="rounded-lg bg-red-50 p-2 text-quiniela-error text-sm">{{ error }}</p>
      <button type="submit" :disabled="cargando"
        class="min-h-11 w-full rounded-xl bg-quiniela-dorado py-2 font-semibold text-quiniela-grisTexto hover:bg-quiniela-doradoOscuro">
        {{ cargando ? 'Creando...' : 'Registrarme' }}
      </button>
      <p class="text-center text-sm text-gray-600">¿Ya tienes cuenta? <router-link :to="{ name: 'login' }" class="font-semibold text-quiniela-verde">Inicia sesión</router-link></p>
    </form>
  </div>
</template>
