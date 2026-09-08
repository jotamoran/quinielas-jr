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
        <input v-model="email" type="email" placeholder="Correo" required
          class="w-full border rounded px-3 py-2" />
        <p v-if="error" class="text-quiniela-error text-sm">{{ error }}</p>
        <button type="submit" :disabled="cargando"
          class="w-full bg-quiniela-dorado hover:bg-quiniela-doradoOscuro text-quiniela-grisTexto font-semibold py-2 rounded">
          {{ cargando ? 'Enviando...' : 'Enviar enlace' }}
        </button>
      </template>
      <p v-else class="text-quiniela-verdeAcento text-sm">Revisa tu correo para continuar.</p>
    </form>
  </div>
</template>
