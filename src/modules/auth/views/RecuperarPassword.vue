<script setup>
import { ref } from 'vue';
import { recuperarPassword } from '../services/authService';
import { alertaError, alertaExito } from '@/lib/alertas';

const email = ref('');
const cargando = ref(false);

async function onSubmit() {
  cargando.value = true;
  try {
    await recuperarPassword({ email: email.value });
    await alertaExito('Revisa tu correo', 'Te enviamos las instrucciones para recuperar tu contraseña.');
  } catch (e) {
    await alertaError(e, 'No se pudo enviar el enlace');
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <form @submit.prevent="onSubmit" class="auth-card">
      <img src="@assets/logo.png" alt="Quinielas JR" class="auth-logo" />
      <div class="space-y-1"><h1 class="auth-title">Recuperar contraseña</h1><p class="auth-description">Escribe el correo asociado a tu cuenta.</p></div>
      <label class="form-label">Correo<input v-model="email" type="email" autocomplete="email" placeholder="correo@ejemplo.com" required class="form-control min-h-11" /></label>
      <button type="submit" :disabled="cargando" class="primary-action">{{ cargando ? 'Enviando...' : 'Enviar enlace' }}</button>
      <router-link :to="{ name: 'login' }" class="auth-link block text-center">← Volver a iniciar sesión</router-link>
    </form>
  </div>
</template>
