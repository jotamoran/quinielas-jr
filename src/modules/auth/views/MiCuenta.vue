<script setup>
import { ref } from 'vue';
import { useAuthStore } from '@/store/auth';
import { actualizarNombre, actualizarCorreo, actualizarPassword, traducirErrorAuth } from '../services/authService';

const authStore = useAuthStore();

const nombreCompleto = ref(authStore.perfil?.nombre_completo ?? '');
const guardandoNombre = ref(false);
const errorNombre = ref('');
const exitoNombre = ref('');

const nuevoCorreo = ref('');
const guardandoCorreo = ref(false);
const errorCorreo = ref('');
const exitoCorreo = ref('');

const nuevaPassword = ref('');
const confirmarPassword = ref('');
const guardandoPassword = ref(false);
const errorPassword = ref('');
const exitoPassword = ref('');

async function onGuardarNombre() {
  errorNombre.value = '';
  exitoNombre.value = '';
  guardandoNombre.value = true;
  try {
    await actualizarNombre(nombreCompleto.value.trim());
    await authStore.cargarPerfil();
    exitoNombre.value = 'Nombre actualizado.';
  } catch (e) {
    errorNombre.value = traducirErrorAuth(e.message);
  } finally {
    guardandoNombre.value = false;
  }
}

async function onGuardarCorreo() {
  errorCorreo.value = '';
  exitoCorreo.value = '';
  guardandoCorreo.value = true;
  try {
    await actualizarCorreo(nuevoCorreo.value.trim());
    exitoCorreo.value = 'Revisa tu nuevo correo para confirmar el cambio.';
    nuevoCorreo.value = '';
  } catch (e) {
    errorCorreo.value = traducirErrorAuth(e.message);
  } finally {
    guardandoCorreo.value = false;
  }
}

async function onGuardarPassword() {
  errorPassword.value = '';
  exitoPassword.value = '';
  if (nuevaPassword.value !== confirmarPassword.value) {
    errorPassword.value = 'Las contraseñas no coinciden.';
    return;
  }
  guardandoPassword.value = true;
  try {
    await actualizarPassword(nuevaPassword.value);
    exitoPassword.value = 'Contraseña actualizada.';
    nuevaPassword.value = '';
    confirmarPassword.value = '';
  } catch (e) {
    errorPassword.value = traducirErrorAuth(e.message);
  } finally {
    guardandoPassword.value = false;
  }
}
</script>

<template>
  <main class="page-shell max-w-2xl">
    <header>
      <p class="eyebrow">Mi cuenta</p>
      <h1 class="page-title">Configuración</h1>
      <p class="page-description">Administra tu nombre, correo y contraseña.</p>
    </header>

    <form @submit.prevent="onGuardarNombre" class="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 class="font-bold text-quiniela-verdeOscuro">Nombre completo</h2>
      <label class="form-label">Nombre<input v-model="nombreCompleto" type="text" autocomplete="name" required class="form-control min-h-11" /></label>
      <p v-if="errorNombre" role="alert" class="rounded-lg bg-red-50 p-2 text-sm text-quiniela-error">{{ errorNombre }}</p>
      <p v-if="exitoNombre" role="status" class="rounded-lg bg-green-50 p-2 text-sm text-quiniela-verde">{{ exitoNombre }}</p>
      <button type="submit" :disabled="guardandoNombre" class="min-h-11 rounded-xl bg-quiniela-verde px-5 py-2.5 font-semibold text-white disabled:opacity-50">{{ guardandoNombre ? 'Guardando…' : 'Guardar nombre' }}</button>
    </form>

    <form @submit.prevent="onGuardarCorreo" class="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 class="font-bold text-quiniela-verdeOscuro">Correo</h2>
      <p class="text-sm text-gray-600">Correo actual: <b>{{ authStore.user?.email }}</b></p>
      <label class="form-label">Nuevo correo<input v-model="nuevoCorreo" type="email" autocomplete="email" placeholder="nuevo@correo.com" required class="form-control min-h-11" /></label>
      <p v-if="errorCorreo" role="alert" class="rounded-lg bg-red-50 p-2 text-sm text-quiniela-error">{{ errorCorreo }}</p>
      <p v-if="exitoCorreo" role="status" class="rounded-lg bg-green-50 p-2 text-sm text-quiniela-verde">{{ exitoCorreo }}</p>
      <button type="submit" :disabled="guardandoCorreo" class="min-h-11 rounded-xl bg-quiniela-verde px-5 py-2.5 font-semibold text-white disabled:opacity-50">{{ guardandoCorreo ? 'Enviando…' : 'Cambiar correo' }}</button>
    </form>

    <form @submit.prevent="onGuardarPassword" class="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 class="font-bold text-quiniela-verdeOscuro">Contraseña</h2>
      <label class="form-label">Nueva contraseña<input v-model="nuevaPassword" type="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres" required minlength="6" class="form-control min-h-11" /></label>
      <label class="form-label">Confirmar contraseña<input v-model="confirmarPassword" type="password" autocomplete="new-password" required minlength="6" class="form-control min-h-11" /></label>
      <p v-if="errorPassword" role="alert" class="rounded-lg bg-red-50 p-2 text-sm text-quiniela-error">{{ errorPassword }}</p>
      <p v-if="exitoPassword" role="status" class="rounded-lg bg-green-50 p-2 text-sm text-quiniela-verde">{{ exitoPassword }}</p>
      <button type="submit" :disabled="guardandoPassword" class="min-h-11 rounded-xl bg-quiniela-verde px-5 py-2.5 font-semibold text-white disabled:opacity-50">{{ guardandoPassword ? 'Guardando…' : 'Cambiar contraseña' }}</button>
    </form>
  </main>
</template>
