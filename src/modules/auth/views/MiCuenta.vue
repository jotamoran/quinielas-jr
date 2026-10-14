<script setup>
import { onMounted, ref, watch } from 'vue';
import { useAuthStore } from '@/store/auth';
import { actualizarNombre, actualizarTelefono, actualizarCorreo, actualizarPassword, traducirErrorAuth } from '../services/authService';
import { obtenerDatosBancarios } from '../../quinielas/services/quinielasService';
import { actualizarDatosBancarios } from '../../admin/services/adminService';
import { alertaError, alertaExito } from '@/lib/alertas';
import CampoPassword from '@/components/CampoPassword.vue';

const authStore = useAuthStore();

const nombreCompleto = ref(authStore.perfil?.nombre_completo ?? '');
const guardandoNombre = ref(false);
const telefono = ref(authStore.perfil?.telefono ?? '');
const guardandoTelefono = ref(false);
const telefonoEditado = ref(false);
watch(() => authStore.perfil?.telefono, (valor) => {
  if (!telefonoEditado.value) telefono.value = valor ?? '';
});

async function onGuardarTelefono() {
  if (guardandoTelefono.value || authStore.errorPerfil) return;
  guardandoTelefono.value = true;
  try {
    const guardado = await actualizarTelefono(telefono.value);
    telefono.value = guardado ?? '';
    telefonoEditado.value = false;
    await authStore.cargarPerfil();
    if (authStore.errorPerfil) {
      await alertaError(new Error('El teléfono se guardó, pero no se pudo recargar tu perfil. Recarga la página para consultar tus datos.'), 'No se pudo recargar el perfil');
      return;
    }
    await alertaExito(guardado ? 'Teléfono actualizado' : 'Teléfono eliminado');
  } catch (e) {
    await alertaError(e, 'No se pudo actualizar el teléfono');
  } finally {
    guardandoTelefono.value = false;
  }
}

const banco = ref('');
const clabe = ref('');
const titular = ref('');
const guardandoBanco = ref(false);

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

async function onGuardarDatosBancarios() {
  const bancoNormalizado = banco.value.trim();
  const clabeNormalizada = clabe.value.replace(/\s/g, '');
  const titularNormalizado = titular.value.trim();
  if ((bancoNormalizado || clabeNormalizada || titularNormalizado) && (!bancoNormalizado || !titularNormalizado || !/^\d{18}$/.test(clabeNormalizada))) {
    await alertaError(new Error('Captura banco, titular y una CLABE de 18 dígitos.'), 'Datos bancarios no válidos');
    return;
  }
  guardandoBanco.value = true;
  try {
    await actualizarDatosBancarios({ banco: bancoNormalizado, clabe: clabeNormalizada, titular: titularNormalizado });
    await alertaExito('Datos bancarios actualizados');
  } catch (e) {
    await alertaError(e, 'No se pudieron guardar los datos bancarios');
  } finally {
    guardandoBanco.value = false;
  }
}

onMounted(async () => {
  if (!authStore.isAdmin) return;
  try {
    const datos = await obtenerDatosBancarios();
    banco.value = datos?.banco ?? '';
    clabe.value = datos?.clabe ?? '';
    titular.value = datos?.titular ?? '';
  } catch (e) {
    await alertaError(e, 'No se pudieron cargar los datos bancarios');
  }
});
</script>

<template>
  <main class="page-shell max-w-2xl">
    <header>
      <p class="eyebrow">Mi cuenta</p>
      <h1 class="page-title">Configuración</h1>
      <p class="page-description">Administra tu nombre, teléfono, correo y contraseña.</p>
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

    <form @submit.prevent="onGuardarTelefono" class="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 class="font-bold text-quiniela-verdeOscuro">Teléfono de contacto (opcional)</h2>
      <p id="ayuda-telefono" class="text-sm text-gray-600">Si resultas ganador, intentaremos contactarte por correo o por este número.</p>
      <label class="form-label">Teléfono<input v-model="telefono" @input="telefonoEditado = true" type="tel" autocomplete="tel" inputmode="tel" :disabled="guardandoTelefono || authStore.errorPerfil" aria-describedby="ayuda-telefono formato-telefono" placeholder="55 1234 5678" class="form-control min-h-11 disabled:opacity-50" /><span id="formato-telefono" class="mt-1 block text-xs font-normal text-gray-500">De 10 a 15 dígitos, con + opcional al inicio. Déjalo vacío para eliminarlo.</span></label>
      <p v-if="authStore.errorPerfil" role="alert" class="text-sm text-red-700">No se pudo cargar tu perfil. Recarga la página antes de editar el teléfono.</p>
      <button type="submit" :disabled="guardandoTelefono || authStore.errorPerfil" class="min-h-11 w-full rounded-xl bg-quiniela-verde px-5 py-2.5 font-semibold text-white disabled:opacity-50 sm:w-auto">{{ guardandoTelefono ? 'Guardando…' : 'Guardar teléfono' }}</button>
    </form>

    <form @submit.prevent="onGuardarCorreo" class="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 class="font-bold text-quiniela-verdeOscuro">Correo</h2>
      <p class="break-all text-sm text-gray-600">Correo actual: <b>{{ authStore.user?.email }}</b></p>
      <label class="form-label">Nuevo correo<input v-model="nuevoCorreo" type="email" autocomplete="email" placeholder="nuevo@correo.com" required class="form-control min-h-11" /></label>
      <button type="submit" :disabled="guardandoCorreo" class="min-h-11 w-full rounded-xl bg-quiniela-verde px-5 py-2.5 font-semibold text-white disabled:opacity-50 sm:w-auto">{{ guardandoCorreo ? 'Enviando…' : 'Cambiar correo' }}</button>
    </form>

    <form @submit.prevent="onGuardarPassword" class="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 class="font-bold text-quiniela-verdeOscuro">Contraseña</h2>
      <CampoPassword v-model="nuevaPassword" label="Nueva contraseña" autocomplete="new-password" placeholder="Mínimo 6 caracteres" :minlength="6" />
      <CampoPassword v-model="confirmarPassword" label="Confirmar contraseña" autocomplete="new-password" :minlength="6" />
      <button type="submit" :disabled="guardandoPassword" class="min-h-11 w-full rounded-xl bg-quiniela-verde px-5 py-2.5 font-semibold text-white disabled:opacity-50 sm:w-auto">{{ guardandoPassword ? 'Guardando…' : 'Cambiar contraseña' }}</button>
    </form>

    <form v-if="authStore.isAdmin" @submit.prevent="onGuardarDatosBancarios" class="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 class="font-bold text-quiniela-verdeOscuro">Datos bancarios</h2>
      <p class="text-sm text-gray-500">Se le muestran a quien registre una quiniela y elija pagar por transferencia.</p>
      <label class="form-label">Banco<input v-model="banco" type="text" class="form-control min-h-11" /></label>
      <label class="form-label">CLABE<input v-model="clabe" type="text" inputmode="numeric" maxlength="18" pattern="\d{18}" class="form-control min-h-11" /><span class="mt-1 block text-xs font-normal text-gray-500">Debe contener exactamente 18 dígitos.</span></label>
      <label class="form-label">Titular / beneficiario<input v-model="titular" type="text" class="form-control min-h-11" /></label>
      <button type="submit" :disabled="guardandoBanco" class="min-h-11 w-full rounded-xl bg-quiniela-verde px-5 py-2.5 font-semibold text-white disabled:opacity-50 sm:w-auto">{{ guardandoBanco ? 'Guardando…' : 'Guardar datos bancarios' }}</button>
    </form>
  </main>
</template>
