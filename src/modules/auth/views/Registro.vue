<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { registrar, usernameDisponible, traducirErrorAuth } from '../services/authService';
import { alertaError } from '@/lib/alertas';
import CampoPassword from '@/components/CampoPassword.vue';
import { LEGAL } from '@/config/legal';
import EnlacesLegales from '@/components/EnlacesLegales.vue';

const nombreCompleto = ref('');
const email = ref('');
const username = ref('');
const telefono = ref('');
const password = ref('');
const confirmarPassword = ref('');
const acepto = ref(false);
const cargando = ref(false);
const router = useRouter();

const PATRON_USERNAME = /^[a-z0-9_]{3,20}$/;
const fuerzaPassword = computed(() => {
  let puntos = 0;
  if (password.value.length >= 8) puntos += 1;
  if (/[A-Z]/.test(password.value)) puntos += 1;
  if (/\d/.test(password.value)) puntos += 1;
  if (/[^A-Za-z0-9]/.test(password.value)) puntos += 1;
  return puntos;
});

async function onSubmit() {
  cargando.value = true;
  try {
    const usernameNormalizado = username.value.trim().toLowerCase();
    if (password.value !== confirmarPassword.value) {
      await alertaError(new Error('Las contraseñas no coinciden.'), 'Revisa tu contraseña');
      return;
    }
    if (!PATRON_USERNAME.test(usernameNormalizado)) {
      await alertaError(new Error('Usa de 3 a 20 caracteres: letras minúsculas, números o guion bajo.'), 'Usuario no válido');
      return;
    }
    if (!(await usernameDisponible(usernameNormalizado))) {
      await alertaError(new Error('Elige otro nombre para continuar.'), 'Ese usuario ya está en uso');
      return;
    }
    await registrar({ email: email.value, password: password.value, nombreCompleto: nombreCompleto.value, username: usernameNormalizado, telefono: telefono.value, aceptoTerminos: true });
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
      <label class="form-label">Teléfono de contacto (opcional)<input v-model="telefono" type="tel" autocomplete="tel" inputmode="tel" aria-describedby="ayuda-telefono-registro" placeholder="55 1234 5678" class="form-control min-h-11" /><span id="ayuda-telefono-registro" class="mt-1 block text-xs font-normal text-gray-500">Si resultas ganador, podremos contactarte por correo o por este número. De 10 a 15 dígitos; puedes usar +, espacios, guiones y paréntesis.</span></label>
      <label class="form-label">Nombre de usuario<input v-model="username" type="text" autocomplete="username" placeholder="letras, números y _ (3-20)" required minlength="3" maxlength="20" pattern="[a-z0-9_]{3,20}" class="form-control min-h-11" @input="username = username.toLowerCase()" /></label>
      <CampoPassword v-model="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres" :minlength="6" />
      <CampoPassword v-model="confirmarPassword" label="Confirmar contraseña" autocomplete="new-password" placeholder="Repite tu contraseña" :minlength="6" />
      <div v-if="password" class="-mt-2" aria-live="polite"><div class="h-1.5 overflow-hidden rounded-full bg-gray-200"><div class="h-full rounded-full transition-all" :class="fuerzaPassword < 2 ? 'bg-red-500' : fuerzaPassword < 4 ? 'bg-amber-500' : 'bg-green-600'" :style="{ width: `${Math.max(25, fuerzaPassword * 25)}%` }"></div></div><p class="mt-1 text-xs text-gray-500">{{ fuerzaPassword < 2 ? 'Contraseña débil' : fuerzaPassword < 4 ? 'Contraseña aceptable' : 'Contraseña segura' }}</p></div>
      <label class="flex items-start gap-2 text-sm text-gray-700"><input v-model="acepto" type="checkbox" required class="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-quiniela-verde" /><span>Tengo {{ LEGAL.edadMinima }} años o más y acepto los <router-link :to="{ name: 'terminos' }" target="_blank" class="font-semibold text-quiniela-verde underline">Términos y condiciones</router-link>, el <router-link :to="{ name: 'reglamento' }" target="_blank" class="font-semibold text-quiniela-verde underline">Reglamento</router-link> y el <router-link :to="{ name: 'aviso-privacidad' }" target="_blank" class="font-semibold text-quiniela-verde underline">Aviso de privacidad</router-link>.</span></label>
      <button type="submit" :disabled="cargando || !acepto" class="primary-action disabled:opacity-60">
        {{ cargando ? 'Creando...' : 'Registrarme' }}
      </button>
      <p class="text-center text-sm text-gray-600">¿Ya tienes cuenta? <router-link :to="{ name: 'login' }" class="auth-link">Inicia sesión</router-link></p>
      <EnlacesLegales />
    </form>
  </div>
</template>
