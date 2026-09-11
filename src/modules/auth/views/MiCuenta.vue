<script setup>
import { ref } from 'vue';
import { useAuthStore } from '@/store/auth';
import { actualizarNombre, actualizarCorreo, actualizarPassword, traducirErrorAuth } from '../services/authService';
import { alertaError, alertaExito } from '@/lib/alertas';

const authStore = useAuthStore();

const nombreCompleto = ref(authStore.perfil?.nombre_completo ?? '');
const guardandoNombre = ref(false);

const nuevoCorreo = ref('');
const guardandoCorreo = ref(false);

const nuevaPassword = ref('');
const confirmarPassword = ref('');
const guardandoPassword = ref(false);

async function onGuardarNombre() {
  const nombre = nombreCompleto.value.trim();
  if (!nombre) {
    await alertaError(new Error('Escribe tu nombre completo.'), 'Nombre no válido');
    return;
  }
  guardandoNombre.value = true;
  try {
    await actualizarNombre(nombre);
    await authStore.cargarPerfil();
    await alertaExito('Nombre actualizado');
  } catch (e) {
    await alertaError(new Error(traducirErrorAuth(e.message)), 'No se pudo actualizar el nombre');
  } finally {
    guardandoNombre.value = false;
  }
}

async function onGuardarCorreo() {
  guardandoCorreo.value = true;
  try {
    await actualizarCorreo(nuevoCorreo.value.trim());
    nuevoCorreo.value = '';
    await alertaExito('Solicitud enviada', 'Revisa tu correo actual y el nuevo para confirmar el cambio.');
  } catch (e) {
    await alertaError(new Error(traducirErrorAuth(e.message)), 'No se pudo cambiar el correo');
  } finally {
    guardandoCorreo.value = false;
  }
}

async function onGuardarPassword() {
  if (nuevaPassword.value !== confirmarPassword.value) {
    await alertaError(new Error('Verifica ambos campos e inténtalo nuevamente.'), 'Las contraseñas no coinciden');
    return;
  }
  guardandoPassword.value = true;
  try {
    await actualizarPassword(nuevaPassword.value);
    nuevaPassword.value = '';
    confirmarPassword.value = '';
    await alertaExito('Contraseña actualizada');
  } catch (e) {
    await alertaError(new Error(traducirErrorAuth(e.message)), 'No se pudo cambiar la contraseña');
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

    <section class="flex items-center gap-4 rounded-2xl bg-quiniela-verdeOscuro p-4 text-white shadow-sm sm:p-5">
      <img src="@assets/logo.png" alt="" class="h-14 w-14 shrink-0 rounded-full object-contain" />
      <div class="min-w-0"><p class="truncate font-bold">{{ authStore.perfil?.nombre_completo }}</p><p class="truncate text-sm text-green-100">@{{ authStore.perfil?.username }}</p></div>
    </section>

    <form @submit.prevent="onGuardarNombre" class="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 class="font-bold text-quiniela-verdeOscuro">Nombre completo</h2>
      <label class="form-label">Nombre<input v-model="nombreCompleto" type="text" autocomplete="name" required class="form-control min-h-11" /></label>
      <button type="submit" :disabled="guardandoNombre" class="min-h-11 w-full rounded-xl bg-quiniela-verde px-5 py-2.5 font-semibold text-white disabled:opacity-50 sm:w-auto">{{ guardandoNombre ? 'Guardando…' : 'Guardar nombre' }}</button>
    </form>

    <form @submit.prevent="onGuardarCorreo" class="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 class="font-bold text-quiniela-verdeOscuro">Correo</h2>
      <p class="break-all text-sm text-gray-600">Correo actual: <b>{{ authStore.user?.email }}</b></p>
      <label class="form-label">Nuevo correo<input v-model="nuevoCorreo" type="email" autocomplete="email" placeholder="nuevo@correo.com" required class="form-control min-h-11" /></label>
      <button type="submit" :disabled="guardandoCorreo" class="min-h-11 w-full rounded-xl bg-quiniela-verde px-5 py-2.5 font-semibold text-white disabled:opacity-50 sm:w-auto">{{ guardandoCorreo ? 'Enviando…' : 'Cambiar correo' }}</button>
    </form>

    <form @submit.prevent="onGuardarPassword" class="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 class="font-bold text-quiniela-verdeOscuro">Contraseña</h2>
      <label class="form-label">Nueva contraseña<input v-model="nuevaPassword" type="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres" required minlength="6" class="form-control min-h-11" /></label>
      <label class="form-label">Confirmar contraseña<input v-model="confirmarPassword" type="password" autocomplete="new-password" required minlength="6" class="form-control min-h-11" /></label>
      <button type="submit" :disabled="guardandoPassword" class="min-h-11 w-full rounded-xl bg-quiniela-verde px-5 py-2.5 font-semibold text-white disabled:opacity-50 sm:w-auto">{{ guardandoPassword ? 'Guardando…' : 'Cambiar contraseña' }}</button>
    </form>
  </main>
</template>
