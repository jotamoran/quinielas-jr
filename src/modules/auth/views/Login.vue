<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { iniciarSesion, traducirErrorAuth } from '../services/authService';
import { alertaError } from '@/lib/alertas';
import CampoPassword from '@/components/CampoPassword.vue';

const entrada = ref('');
const password = ref('');
const cargando = ref(false);
const router = useRouter();

async function onSubmit() {
  cargando.value = true;
  try {
    await iniciarSesion({ entrada: entrada.value, password: password.value });
    router.push({ name: 'mis-quinielas' });
  } catch (e) {
    await alertaError(new Error(traducirErrorAuth(e.message)), 'No se pudo iniciar sesión');
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <form @submit.prevent="onSubmit" class="auth-card">
      <img src="@assets/logo.png" alt="Quinielas JR" class="auth-logo" />
      <div class="space-y-1"><h1 class="auth-title">Inicia sesión</h1><p class="auth-description">Entra para registrar y consultar tus quinielas.</p></div>
      <label class="form-label">Correo o usuario<input v-model="entrada" type="text" autocomplete="username" placeholder="correo@ejemplo.com o tu usuario" required class="form-control" /></label>
      <CampoPassword v-model="password" placeholder="Tu contraseña" />
      <button type="submit" :disabled="cargando" class="primary-action">
        {{ cargando ? 'Entrando...' : 'Iniciar sesión' }}
      </button>
      <div class="flex flex-col items-center gap-1 sm:flex-row sm:justify-center sm:gap-3">
        <router-link :to="{ name: 'registro' }" class="auth-link">Crear cuenta</router-link>
        <router-link :to="{ name: 'recuperar-password' }" class="auth-link font-normal">Olvidé mi contraseña</router-link>
      </div>
    </form>
  </div>
</template>
