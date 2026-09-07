<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { verificarCodigo } from '../services/authService';

const route = useRoute();
const router = useRouter();
const email = ref(route.query.email ?? '');
const codigo = ref('');
const error = ref('');
const cargando = ref(false);

async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    await verificarCodigo({ email: email.value, codigo: codigo.value });
    router.push({ name: 'mis-quinielas' });
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
      <h1 class="text-2xl font-bold text-quiniela-verdeOscuro text-center">Verifica tu correo</h1>
      <p class="text-sm text-gray-600">Enviamos un código a {{ email }}</p>
      <input v-model="codigo" type="text" placeholder="Código de 6 dígitos" required
        class="w-full border rounded px-3 py-2" />
      <p v-if="error" class="text-quiniela-error text-sm">{{ error }}</p>
      <button type="submit" :disabled="cargando"
        class="w-full bg-quiniela-dorado hover:bg-quiniela-doradoOscuro text-quiniela-grisTexto font-semibold py-2 rounded">
        {{ cargando ? 'Verificando...' : 'Verificar' }}
      </button>
    </form>
  </div>
</template>
