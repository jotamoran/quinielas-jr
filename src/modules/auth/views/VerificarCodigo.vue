<script setup>
import { onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { reenviarCodigo, verificarCodigo } from '../services/authService';
import { alertaError, alertaExito } from '@/lib/alertas';

const route = useRoute();
const router = useRouter();
const email = ref(route.query.email ?? '');
const codigo = ref('');
const cargando = ref(false);
const reenviando = ref(false);
const segundosReenvio = ref(0);
let temporizador;

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

async function onReenviar() {
  if (reenviando.value || segundosReenvio.value) return;
  reenviando.value = true;
  try {
    await reenviarCodigo(email.value);
    segundosReenvio.value = 60;
    temporizador = setInterval(() => { segundosReenvio.value -= 1; if (segundosReenvio.value <= 0) clearInterval(temporizador); }, 1000);
    await alertaExito('Código reenviado', 'Revisa tu correo y usa el código más reciente.');
  } catch (e) { await alertaError(e, 'No se pudo reenviar el código'); } finally { reenviando.value = false; }
}

onUnmounted(() => clearInterval(temporizador));
</script>

<template>
  <div class="auth-page">
    <form @submit.prevent="onSubmit" class="auth-card">
      <img src="@assets/logo.png" alt="Quinielas JR" class="auth-logo" />
      <div class="space-y-1"><h1 class="auth-title">Verifica tu correo</h1><p class="auth-description">Enviamos un código a <span class="font-semibold text-gray-700 break-all">{{ email }}</span></p></div>
      <label class="form-label">Código de verificación<input v-model="codigo" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" minlength="6" pattern="[0-9]{6}" placeholder="Código de 6 dígitos" required class="form-control min-h-11 tracking-widest" @input="codigo = codigo.replace(/\D/g, '').slice(0, 6)" /></label>
      <button type="submit" :disabled="cargando" class="primary-action">
        {{ cargando ? 'Verificando...' : 'Verificar' }}
      </button>
      <button type="button" class="auth-link mx-auto" :disabled="reenviando || segundosReenvio > 0" @click="onReenviar">{{ reenviando ? 'Enviando…' : segundosReenvio ? `Reenviar en ${segundosReenvio}s` : 'Reenviar código' }}</button>
      <router-link :to="{ name: 'registro' }" class="auth-link block text-center">← Corregir correo</router-link>
    </form>
  </div>
</template>
