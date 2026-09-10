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
  <div class="flex min-h-screen items-center justify-center bg-quiniela-grisClaro px-4 py-8">
    <form @submit.prevent="onSubmit" class="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-md sm:p-8">
      <img src="@assets/logo.png" alt="Quinielas JR" class="h-16 w-16 mx-auto rounded-full mb-2" />
      <h1 class="text-2xl font-bold text-quiniela-verdeOscuro text-center">Verifica tu correo</h1>
      <p class="text-sm text-gray-600">Enviamos un código a {{ email }}</p>
      <label class="form-label">Código de verificación<input v-model="codigo" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="Código de 6 dígitos" required class="form-control min-h-11 tracking-widest" /></label>
      <p v-if="error" role="alert" class="rounded-lg bg-red-50 p-2 text-quiniela-error text-sm">{{ error }}</p>
      <button type="submit" :disabled="cargando"
        class="min-h-11 w-full rounded-xl bg-quiniela-dorado py-2 font-semibold text-quiniela-grisTexto hover:bg-quiniela-doradoOscuro">
        {{ cargando ? 'Verificando...' : 'Verificar' }}
      </button>
      <router-link :to="{ name: 'registro' }" class="block text-center text-sm font-semibold text-quiniela-verde">← Corregir correo</router-link>
    </form>
  </div>
</template>
