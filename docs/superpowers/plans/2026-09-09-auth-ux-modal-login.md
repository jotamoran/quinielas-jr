# Autenticación menos invasiva (modal de login) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el redirect duro a `/login` en Resultados públicos y Llenar quiniela por un modal de login, sin perder el contexto de lo que la persona estaba viendo.

**Architecture:** Un store de Pinia (`loginModal`) guarda si el modal está abierto; un componente `LoginModal.vue` (montado una sola vez en `App.vue`) reacciona a ese store y reutiliza la lógica de login ya existente (`iniciarSesion`). Las páginas que hoy redirigen a `/login` llaman en su lugar a `loginModalStore.abrir()`; la reactividad de `authStore.isLoggedIn` hace que el resto de la UI (nav, banners) se actualice sola cuando el login sea exitoso, sin navegar ni recargar.

**Tech Stack:** Vue 3 (`<script setup>`), Vue Router 4, Pinia 3, Tailwind, Vitest.

## Global Constraints

- Aplica **solo** a las rutas `tabla-publica` (Resultados) y `llenar-quiniela` (Jugar). `mis-quinielas` y toda ruta `admin/*` siguen redirigiendo a `/login` sin cambios.
- El modal soporta **solo login** (correo + contraseña). "Crear cuenta" y "Olvidé mi contraseña" siguen siendo las páginas completas ya existentes; el modal solo enlaza a ellas y no las reimplementa.
- El botón "Registrar" en Resultados manda a `/llenar-quiniela` tal cual, sin parámetro de jornada (la app sigue asumiendo una sola jornada activa a la vez).
- No se agrega ningún control de "Recordarme" — ya investigado y confirmado que la sesión persiste sola por defecto (Supabase client + configuración del proyecto sin "Time-box"/"Inactivity timeout").
- No se tocan `Login.vue`, `Registro.vue`, `VerificarCodigo.vue`, `RecuperarPassword.vue`.
- Este proyecto no tiene infraestructura de pruebas de componentes Vue (no hay `@vue/test-utils` ni `jsdom` instalados; `vitest` corre en entorno `node` y los tests existentes solo cubren funciones puras). No se agrega esa infraestructura en este plan — sigue el patrón ya establecido: **TDD real (test + código) solo para lógica pura** (el store `loginModal`, que no toca el DOM); los cambios de plantilla se verifican con `npm run build` (falla si hay un error de compilación de plantilla) y con verificación manual en `npm run dev` siguiendo los pasos de cada tarea.

---

### Task 1: Store `loginModal` (Pinia)

**Files:**
- Create: `src/store/loginModal.js`
- Test: `tests/unit/loginModal.test.js`

**Interfaces:**
- Produces: `useLoginModalStore()` → store Pinia con estado `{ abierto: boolean }` y acciones `abrir()`, `cerrar()`. Todas las tareas siguientes importan este store así: `import { useLoginModalStore } from '@/store/loginModal'`.

- [ ] **Step 1: Escribir el test (debe fallar, el store no existe todavía)**

```js
// tests/unit/loginModal.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useLoginModalStore } from '@/store/loginModal';

describe('useLoginModalStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('empieza cerrado', () => {
    const store = useLoginModalStore();
    expect(store.abierto).toBe(false);
  });

  it('abrir() pone abierto en true', () => {
    const store = useLoginModalStore();
    store.abrir();
    expect(store.abierto).toBe(true);
  });

  it('cerrar() pone abierto en false', () => {
    const store = useLoginModalStore();
    store.abrir();
    store.cerrar();
    expect(store.abierto).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run tests/unit/loginModal.test.js`
Expected: FAIL — no se puede resolver el módulo `@/store/loginModal` (el archivo no existe).

- [ ] **Step 3: Crear el store**

```js
// src/store/loginModal.js
import { defineStore } from 'pinia';

export const useLoginModalStore = defineStore('loginModal', {
  state: () => ({
    abierto: false,
  }),

  actions: {
    abrir() {
      this.abierto = true;
    },
    cerrar() {
      this.abierto = false;
    },
  },
});
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx vitest run tests/unit/loginModal.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Correr toda la suite (regresión) y compilar**

Run: `npm test && npm run build`
Expected: los 23 tests pasan (20 existentes + 3 nuevos), build sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/store/loginModal.js tests/unit/loginModal.test.js
git commit -m "Agrega store loginModal para controlar el modal de login global"
```

---

### Task 2: Componente `LoginModal.vue` + montarlo en `App.vue`

**Files:**
- Create: `src/components/LoginModal.vue`
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `useLoginModalStore()` (Task 1) — lee `abierto`, llama `cerrar()`. `iniciarSesion({ email, password })` de `src/modules/auth/services/authService.js` (ya existe, sin cambios: `await supabase.auth.signInWithPassword({ email, password })`, lanza si hay error).
- Produces: componente `<LoginModal />` sin props — se controla enteramente vía el store. Cualquier tarea siguiente que quiera abrir el modal solo necesita `loginModalStore.abrir()`; no necesita saber nada de este componente.

- [ ] **Step 1: Crear el componente**

```vue
<!-- src/components/LoginModal.vue -->
<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useLoginModalStore } from '@/store/loginModal';
import { iniciarSesion } from '@/modules/auth/services/authService';

const loginModalStore = useLoginModalStore();
const email = ref('');
const password = ref('');
const error = ref('');
const cargando = ref(false);

watch(() => loginModalStore.abierto, (abierto) => {
  if (abierto) {
    email.value = '';
    password.value = '';
    error.value = '';
  }
});

async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    const correoFinal = email.value.trim().toLowerCase() === 'admin'
      ? import.meta.env.VITE_ADMIN_ALIAS_EMAIL
      : email.value;
    await iniciarSesion({ email: correoFinal, password: password.value });
    loginModalStore.cerrar();
  } catch (e) {
    error.value = e.message;
  } finally {
    cargando.value = false;
  }
}

function alPresionarTecla(e) {
  if (e.key === 'Escape' && loginModalStore.abierto) loginModalStore.cerrar();
}

onMounted(() => window.addEventListener('keydown', alPresionarTecla));
onUnmounted(() => window.removeEventListener('keydown', alPresionarTecla));
</script>

<template>
  <div v-if="loginModalStore.abierto" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" @click.self="loginModalStore.cerrar()">
    <form @submit.prevent="onSubmit" class="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl sm:p-8">
      <div class="flex items-start justify-between">
        <img src="@assets/logo.png" alt="Quinielas JR" class="h-14 w-14 rounded-full" />
        <button type="button" @click="loginModalStore.cerrar()" class="text-2xl leading-none text-gray-400 hover:text-gray-600" aria-label="Cerrar">×</button>
      </div>
      <h2 class="text-xl font-bold text-quiniela-verdeOscuro">Inicia sesión</h2>
      <input v-model="email" type="text" inputmode="email" autocomplete="username" placeholder="Correo (o &quot;admin&quot;)" required class="w-full rounded border px-3 py-2" />
      <input v-model="password" type="password" autocomplete="current-password" placeholder="Contraseña" required class="w-full rounded border px-3 py-2" />
      <p v-if="error" class="text-sm text-quiniela-error">{{ error }}</p>
      <button type="submit" :disabled="cargando" class="w-full rounded bg-quiniela-dorado py-2 font-semibold text-quiniela-grisTexto hover:bg-quiniela-doradoOscuro">
        {{ cargando ? 'Entrando...' : 'Iniciar sesión' }}
      </button>
      <div class="space-x-2 text-center text-sm">
        <router-link :to="{ name: 'registro' }" @click="loginModalStore.cerrar()" class="text-quiniela-verde">Crear cuenta</router-link>
        <router-link :to="{ name: 'recuperar-password' }" @click="loginModalStore.cerrar()" class="text-quiniela-verde">Olvidé mi contraseña</router-link>
      </div>
    </form>
  </div>
</template>
```

- [ ] **Step 2: Montarlo en `App.vue`**

Reemplazar el contenido completo de `src/App.vue` por:

```vue
<script setup>
import { onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import AppLayout from '@/layouts/AppLayout.vue';
import AuthLayout from '@/layouts/AuthLayout.vue';
import PublicoLayout from '@/layouts/PublicoLayout.vue';
import LoginModal from '@/components/LoginModal.vue';

const route = useRoute();
const authStore = useAuthStore();
onMounted(() => authStore.init());

// Cada layout ya renderiza su propio <router-view /> internamente, así que
// basta con montar el layout correcto según el tipo de ruta actual.
const layout = computed(() => {
  if (route.meta.guestOnly) return AuthLayout;
  if (route.name === 'tabla-publica') return PublicoLayout;
  return AppLayout;
});
</script>

<template>
  <component :is="layout" />
  <LoginModal />
</template>
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: build sin errores. (La verificación visual del modal se hace en la Tarea 3, cuando ya exista un botón real que llame a `loginModalStore.abrir()`.)

- [ ] **Step 4: Commit**

```bash
git add src/components/LoginModal.vue src/App.vue
git commit -m "Agrega LoginModal y lo monta globalmente en App.vue"
```

---

### Task 3: Conectar el header de Resultados (`PublicoLayout.vue`) al modal

**Files:**
- Modify: `src/layouts/PublicoLayout.vue`

**Interfaces:**
- Consumes: `useLoginModalStore()` (Task 1), `useAuthStore()` (ya existente en `src/store/auth.js`, getter `isLoggedIn`).

- [ ] **Step 1: Reemplazar el contenido completo de `src/layouts/PublicoLayout.vue`**

```vue
<script setup>
import { useAuthStore } from '@/store/auth';
import { useLoginModalStore } from '@/store/loginModal';

const authStore = useAuthStore();
const loginModalStore = useLoginModalStore();
</script>

<template>
  <div class="min-h-screen bg-quiniela-grisClaro">
    <header class="bg-quiniela-verdeOscuro px-4 py-3 text-white shadow-lg">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <img src="@assets/logo.png" alt="Quinielas JR" class="h-10 w-10 rounded-full" />
          <div><p class="font-bold leading-tight">Quinielas JR</p><p class="text-xs text-green-100">Resultados en vivo</p></div>
        </div>
        <router-link v-if="authStore.isLoggedIn" :to="{ name: 'mis-quinielas' }" class="rounded-xl bg-quiniela-dorado px-4 py-2 text-sm font-bold text-quiniela-grisTexto">Mis quinielas</router-link>
        <button v-else type="button" @click="loginModalStore.abrir()" class="rounded-xl bg-quiniela-dorado px-4 py-2 text-sm font-bold text-quiniela-grisTexto">Iniciar sesión</button>
      </div>
    </header>
    <main><router-view /></main>
  </div>
</template>
```

- [ ] **Step 2: Verificación manual end-to-end del modal**

Run: `npm run dev`, abre `/publico/<un-jornadaId-real>` en una ventana de incógnito (sin sesión).

Expected:
1. El header muestra botón "Iniciar sesión" (no navega a ningún lado al pasar el mouse).
2. Click en el botón → aparece el modal centrado con overlay oscuro.
3. Click fuera del modal (en el overlay) → se cierra. Volver a abrirlo.
4. Tecla `Esc` → se cierra. Volver a abrirlo.
5. Ingresar credenciales válidas → el modal se cierra solo y el header cambia a "Mis quinielas", sin recargar la página ni navegar.
6. Ingresar credenciales inválidas → aparece el mensaje de error dentro del modal, el modal no se cierra.

- [ ] **Step 3: Commit**

```bash
git add src/layouts/PublicoLayout.vue
git commit -m "PublicoLayout abre el modal de login en vez de redirigir a /login"
```

---

### Task 4: Quitar el guard de auth de la ruta `llenar-quiniela`

**Files:**
- Modify: `src/modules/quinielas/router.js`

**Interfaces:**
- No produce ni consume nada nuevo — solo cambia el comportamiento del router guard global ya existente en `src/router/index.js` (sin tocar ese archivo).

- [ ] **Step 1: Reemplazar el contenido completo de `src/modules/quinielas/router.js`**

```js
export default [
  { path: '/', redirect: { name: 'mis-quinielas' } },
  { path: '/mis-quinielas', name: 'mis-quinielas', component: () => import('./views/MisQuinielas.vue'), meta: { requiresAuth: true } },
  { path: '/llenar-quiniela', name: 'llenar-quiniela', component: () => import('./views/LlenarQuiniela.vue') },
];
```

- [ ] **Step 2: Verificación manual**

Run: `npm run dev`, en ventana de incógnito (sin sesión):
- Visitar `/llenar-quiniela` directo → **ya no** redirige a `/login` (carga la página, aunque su contenido todavía no está adaptado a "sin sesión" — eso se resuelve en la Tarea 7, es esperado que se vea incompleto por ahora).
- Visitar `/mis-quinielas` directo → **sigue** redirigiendo a `/login` (regresión: no debe haber cambiado).

- [ ] **Step 3: Commit**

```bash
git add src/modules/quinielas/router.js
git commit -m "llenar-quiniela deja de requerir sesión a nivel de router"
```

---

### Task 5: `NavbarComponent.vue` consciente de la sesión

**Files:**
- Modify: `src/components/NavbarComponent.vue`

**Interfaces:**
- Consumes: `useLoginModalStore()` (Task 1), `authStore.isLoggedIn` (ya existente).

- [ ] **Step 1: Reemplazar el contenido completo de `src/components/NavbarComponent.vue`**

```vue
<script setup>
import { ref } from 'vue';
import { useAuthStore } from '@/store/auth';
import { useLoginModalStore } from '@/store/loginModal';
import { useRouter } from 'vue-router';
import { confirmarAccion } from '@/lib/alertas';

const authStore = useAuthStore();
const loginModalStore = useLoginModalStore();
const router = useRouter();
const menuAbierto = ref(false);
const adminAbierto = ref(false);

async function salir() {
  const confirmed = await confirmarAccion({ title: 'Cerrar sesión', text: 'Tendrás que iniciar sesión nuevamente.', confirmText: 'Salir' });
  if (!confirmed) return;
  await authStore.cerrarSesion();
  router.push({ name: 'login' });
}

function cerrarMenu() {
  menuAbierto.value = false;
}
</script>

<template>
  <nav class="sticky top-0 z-40 bg-quiniela-verdeOscuro px-4 py-3 text-white shadow-lg sm:px-6">
    <div class="mx-auto flex max-w-7xl items-center justify-between">
      <div class="flex items-center gap-2">
        <img src="@assets/logo.png" alt="Quinielas JR" class="h-8 w-8 rounded-full" />
        <span class="font-bold">Quinielas JR</span>
      </div>

      <div class="hidden items-center gap-2 text-sm md:flex">
        <template v-if="authStore.isLoggedIn">
          <router-link :to="{ name: 'mis-quinielas' }" class="nav-link">Mis quinielas</router-link>
          <router-link :to="{ name: 'llenar-quiniela' }" class="nav-link">Jugar</router-link>
          <div v-if="authStore.isAdmin" class="relative"><button @click="adminAbierto = !adminAbierto" class="nav-link flex items-center gap-1">Administración <span class="text-xs">▾</span></button><div v-if="adminAbierto" class="absolute right-0 mt-2 w-60 rounded-xl bg-white p-2 text-gray-700 shadow-2xl"><router-link v-for="item in [{ name: 'admin-jornadas', label: 'Crear jornada' }, { name: 'admin-administrar-jornadas', label: 'Ver jornadas' }, { name: 'admin-edicion-manual', label: 'Administrar quinielas' }, { name: 'admin-pagos', label: 'Pagos pendientes' }, { name: 'admin-sincronizar', label: 'Resultados' }, { name: 'admin-cerrar-jornada', label: 'Cerrar jornada' }]" :key="item.name" :to="{ name: item.name }" @click="adminAbierto = false" class="block rounded-lg px-3 py-2 hover:bg-green-50 hover:text-quiniela-verde">{{ item.label }}</router-link></div></div>
          <button @click="salir" class="rounded-lg bg-quiniela-dorado px-3 py-2 font-semibold text-quiniela-grisTexto">Salir</button>
        </template>
        <button v-else type="button" @click="loginModalStore.abrir()" class="rounded-lg bg-quiniela-dorado px-3 py-2 font-semibold text-quiniela-grisTexto">Iniciar sesión</button>
      </div>

      <!-- Botón hamburguesa en móvil -->
      <button
        class="md:hidden text-white"
        @click="menuAbierto = !menuAbierto"
        aria-label="Abrir menú"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path v-if="!menuAbierto" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div v-if="menuAbierto" class="mx-auto mt-3 flex max-w-7xl flex-col gap-1 border-t border-white/20 pt-3 text-sm md:hidden">
      <template v-if="authStore.isLoggedIn">
        <p class="px-3 pb-1 text-xs font-bold uppercase tracking-widest text-white/60">Mi cuenta</p>
        <router-link :to="{ name: 'mis-quinielas' }" @click="cerrarMenu" class="mobile-nav-link">Mis quinielas</router-link>
        <router-link :to="{ name: 'llenar-quiniela' }" @click="cerrarMenu" class="mobile-nav-link">Llenar quiniela</router-link>
        <template v-if="authStore.isAdmin">
          <p class="mt-2 px-3 pb-1 text-xs font-bold uppercase tracking-widest text-white/60">Administración</p>
          <router-link :to="{ name: 'admin-jornadas' }" @click="cerrarMenu" class="mobile-nav-link">Crear jornada</router-link>
          <router-link :to="{ name: 'admin-administrar-jornadas' }" @click="cerrarMenu" class="mobile-nav-link">Ver jornadas</router-link>
          <router-link :to="{ name: 'admin-edicion-manual' }" @click="cerrarMenu" class="mobile-nav-link">Administrar quinielas</router-link>
          <router-link :to="{ name: 'admin-pagos' }" @click="cerrarMenu" class="mobile-nav-link">Pagos pendientes</router-link>
          <router-link :to="{ name: 'admin-sincronizar' }" @click="cerrarMenu" class="mobile-nav-link">Resultados</router-link>
          <router-link :to="{ name: 'admin-cerrar-jornada' }" @click="cerrarMenu" class="mobile-nav-link">Cerrar jornada</router-link>
        </template>
        <button @click="salir(); cerrarMenu()" class="mt-2 rounded-lg bg-quiniela-dorado px-3 py-2 font-semibold text-quiniela-grisTexto">Cerrar sesión</button>
      </template>
      <button v-else type="button" @click="loginModalStore.abrir(); cerrarMenu()" class="mobile-nav-link text-left">Iniciar sesión</button>
    </div>
  </nav>
</template>
```

- [ ] **Step 2: Verificación manual end-to-end**

Run: `npm run dev`, en ventana de incógnito (sin sesión), visitar `/llenar-quiniela` (ya público desde la Tarea 4).

Expected:
1. El nav superior muestra solo logo + "Iniciar sesión" (desktop) — nada de "Mis quinielas"/"Jugar"/"Administración"/"Salir".
2. Abrir el menú hamburguesa en una ventana angosta → solo aparece "Iniciar sesión".
3. Click en "Iniciar sesión" (desktop o móvil) → abre el modal (ya montado desde la Tarea 2).
4. Login exitoso → el nav cambia solo al menú completo, sin recargar.
5. Con sesión iniciada, confirmar que el nav se ve exactamente igual que antes de este cambio (sin regresiones).

- [ ] **Step 3: Commit**

```bash
git add src/components/NavbarComponent.vue
git commit -m "NavbarComponent muestra header mínimo con modal de login cuando no hay sesión"
```

---

### Task 6: Leyenda de registro en `TablaPublica.vue`

**Files:**
- Modify: `src/modules/publico/views/TablaPublica.vue`

**Interfaces:**
- Consumes: `useAuthStore()`, `useLoginModalStore()` (Task 1). Usa la variable `bloqueada` ya existente en este componente (`computed(() => jornada.value && new Date(jornada.value.fecha_cierre) <= new Date())`).

- [ ] **Step 1: Agregar los imports y el store al `<script setup>`**

En `src/modules/publico/views/TablaPublica.vue`, la línea 4 hoy es:

```js
import { supabase } from '@/lib/supabase';
```

Reemplazar por:

```js
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useLoginModalStore } from '@/store/loginModal';
```

E inmediatamente después de `const route = useRoute();` (línea 7), agregar:

```js
const authStore = useAuthStore();
const loginModalStore = useLoginModalStore();
```

- [ ] **Step 2: Agregar el bloque de leyenda/botón en la plantilla**

Localizar en la plantilla (dentro de la sección "Clasificación") — nota que ya existe un segundo `<p>` de una mejora anterior (aviso de pago), no confundirlo con el nuevo bloque:

```html
      <p v-if="!bloqueada" class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Los pronósticos de cada participante estarán disponibles cuando cierre el registro.</p>
      <p class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Solo aparecen aquí las quinielas con el pago confirmado. Si registraste una entrada y no aparece en la tabla, debes completar tu pago para participar.</p>
      <TablaPosiciones ref="tablaPosiciones" :jornadaId="jornadaId" :obtenerRankingFn="obtenerRankingPublico" :obtenerPronosticosFn="obtenerPronosticosPublicos" :bloqueada="bloqueada" resaltarExtremos />
```

Reemplazar por (se agrega el nuevo bloque justo antes de `<TablaPosiciones`, las dos líneas de arriba no cambian):

```html
      <p v-if="!bloqueada" class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Los pronósticos de cada participante estarán disponibles cuando cierre el registro.</p>
      <p class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Solo aparecen aquí las quinielas con el pago confirmado. Si registraste una entrada y no aparece en la tabla, debes completar tu pago para participar.</p>
      <div v-if="!bloqueada" class="flex flex-col items-start gap-2 rounded-xl border border-quiniela-verde bg-green-50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm font-semibold text-quiniela-verdeOscuro">{{ authStore.isLoggedIn ? '¿Todavía no te registras?' : 'Inicia sesión para registrar una entrada' }}</p>
        <router-link v-if="authStore.isLoggedIn" :to="{ name: 'llenar-quiniela' }" class="rounded-lg bg-quiniela-verde px-4 py-2 text-sm font-bold text-white">Registrar</router-link>
        <button v-else type="button" @click="loginModalStore.abrir()" class="rounded-lg bg-quiniela-verde px-4 py-2 text-sm font-bold text-white">Iniciar sesión</button>
      </div>
      <TablaPosiciones ref="tablaPosiciones" :jornadaId="jornadaId" :obtenerRankingFn="obtenerRankingPublico" :obtenerPronosticosFn="obtenerPronosticosPublicos" :bloqueada="bloqueada" resaltarExtremos />
```

- [ ] **Step 3: Verificación manual**

Run: `npm run dev`.

1. Abrir `/publico/<jornadaId>` de una jornada **activa con registro abierto**, sin sesión → aparece "Inicia sesión para registrar una entrada" + botón "Iniciar sesión" → click abre el modal → login exitoso → el bloque cambia a "¿Todavía no te registras?" + botón "Registrar" → click navega a `/llenar-quiniela`.
2. Abrir `/publico/<jornadaId>` de una jornada **finalizada o con registro ya cerrado** → el bloque completo no aparece (ni con ni sin sesión).

- [ ] **Step 4: Compilar y correr toda la suite**

Run: `npm run build && npm test`
Expected: build sin errores, todos los tests pasan.

- [ ] **Step 5: Commit**

```bash
git add src/modules/publico/views/TablaPublica.vue
git commit -m "TablaPublica muestra leyenda o botón de registro según sesión"
```

---

### Task 7: `LlenarQuiniela.vue` usable sin sesión (solo lectura) hasta iniciar sesión

**Files:**
- Modify: `src/modules/quinielas/views/LlenarQuiniela.vue`

**Interfaces:**
- Consumes: `useAuthStore()`, `useLoginModalStore()` (Task 1).
- Produces: computed `necesitaLogin` — no lo consume ninguna otra tarea, es interno a este componente.

- [ ] **Step 1: Agregar los imports, stores y el computed `necesitaLogin`**

En `src/modules/quinielas/views/LlenarQuiniela.vue`, la línea 3 hoy es:

```js
import { useRouter } from 'vue-router';
```

Reemplazar por:

```js
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import { useLoginModalStore } from '@/store/loginModal';
```

Inmediatamente después de `const router = useRouter();` (línea 9), agregar:

```js
const authStore = useAuthStore();
const loginModalStore = useLoginModalStore();
```

E inmediatamente después de la línea `const bloqueado = computed(() => jornada.value && estaBloqueado(jornada.value.fecha_cierre));` (línea 21), agregar:

```js
const necesitaLogin = computed(() => !authStore.isLoggedIn);
```

- [ ] **Step 2: Actualizar la sección de pronósticos en la plantilla**

Localizar en la plantilla:

```html
      <section v-if="paso === 'pronosticos'" class="space-y-4">
        <label class="block text-sm font-semibold text-gray-700">Nombre de tu entrada<input v-model="alias" placeholder="Ej. José #2" class="mt-1 w-full rounded-xl border-gray-300" :disabled="bloqueado" /></label>
        <div class="grid gap-4"><TarjetaPartido v-for="partido in partidos" :key="partido.id" :partido="partido" v-model="pronosticos[partido.id]" :deshabilitado="bloqueado" /></div>
        <button :disabled="bloqueado || !completo || !alias.trim()" @click="paso = 'pago'" class="w-full rounded-xl bg-quiniela-verde py-3 font-bold text-white disabled:opacity-50">Continuar al pago</button>
        <p v-if="partidos.length !== 9" class="text-center text-sm text-amber-700">Esta jornada no contiene los 9 partidos requeridos.</p>
      </section>
```

Reemplazar por:

```html
      <section v-if="paso === 'pronosticos'" class="space-y-4">
        <div v-if="necesitaLogin" class="rounded-2xl border border-quiniela-verde bg-green-50 p-4 text-center">
          <p class="mb-3 font-semibold text-quiniela-verdeOscuro">Regístrate o inicia sesión para llenar tu quiniela</p>
          <button type="button" @click="loginModalStore.abrir()" class="rounded-xl bg-quiniela-verde px-5 py-2.5 font-bold text-white">Iniciar sesión</button>
        </div>
        <label class="block text-sm font-semibold text-gray-700">Nombre de tu entrada<input v-model="alias" placeholder="Ej. José #2" class="mt-1 w-full rounded-xl border-gray-300" :disabled="bloqueado || necesitaLogin" /></label>
        <div class="grid gap-4"><TarjetaPartido v-for="partido in partidos" :key="partido.id" :partido="partido" v-model="pronosticos[partido.id]" :deshabilitado="bloqueado || necesitaLogin" /></div>
        <button :disabled="bloqueado || necesitaLogin || !completo || !alias.trim()" @click="paso = 'pago'" class="w-full rounded-xl bg-quiniela-verde py-3 font-bold text-white disabled:opacity-50">Continuar al pago</button>
        <p v-if="partidos.length !== 9" class="text-center text-sm text-amber-700">Esta jornada no contiene los 9 partidos requeridos.</p>
      </section>
```

- [ ] **Step 3: Verificación manual completa (checklist de la spec)**

Run: `npm run dev`.

1. Sin sesión, visitar `/llenar-quiniela` con una jornada activa: no hay redirect, se ve el nav mínimo (Tarea 5), el countdown de cierre, y dentro de "Pronósticos" el banner "Regístrate o inicia sesión para llenar tu quiniela" con los 9 partidos visibles pero deshabilitados (no se puede elegir L/E/V) y el input de "Nombre de tu entrada" deshabilitado.
2. Click en "Iniciar sesión" del banner → abre el modal → login exitoso → **sin recargar la página**, el banner desaparece, el input y los 9 partidos se habilitan solos.
3. Completar los 9 pronósticos + alias → el botón "Continuar al pago" se habilita → confirmar que el flujo de pago sigue funcionando igual que antes (sin tocarlo).
4. Con la jornada **bloqueada** (`fecha_cierre` pasada) y sesión iniciada: todo sigue deshabilitado por `bloqueado` como hoy (sin regresión).
5. Repetir el punto 1 pero llegando desde el botón "Registrar" de `/publico/<jornadaId>` (Tarea 6) — mismo comportamiento.

- [ ] **Step 4: Compilar y correr toda la suite completa**

Run: `npm run build && npm test`
Expected: build sin errores, los 23 tests pasan.

- [ ] **Step 5: Commit**

```bash
git add src/modules/quinielas/views/LlenarQuiniela.vue
git commit -m "LlenarQuiniela permite ver los partidos sin sesión y pide login para interactuar"
```

---

## Cierre del plan

Al terminar la Tarea 7, todo el checklist "Pruebas a cubrir" del spec (`docs/superpowers/specs/2026-09-09-auth-ux-modal-login-design.md`) queda cubierto. Push a `main` (o rama + merge, según se venga haciendo en este proyecto) después de la Tarea 7, una vez confirmado el checklist completo en `npm run dev` contra datos reales (o en producción, como se ha probado el resto de esta app).
