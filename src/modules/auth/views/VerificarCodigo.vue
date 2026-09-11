<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { verificarCodigo } from '../services/authService';
import { alertaError, alertaExito } from '@/lib/alertas';

const route = useRoute();
const router = useRouter();
const email = ref(route.query.email ?? '');
const codigo = ref('');
const cargando = ref(false);

async function onSubmit() {
  cargando.value = true;
  try {
    await verificarCodigo({ email: email.value, codigo: codigo.value });
    await alertaExito('Correo verificado', 'Tu cuenta ya está lista para usarse.');
    router.push({ name: 'mis-quinielas' });
  } catch (e) {
    await alertaError(e, 'No se pudo verificar el código');
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <form @submit.prevent="onSubmit" class="auth-card">
      <img src="@assets/logo.png" alt="Quinielas JR" class="auth-logo" />
      <div class="space-y-1"><h1 class="auth-title">Verifica tu correo</h1><p class="auth-description">Enviamos un código a <span class="font-semibold text-gray-700 break-all">{{ email }}</span></p></div>
      <label class="form-label">Código de verificación<input v-model="codigo" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="Código de 6 dígitos" required class="form-control min-h-11 tracking-widest" /></label>
      <button type="submit" :disabled="cargando" class="primary-action">
        {{ cargando ? 'Verificando...' : 'Verificar' }}
      </button>
      <router-link :to="{ name: 'registro' }" class="auth-link block text-center">← Corregir correo</router-link>
    </form>
  </div>
</template>
