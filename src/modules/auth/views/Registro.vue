<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { registrar } from '../services/authService';

const nombreCompleto = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const cargando = ref(false);
const router = useRouter();

async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    await registrar({ email: email.value, password: password.value, nombreCompleto: nombreCompleto.value });
    router.push({ name: 'verificar-codigo', query: { email: email.value } });
  } catch (e) {
    error.value = e.message;
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-quiniela-grisClaro">
    <form @submit.prevent="onSubmit" class="bg-white p-8 rounded-lg shadow-md w-full max-w-sm space-y-4">
      <h1 class="text-2xl font-bold text-quiniela-verdeOscuro text-center">Crear cuenta</h1>
      <input v-model="nombreCompleto" type="text" placeholder="Nombre completo" required
        class="w-full border rounded px-3 py-2" />
      <input v-model="email" type="email" placeholder="Correo" required
        class="w-full border rounded px-3 py-2" />
      <input v-model="password" type="password" placeholder="Contraseña" required minlength="6"
        class="w-full border rounded px-3 py-2" />
      <p v-if="error" class="text-quiniela-error text-sm">{{ error }}</p>
      <button type="submit" :disabled="cargando"
        class="w-full bg-quiniela-dorado hover:bg-quiniela-doradoOscuro text-quiniela-grisTexto font-semibold py-2 rounded">
        {{ cargando ? 'Creando...' : 'Registrarme' }}
      </button>
    </form>
  </div>
</template>
