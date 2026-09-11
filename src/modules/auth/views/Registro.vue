<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { registrar, usernameDisponible, traducirErrorAuth } from '../services/authService';
import { alertaError } from '@/lib/alertas';

const nombreCompleto = ref('');
const email = ref('');
const username = ref('');
const password = ref('');
const cargando = ref(false);
const router = useRouter();

const PATRON_USERNAME = /^[a-z0-9_]{3,20}$/;

async function onSubmit() {
  cargando.value = true;
  try {
    const usernameNormalizado = username.value.trim().toLowerCase();
    if (!PATRON_USERNAME.test(usernameNormalizado)) {
      await alertaError(new Error('Usa de 3 a 20 caracteres: letras minúsculas, números o guion bajo.'), 'Usuario no válido');
      return;
    }
    if (!(await usernameDisponible(usernameNormalizado))) {
      await alertaError(new Error('Elige otro nombre para continuar.'), 'Ese usuario ya está en uso');
      return;
    }
    await registrar({ email: email.value, password: password.value, nombreCompleto: nombreCompleto.value, username: usernameNormalizado });
    router.push({ name: 'verificar-codigo', query: { email: email.value } });
  } catch (e) {
    const mensaje = /database error/i.test(e.message) ? 'Ese nombre de usuario ya está en uso. Elige otro.' : traducirErrorAuth(e.message);
    await alertaError(new Error(mensaje), 'No se pudo crear la cuenta');
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <form @submit.prevent="onSubmit" class="auth-card">
      <img src="@assets/logo.png" alt="Quinielas JR" class="auth-logo" />
      <div class="space-y-1"><h1 class="auth-title">Crear cuenta</h1><p class="auth-description">Regístrate para guardar tus pronósticos y consultar resultados.</p></div>
      <label class="form-label">Nombre completo<input v-model="nombreCompleto" type="text" autocomplete="name" placeholder="Tu nombre" required class="form-control min-h-11" /></label>
      <label class="form-label">Correo<input v-model="email" type="email" autocomplete="email" placeholder="correo@ejemplo.com" required class="form-control min-h-11" /></label>
      <label class="form-label">Nombre de usuario<input v-model="username" type="text" autocomplete="username" placeholder="letras, números y _ (3-20)" required minlength="3" maxlength="20" pattern="[a-z0-9_]{3,20}" class="form-control min-h-11" @input="username = username.toLowerCase()" /></label>
      <label class="form-label">Contraseña<input v-model="password" type="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres" required minlength="6" class="form-control min-h-11" /></label>
      <button type="submit" :disabled="cargando" class="primary-action">
        {{ cargando ? 'Creando...' : 'Registrarme' }}
      </button>
      <p class="text-center text-sm text-gray-600">¿Ya tienes cuenta? <router-link :to="{ name: 'login' }" class="auth-link">Inicia sesión</router-link></p>
    </form>
  </div>
</template>
