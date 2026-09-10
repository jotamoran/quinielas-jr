<script setup>
import { ref } from 'vue';
import { recuperarPassword } from '../services/authService';

const email = ref('');
const enviado = ref(false);
const error = ref('');
const cargando = ref(false);

async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    await recuperarPassword({ email: email.value });
    enviado.value = true;
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
      <h1 class="text-2xl font-bold text-quiniela-verdeOscuro text-center">Recuperar contraseña</h1>
      <template v-if="!enviado">
        <label class="form-label">Correo<input v-model="email" type="email" autocomplete="email" placeholder="correo@ejemplo.com" required class="form-control min-h-11" /></label>
        <p v-if="error" role="alert" class="rounded-lg bg-red-50 p-2 text-quiniela-error text-sm">{{ error }}</p>
        <button type="submit" :disabled="cargando"
          class="min-h-11 w-full rounded-xl bg-quiniela-dorado py-2 font-semibold text-quiniela-grisTexto hover:bg-quiniela-doradoOscuro">
          {{ cargando ? 'Enviando...' : 'Enviar enlace' }}
        </button>
      </template>
      <p v-else class="text-quiniela-verdeAcento text-sm">Revisa tu correo para continuar.</p>
      <router-link :to="{ name: 'login' }" class="block text-center text-sm font-semibold text-quiniela-verde">← Volver a iniciar sesión</router-link>
    </form>
  </div>
</template>
