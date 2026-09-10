# Login por username, notificación al admin, búsqueda por ronda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El registro pide un nombre de usuario y el login acepta username o correo, resuelto por un endpoint de servidor que nunca expone correos reales; al registrar una quiniela por la web, el admin recibe un correo aparte; y `GestionJornadas.vue` puede buscar partidos de Liga MX por número de ronda, no solo por rango de fechas.

**Architecture:** `perfiles.username` es la fuente de verdad (única, formato validado por constraint). Dos endpoints nuevos y públicos (`api/auth/username-disponible.js`, `api/auth/iniciar-sesion.js`) usan la llave de servicio para resolver username↔correo sin exponerlo nunca al navegador; el segundo hace el login completo contra el endpoint nativo de Supabase Auth y regresa la sesión ya lista. La notificación al admin extiende el endpoint que ya envía el correo de confirmación al participante. La búsqueda por ronda agrega un segundo modo (por `round`+`season`, vía `eventsround.php`) a la función que hoy solo busca por rango de fechas (vía `eventsnextleague.php`), limitado a Liga MX por ser la única liga con su formato real de temporada verificado.

**Tech Stack:** Vue 3 (`<script setup>`), Vercel serverless functions (Node, ESM), Supabase (Postgres + RLS + funciones), TheSportsDB API.

## Global Constraints

- El username es obligatorio al registrarse, formato `^[a-z0-9_]{3,20}$`, siempre en minúsculas, único.
- Ningún endpoint nuevo expone el correo real de un usuario al navegador — ni el de disponibilidad de username, ni el de login.
- `handle_new_user()` es la única función que inserta en `perfiles` — su `CREATE OR REPLACE` debe conservar `SET search_path = public, pg_temp` (la migración 0020 de esta sesión se olvidó de esto la primera vez con `calcular_puntos()` y el review final lo encontró; no se repite aquí).
- La notificación al admin es best-effort — si falla el envío, no debe afectar la respuesta al participante ni impedir que su propio correo de confirmación se haya mandado.
- La búsqueda por ronda se implementa solo para Liga MX (`'4350'`) — ninguna otra liga tiene su formato de temporada verificado todavía.
- No se toca `RecuperarPassword.vue`, ni se elimina la variable de entorno `VITE_ADMIN_ALIAS_EMAIL` (solo se deja de referenciar en el código).
- Este proyecto no tiene infraestructura de pruebas de componentes Vue ni de mocking de Supabase/HTTP para funciones serverless con I/O real (patrón ya establecido). Las tareas de backend se verifican con `node --check`; las de frontend con `npm run build`; las funciones puras nuevas (como `seasonRangeForDate`) sí llevan test unitario porque encajan en el arnés de Vitest ya existente para este archivo.
- Nota de entorno de esta sesión: el `node`/`npm` por defecto en el PATH puede ser una versión vieja (v18) que falla el build de Vite con `crypto.hash is not a function`. Antes de correr `npm run build`/`npm test`, ejecutar en el mismo comando: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build && npm test` (el cambio de versión no persiste entre llamadas de terminal separadas).

---

### Task 1: Migración `0022_username.sql`

**Files:**
- Create: `supabase/migrations/0022_username.sql`

**Interfaces:**
- Produces: columna `perfiles.username` (`TEXT NOT NULL UNIQUE`, formato `^[a-z0-9_]{3,20}$`). Todas las tareas siguientes dependen de que exista.

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/0022_username.sql
ALTER TABLE perfiles ADD COLUMN username TEXT;

UPDATE perfiles SET username = 'admin' WHERE rol = 'admin' AND username IS NULL;

ALTER TABLE perfiles
  ALTER COLUMN username SET NOT NULL,
  ADD CONSTRAINT perfiles_username_formato CHECK (username ~ '^[a-z0-9_]{3,20}$'),
  ADD CONSTRAINT perfiles_username_unico UNIQUE (username);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO perfiles (id, nombre_completo, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre_completo', NEW.email), NEW.raw_user_meta_data->>'username');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
```

- [ ] **Step 2: No se aplica en este paso**

Igual que las migraciones anteriores de esta sesión, este archivo se entrega para que el humano lo aplique en el SQL Editor de Supabase cuando quiera — no se ejecuta como parte de esta tarea.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0022_username.sql
git commit -m "Agrega perfiles.username (obligatorio, único, formato validado)"
```

---

### Task 2: Endpoints de auth — `username-disponible` e `iniciar-sesion`

**Files:**
- Create: `api/auth/username-disponible.js`
- Create: `api/auth/iniciar-sesion.js`

**Interfaces:**
- Consumes: columna `perfiles.username` (Tarea 1).
- Produces: `GET /api/auth/username-disponible?username=` → `{ disponible: boolean }`. `POST /api/auth/iniciar-sesion` con body `{ entrada, password }` → `{ access_token, refresh_token }` en éxito, `{ error }` en fallo. Ambos públicos (sin `requireUser`/`requireAdmin` — no hay sesión todavía). La Tarea 3 los consume.

- [ ] **Step 1: Crear `api/auth/username-disponible.js`**

```js
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
    const username = String(req.query.username ?? '').trim().toLowerCase();
    if (!USERNAME_PATTERN.test(username)) return res.status(200).json({ disponible: false });

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.from('perfiles').select('id').eq('username', username).maybeSingle();
    if (error) throw error;
    return res.status(200).json({ disponible: !data });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
```

- [ ] **Step 2: Crear `api/auth/iniciar-sesion.js`**

```js
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

const CONTIENE_ARROBA = /@/;
const MENSAJE_GENERICO = 'Correo/usuario o contraseña incorrectos.';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
    const { entrada, password } = req.body ?? {};
    if (!entrada?.trim() || !password) return res.status(400).json({ error: 'Completa usuario/correo y contraseña' });

    const supabaseAdmin = getSupabaseAdmin();
    let correo = entrada.trim();
    if (!CONTIENE_ARROBA.test(correo)) {
      const username = correo.toLowerCase();
      const { data: perfil } = await supabaseAdmin.from('perfiles').select('id').eq('username', username).maybeSingle();
      if (!perfil) return res.status(400).json({ error: MENSAJE_GENERICO });
      const { data: cuenta, error: errorCuenta } = await supabaseAdmin.auth.admin.getUserById(perfil.id);
      if (errorCuenta || !cuenta?.user?.email) return res.status(400).json({ error: MENSAJE_GENERICO });
      correo = cuenta.user.email;
    }

    const respuesta = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: process.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: correo, password }),
    });
    const datos = await respuesta.json();
    if (!respuesta.ok) return res.status(400).json({ error: MENSAJE_GENERICO });

    return res.status(200).json({ access_token: datos.access_token, refresh_token: datos.refresh_token });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
```

- [ ] **Step 3: Verificar sintaxis**

Run: `node --check api/auth/username-disponible.js && node --check api/auth/iniciar-sesion.js`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add api/auth/username-disponible.js api/auth/iniciar-sesion.js
git commit -m "Agrega endpoints de auth: username-disponible e iniciar-sesion"
```

---

### Task 3: `authService.js` — usar los endpoints nuevos

**Files:**
- Modify: `src/modules/auth/services/authService.js`

**Interfaces:**
- Consumes: `POST /api/auth/iniciar-sesion`, `GET /api/auth/username-disponible` (Tarea 2).
- Produces: `registrar({email, password, nombreCompleto, username})`, `usernameDisponible(username): Promise<boolean>`, `iniciarSesion({entrada, password})`. Las Tareas 4 y 5 consumen estas tres.

- [ ] **Step 1: Reemplazar el archivo completo**

Localizar (el archivo completo actual):

```js
import { supabase } from '@/lib/supabase';

export async function registrar({ email, password, nombreCompleto }) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre_completo: nombreCompleto } },
  });
  if (error) throw error;
}

export async function verificarCodigo({ email, codigo }) {
  const { error } = await supabase.auth.verifyOtp({ email, token: codigo, type: 'signup' });
  if (error) throw error;
}

export async function iniciarSesion({ email, password }) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export function resolverCorreo(entrada) {
  const limpio = entrada.trim();
  return limpio.toLowerCase() === 'admin' ? import.meta.env.VITE_ADMIN_ALIAS_EMAIL : limpio;
}

const MENSAJES_ERROR_AUTH = {
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'Debes confirmar tu correo antes de iniciar sesión.',
  'User already registered': 'Ya existe una cuenta con ese correo.',
};

export function traducirErrorAuth(mensaje) {
  return MENSAJES_ERROR_AUTH[mensaje] ?? mensaje;
}

export async function recuperarPassword({ email }) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}
```

Reemplazar por:

```js
import { supabase } from '@/lib/supabase';

export async function registrar({ email, password, nombreCompleto, username }) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre_completo: nombreCompleto, username } },
  });
  if (error) throw error;
}

export async function verificarCodigo({ email, codigo }) {
  const { error } = await supabase.auth.verifyOtp({ email, token: codigo, type: 'signup' });
  if (error) throw error;
}

export async function usernameDisponible(username) {
  const respuesta = await fetch(`/api/auth/username-disponible?${new URLSearchParams({ username })}`);
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error ?? 'Error inesperado');
  return datos.disponible;
}

export async function iniciarSesion({ entrada, password }) {
  const respuesta = await fetch('/api/auth/iniciar-sesion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entrada, password }),
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error ?? 'Error inesperado');
  const { error } = await supabase.auth.setSession({ access_token: datos.access_token, refresh_token: datos.refresh_token });
  if (error) throw error;
}

const MENSAJES_ERROR_AUTH = {
  'Invalid login credentials': 'Correo o contraseña incorrectos.',
  'Email not confirmed': 'Debes confirmar tu correo antes de iniciar sesión.',
  'User already registered': 'Ya existe una cuenta con ese correo.',
};

export function traducirErrorAuth(mensaje) {
  return MENSAJES_ERROR_AUTH[mensaje] ?? mensaje;
}

export async function recuperarPassword({ email }) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}
```

(Nota: `resolverCorreo` se elimina — ya no hace falta, "admin" ahora es un username como cualquier otro, resuelto del lado del servidor.)

- [ ] **Step 2: Compilar y correr toda la suite**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build && npm test`
Expected: build sin errores; todos los tests existentes pasan (nada más depende todavía de `resolverCorreo` porque las Tareas 4-5 son las que actualizan a sus llamadores).

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/services/authService.js
git commit -m "authService: login/registro usan los endpoints de username, se elimina resolverCorreo"
```

---

### Task 4: `Registro.vue` — campo de username

**Files:**
- Modify: `src/modules/auth/views/Registro.vue`

**Interfaces:**
- Consumes: `registrar({email, password, nombreCompleto, username})`, `usernameDisponible(username)` (Tarea 3).

- [ ] **Step 1: Reemplazar el archivo completo**

Localizar (el archivo completo actual):

```vue
<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { registrar } from '../services/authService';

const nombreCompleto = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const cargando = ref(false);
const router = useRouter();

async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    await registrar({ email: email.value, password: password.value, nombreCompleto: nombreCompleto.value });
    router.push({ name: 'verificar-codigo', query: { email: email.value } });
  } catch (e) {
    error.value = e.message;
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-quiniela-grisClaro px-4 py-8">
    <form @submit.prevent="onSubmit" class="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-md sm:p-8">
      <img src="@assets/logo.png" alt="Quinielas JR" class="h-16 w-16 mx-auto rounded-full mb-2" />
      <h1 class="text-2xl font-bold text-quiniela-verdeOscuro text-center">Crear cuenta</h1>
      <label class="form-label">Nombre completo<input v-model="nombreCompleto" type="text" autocomplete="name" placeholder="Tu nombre" required class="form-control min-h-11" /></label>
      <label class="form-label">Correo<input v-model="email" type="email" autocomplete="email" placeholder="correo@ejemplo.com" required class="form-control min-h-11" /></label>
      <label class="form-label">Contraseña<input v-model="password" type="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres" required minlength="6" class="form-control min-h-11" /></label>
      <p v-if="error" role="alert" class="rounded-lg bg-red-50 p-2 text-quiniela-error text-sm">{{ error }}</p>
      <button type="submit" :disabled="cargando"
        class="min-h-11 w-full rounded-xl bg-quiniela-dorado py-2 font-semibold text-quiniela-grisTexto hover:bg-quiniela-doradoOscuro">
        {{ cargando ? 'Creando...' : 'Registrarme' }}
      </button>
      <p class="text-center text-sm text-gray-600">¿Ya tienes cuenta? <router-link :to="{ name: 'login' }" class="font-semibold text-quiniela-verde">Inicia sesión</router-link></p>
    </form>
  </div>
</template>
```

Reemplazar por:

```vue
<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { registrar, usernameDisponible } from '../services/authService';

const nombreCompleto = ref('');
const email = ref('');
const username = ref('');
const password = ref('');
const error = ref('');
const cargando = ref(false);
const router = useRouter();

async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    const usernameNormalizado = username.value.trim().toLowerCase();
    if (!(await usernameDisponible(usernameNormalizado))) {
      error.value = 'Ese nombre de usuario ya está en uso.';
      return;
    }
    await registrar({ email: email.value, password: password.value, nombreCompleto: nombreCompleto.value, username: usernameNormalizado });
    router.push({ name: 'verificar-codigo', query: { email: email.value } });
  } catch (e) {
    error.value = e.message;
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-quiniela-grisClaro px-4 py-8">
    <form @submit.prevent="onSubmit" class="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-md sm:p-8">
      <img src="@assets/logo.png" alt="Quinielas JR" class="h-16 w-16 mx-auto rounded-full mb-2" />
      <h1 class="text-2xl font-bold text-quiniela-verdeOscuro text-center">Crear cuenta</h1>
      <label class="form-label">Nombre completo<input v-model="nombreCompleto" type="text" autocomplete="name" placeholder="Tu nombre" required class="form-control min-h-11" /></label>
      <label class="form-label">Correo<input v-model="email" type="email" autocomplete="email" placeholder="correo@ejemplo.com" required class="form-control min-h-11" /></label>
      <label class="form-label">Nombre de usuario<input v-model="username" type="text" autocomplete="username" placeholder="letras, números y _ (3-20)" required minlength="3" maxlength="20" pattern="[a-z0-9_]{3,20}" class="form-control min-h-11" @input="username = username.toLowerCase()" /></label>
      <label class="form-label">Contraseña<input v-model="password" type="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres" required minlength="6" class="form-control min-h-11" /></label>
      <p v-if="error" role="alert" class="rounded-lg bg-red-50 p-2 text-quiniela-error text-sm">{{ error }}</p>
      <button type="submit" :disabled="cargando"
        class="min-h-11 w-full rounded-xl bg-quiniela-dorado py-2 font-semibold text-quiniela-grisTexto hover:bg-quiniela-doradoOscuro">
        {{ cargando ? 'Creando...' : 'Registrarme' }}
      </button>
      <p class="text-center text-sm text-gray-600">¿Ya tienes cuenta? <router-link :to="{ name: 'login' }" class="font-semibold text-quiniela-verde">Inicia sesión</router-link></p>
    </form>
  </div>
</template>
```

- [ ] **Step 2: Compilar**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build`
Expected: build sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/views/Registro.vue
git commit -m "Registro pide nombre de usuario y valida disponibilidad antes de enviar"
```

---

### Task 5: `LoginModal.vue` y `Login.vue` — login con username o correo

**Files:**
- Modify: `src/components/LoginModal.vue`
- Modify: `src/modules/auth/views/Login.vue`

**Interfaces:**
- Consumes: `iniciarSesion({entrada, password})` (Tarea 3, ya no acepta `email`).

- [ ] **Step 1: `LoginModal.vue` — imports y estado**

Localizar:

```js
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useLoginModalStore } from '@/store/loginModal';
import { iniciarSesion, resolverCorreo, traducirErrorAuth } from '@/modules/auth/services/authService';

const loginModalStore = useLoginModalStore();
const route = useRoute();
const email = ref('');
const password = ref('');
```

Reemplazar por:

```js
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useLoginModalStore } from '@/store/loginModal';
import { iniciarSesion, traducirErrorAuth } from '@/modules/auth/services/authService';

const loginModalStore = useLoginModalStore();
const route = useRoute();
const entrada = ref('');
const password = ref('');
```

(Nota: la variable `emailInput` y su `ref="emailInput"` en el template **no cambian de nombre** — sigue apuntando al mismo input, solo que ahora ese input usa `v-model="entrada"`.)

- [ ] **Step 2: `LoginModal.vue` — reinicio del campo al abrir**

Localizar:

```js
  if (abierto) {
    focoAnterior = document.activeElement;
    overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    email.value = '';
    password.value = '';
```

Reemplazar por:

```js
  if (abierto) {
    focoAnterior = document.activeElement;
    overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    entrada.value = '';
    password.value = '';
```

- [ ] **Step 3: `LoginModal.vue` — `onSubmit`**

Localizar:

```js
async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    const correoFinal = resolverCorreo(email.value);
    await iniciarSesion({ email: correoFinal, password: password.value });
    password.value = '';
    loginModalStore.cerrar();
  } catch (e) {
    error.value = traducirErrorAuth(e.message);
  } finally {
    cargando.value = false;
  }
}
```

Reemplazar por:

```js
async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    await iniciarSesion({ entrada: entrada.value, password: password.value });
    password.value = '';
    loginModalStore.cerrar();
  } catch (e) {
    error.value = traducirErrorAuth(e.message);
  } finally {
    cargando.value = false;
  }
}
```

- [ ] **Step 4: `LoginModal.vue` — template**

Localizar:

```html
      <label class="form-label">Correo<input ref="emailInput" v-model="email" type="text" inputmode="email" autocomplete="username" placeholder="correo@ejemplo.com o admin" required class="form-control min-h-11" /></label>
```

Reemplazar por:

```html
      <label class="form-label">Correo o usuario<input ref="emailInput" v-model="entrada" type="text" inputmode="email" autocomplete="username" placeholder="correo@ejemplo.com o tu usuario" required class="form-control min-h-11" /></label>
```

- [ ] **Step 5: `Login.vue` — archivo completo**

Localizar (el archivo completo actual):

```vue
<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { iniciarSesion, resolverCorreo, traducirErrorAuth } from '../services/authService';

const email = ref('');
const password = ref('');
const error = ref('');
const cargando = ref(false);
const router = useRouter();

async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    const correoFinal = resolverCorreo(email.value);
    await iniciarSesion({ email: correoFinal, password: password.value });
    router.push({ name: 'mis-quinielas' });
  } catch (e) {
    error.value = traducirErrorAuth(e.message);
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-quiniela-grisClaro px-4 py-8">
    <form @submit.prevent="onSubmit" class="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-md sm:p-8">
      <img src="@assets/logo.png" alt="Quinielas JR" class="h-16 w-16 mx-auto rounded-full mb-2" />
      <h1 class="text-2xl font-bold text-quiniela-verdeOscuro text-center">Quinielas JR</h1>
      <label class="form-label">Correo<input v-model="email" type="text" inputmode="email" autocomplete="username" placeholder="correo@ejemplo.com o admin" required class="form-control min-h-11" /></label>
      <label class="form-label">Contraseña<input v-model="password" type="password" autocomplete="current-password" placeholder="Tu contraseña" required class="form-control min-h-11" /></label>
      <p v-if="error" role="alert" class="rounded-lg bg-red-50 p-2 text-quiniela-error text-sm">{{ error }}</p>
      <button type="submit" :disabled="cargando"
        class="min-h-11 w-full rounded-xl bg-quiniela-dorado py-2 font-semibold text-quiniela-grisTexto hover:bg-quiniela-doradoOscuro">
        {{ cargando ? 'Entrando...' : 'Iniciar sesión' }}
      </button>
      <div class="text-center text-sm space-x-2">
        <router-link :to="{ name: 'registro' }" class="text-quiniela-verde">Crear cuenta</router-link>
        <router-link :to="{ name: 'recuperar-password' }" class="text-quiniela-verde">Olvidé mi contraseña</router-link>
      </div>
    </form>
  </div>
</template>
```

Reemplazar por:

```vue
<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { iniciarSesion, traducirErrorAuth } from '../services/authService';

const entrada = ref('');
const password = ref('');
const error = ref('');
const cargando = ref(false);
const router = useRouter();

async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    await iniciarSesion({ entrada: entrada.value, password: password.value });
    router.push({ name: 'mis-quinielas' });
  } catch (e) {
    error.value = traducirErrorAuth(e.message);
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-quiniela-grisClaro px-4 py-8">
    <form @submit.prevent="onSubmit" class="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-md sm:p-8">
      <img src="@assets/logo.png" alt="Quinielas JR" class="h-16 w-16 mx-auto rounded-full mb-2" />
      <h1 class="text-2xl font-bold text-quiniela-verdeOscuro text-center">Quinielas JR</h1>
      <label class="form-label">Correo o usuario<input v-model="entrada" type="text" inputmode="email" autocomplete="username" placeholder="correo@ejemplo.com o tu usuario" required class="form-control min-h-11" /></label>
      <label class="form-label">Contraseña<input v-model="password" type="password" autocomplete="current-password" placeholder="Tu contraseña" required class="form-control min-h-11" /></label>
      <p v-if="error" role="alert" class="rounded-lg bg-red-50 p-2 text-quiniela-error text-sm">{{ error }}</p>
      <button type="submit" :disabled="cargando"
        class="min-h-11 w-full rounded-xl bg-quiniela-dorado py-2 font-semibold text-quiniela-grisTexto hover:bg-quiniela-doradoOscuro">
        {{ cargando ? 'Entrando...' : 'Iniciar sesión' }}
      </button>
      <div class="text-center text-sm space-x-2">
        <router-link :to="{ name: 'registro' }" class="text-quiniela-verde">Crear cuenta</router-link>
        <router-link :to="{ name: 'recuperar-password' }" class="text-quiniela-verde">Olvidé mi contraseña</router-link>
      </div>
    </form>
  </div>
</template>
```

- [ ] **Step 6: Compilar y correr toda la suite**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build && npm test`
Expected: build sin errores; todos los tests existentes pasan.

- [ ] **Step 7: Commit**

```bash
git add src/components/LoginModal.vue src/modules/auth/views/Login.vue
git commit -m "Login acepta username o correo en LoginModal y Login.vue"
```

---

### Task 6: Notificación al admin al registrar una quiniela (web)

**Files:**
- Modify: `api/notificaciones/registro.js`

**Interfaces:** Ninguna nueva — usa `getSupabaseAdmin()` y `enviarCorreo()` ya importados en el archivo.

- [ ] **Step 1: Reemplazar el archivo completo**

Localizar (el archivo completo actual):

```js
import { requireUser, ErrorHttp } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { enviarCorreo } from '../_lib/email.js';

export default async function handler(req, res) {
  try {
    const { user, perfil } = await requireUser(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { quiniela_id } = req.body;
    if (!quiniela_id) return res.status(400).json({ error: 'Falta quiniela_id' });

    const supabaseAdmin = getSupabaseAdmin();
    const { data: quiniela } = await supabaseAdmin
      .from('quinielas')
      .select('usuario_id, alias, metodo_pago, monto_pagado, estatus_pago, jornada_id, jornadas(nombre)')
      .eq('id', quiniela_id)
      .single();

    if (!quiniela || (quiniela.usuario_id !== user.id && perfil?.rol !== 'admin')) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const avisoEfectivo = quiniela.metodo_pago === 'efectivo'
      ? '<p><b>Importante:</b> tu quiniela queda pendiente hasta confirmar tu pago en efectivo. Si no se paga, no estarás participando en el sorteo.</p>'
      : '';

    await enviarCorreo({
      to: user.email,
      subject: `Quiniela registrada: ${quiniela.jornadas?.nombre ?? ''}`,
      heading: '¡Tu quiniela quedó registrada!',
      bodyHtml: `<p>Jornada: <b>${quiniela.jornadas?.nombre ?? ''}</b></p>
        <p>Entrada: ${quiniela.alias ?? 'Entrada'}</p>
        <p>Método de pago: ${quiniela.metodo_pago}</p>
        <p>Monto: $${Number(quiniela.monto_pagado ?? 0).toFixed(2)}</p>
        <p>Estatus: ${quiniela.estatus_pago}</p>
        ${avisoEfectivo}`,
    });

    return res.status(200).json({ status: 'ok' });
  } catch (e) {
    const status = e instanceof ErrorHttp ? e.status : 500;
    return res.status(status).json({ error: e.message });
  }
}
```

Reemplazar por:

```js
import { requireUser, ErrorHttp } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { enviarCorreo } from '../_lib/email.js';

async function notificarAdmin(supabaseAdmin, { alias, metodoPago, estatusPago, jornadaNombre }) {
  const { data: admins } = await supabaseAdmin.from('perfiles').select('id').eq('rol', 'admin');
  for (const admin of admins ?? []) {
    const { data: cuenta } = await supabaseAdmin.auth.admin.getUserById(admin.id);
    const correoAdmin = cuenta?.user?.email;
    if (!correoAdmin) continue;
    await enviarCorreo({
      to: correoAdmin,
      subject: `Nueva quiniela registrada: ${jornadaNombre}`,
      heading: '📋 Nueva quiniela registrada',
      bodyHtml: `<p>Alguien acaba de registrar una quiniela.</p>
        <p>Jornada: <b>${jornadaNombre}</b></p>
        <p>Entrada: ${alias ?? 'Entrada'}</p>
        <p>Método de pago: ${metodoPago}</p>
        <p>Estatus: ${estatusPago}</p>`,
    });
  }
}

export default async function handler(req, res) {
  try {
    const { user, perfil } = await requireUser(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { quiniela_id } = req.body;
    if (!quiniela_id) return res.status(400).json({ error: 'Falta quiniela_id' });

    const supabaseAdmin = getSupabaseAdmin();
    const { data: quiniela } = await supabaseAdmin
      .from('quinielas')
      .select('usuario_id, alias, metodo_pago, monto_pagado, estatus_pago, jornada_id, jornadas(nombre)')
      .eq('id', quiniela_id)
      .single();

    if (!quiniela || (quiniela.usuario_id !== user.id && perfil?.rol !== 'admin')) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const avisoEfectivo = quiniela.metodo_pago === 'efectivo'
      ? '<p><b>Importante:</b> tu quiniela queda pendiente hasta confirmar tu pago en efectivo. Si no se paga, no estarás participando en el sorteo.</p>'
      : '';

    await enviarCorreo({
      to: user.email,
      subject: `Quiniela registrada: ${quiniela.jornadas?.nombre ?? ''}`,
      heading: '¡Tu quiniela quedó registrada!',
      bodyHtml: `<p>Jornada: <b>${quiniela.jornadas?.nombre ?? ''}</b></p>
        <p>Entrada: ${quiniela.alias ?? 'Entrada'}</p>
        <p>Método de pago: ${quiniela.metodo_pago}</p>
        <p>Monto: $${Number(quiniela.monto_pagado ?? 0).toFixed(2)}</p>
        <p>Estatus: ${quiniela.estatus_pago}</p>
        ${avisoEfectivo}`,
    });

    try {
      await notificarAdmin(supabaseAdmin, {
        alias: quiniela.alias,
        metodoPago: quiniela.metodo_pago,
        estatusPago: quiniela.estatus_pago,
        jornadaNombre: quiniela.jornadas?.nombre ?? '',
      });
    } catch (avisoError) {
      console.error('notificaciones/registro: falló el aviso al admin', avisoError.message);
    }

    return res.status(200).json({ status: 'ok' });
  } catch (e) {
    const status = e instanceof ErrorHttp ? e.status : 500;
    return res.status(status).json({ error: e.message });
  }
}
```

- [ ] **Step 2: Verificar sintaxis**

Run: `node --check api/notificaciones/registro.js`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add api/notificaciones/registro.js
git commit -m "Notifica al admin por correo cuando alguien registra una quiniela desde la web"
```

---

### Task 7: `theSportsDb.js` — búsqueda por ronda

**Files:**
- Modify: `api/_lib/football/theSportsDb.js`
- Modify: `tests/unit/thesportsdb-provider.test.js`

**Interfaces:**
- Produces: `getFixtures({league, from, to, round, season})` (acepta `round`/`season` opcionales); `seasonRangeForDate(date): string` (ej. `"2026-09-12"` → `"2026-2027"`). La Tarea 8 consume ambas.

- [ ] **Step 1: Agregar `round`/`season` a `getFixtures` y exportar `seasonRangeForDate`**

Localizar:

```js
export async function getFixtures({ league, from, to }) {
  const payload = await request(`eventsnextleague.php?id=${encodeURIComponent(league)}`);
  return (payload.events ?? [])
    .filter((event) => (!from || event.dateEvent >= from) && (!to || event.dateEvent <= to))
    .map(normalizeFixture);
}
```

Reemplazar por:

```js
export function seasonRangeForDate(date) {
  const parsed = new Date(`${date}T12:00:00Z`);
  const year = parsed.getUTCFullYear();
  const startYear = parsed.getUTCMonth() < 6 ? year - 1 : year;
  return `${startYear}-${startYear + 1}`;
}

export async function getFixtures({ league, from, to, round, season }) {
  if (round) {
    const payload = await request(`eventsround.php?id=${encodeURIComponent(league)}&r=${encodeURIComponent(round)}&s=${encodeURIComponent(season)}`);
    return (payload.events ?? []).map(normalizeFixture);
  }
  const payload = await request(`eventsnextleague.php?id=${encodeURIComponent(league)}`);
  return (payload.events ?? [])
    .filter((event) => (!from || event.dateEvent >= from) && (!to || event.dateEvent <= to))
    .map(normalizeFixture);
}
```

- [ ] **Step 2: Agregar el test unitario de `seasonRangeForDate`**

Localizar (en `tests/unit/thesportsdb-provider.test.js`, el `import` inicial):

```js
import { describe, expect, it } from 'vitest';
import { normalizeFixture, resultFromEvent } from '../../api/_lib/football/theSportsDb.js';
```

Reemplazar por:

```js
import { describe, expect, it } from 'vitest';
import { normalizeFixture, resultFromEvent, seasonRangeForDate } from '../../api/_lib/football/theSportsDb.js';
```

Localizar (el final del `describe` existente, justo antes del `});` que lo cierra):

```js
  it.each([['FT', '2', '1', 'L'], ['Match Finished', '1', '1', 'E'], ['AET', '0', '1', 'V'], ['NS', null, null, null]])('mapea %s correctamente', (status, home, away, expected) => {
    expect(resultFromEvent(event(status, home, away))).toBe(expected);
  });
});
```

Reemplazar por:

```js
  it.each([['FT', '2', '1', 'L'], ['Match Finished', '1', '1', 'E'], ['AET', '0', '1', 'V'], ['NS', null, null, null]])('mapea %s correctamente', (status, home, away, expected) => {
    expect(resultFromEvent(event(status, home, away))).toBe(expected);
  });

  it('calcula el rango de temporada partido por año', () => {
    expect(seasonRangeForDate('2026-09-12')).toBe('2026-2027');
    expect(seasonRangeForDate('2026-03-01')).toBe('2025-2026');
  });
});
```

- [ ] **Step 3: Agregar el re-export en `provider.js`**

Localizar (`api/_lib/football/provider.js`, archivo completo actual):

```js
import { getFixtures, getFinalResults } from './theSportsDb.js';

export const FOOTBALL_PROVIDER = 'thesportsdb';

export function seasonForDate(date, mode = 'calendar') {
  const parsed = new Date(`${date}T12:00:00Z`);
  const year = parsed.getUTCFullYear();
  return mode === 'european' && parsed.getUTCMonth() < 6 ? year - 1 : year;
}

export const findFixtures = getFixtures;
export const findFinalResults = getFinalResults;
```

Reemplazar por:

```js
import { getFixtures, getFinalResults, seasonRangeForDate } from './theSportsDb.js';

export const FOOTBALL_PROVIDER = 'thesportsdb';

export function seasonForDate(date, mode = 'calendar') {
  const parsed = new Date(`${date}T12:00:00Z`);
  const year = parsed.getUTCFullYear();
  return mode === 'european' && parsed.getUTCMonth() < 6 ? year - 1 : year;
}

export const findFixtures = getFixtures;
export const findFinalResults = getFinalResults;
export { seasonRangeForDate };
```

- [ ] **Step 4: Compilar y correr toda la suite**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build && npm test`
Expected: build sin errores; todos los tests existentes pasan más el nuevo de `seasonRangeForDate`.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/football/theSportsDb.js api/_lib/football/provider.js tests/unit/thesportsdb-provider.test.js
git commit -m "getFixtures soporta búsqueda por ronda vía eventsround.php, agrega seasonRangeForDate"
```

---

### Task 8: `ligas.js` y `api/fixtures.js` — exponer la búsqueda por ronda

**Files:**
- Modify: `api/_lib/ligas.js`
- Modify: `api/fixtures.js`

**Interfaces:**
- Consumes: `findFixtures({league, round, season})`, `seasonRangeForDate` (Tarea 7).
- Produces: `GET /api/fixtures?leagues=4350&ronda=8` (nuevo modo). La Tarea 9 lo consume.

- [ ] **Step 1: `ligas.js` — marcar Liga MX como compatible con búsqueda por ronda**

Localizar:

```js
export const LIGAS = {
  '4350': { name: 'Liga MX', seasonMode: 'calendar' },
```

Reemplazar por:

```js
export const LIGAS = {
  '4350': { name: 'Liga MX', seasonMode: 'calendar', soportaBusquedaPorRonda: true },
```

- [ ] **Step 2: `api/fixtures.js` — archivo completo**

Localizar (el archivo completo actual):

```js
import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { findFixtures, seasonForDate } from './_lib/football/provider.js';
import { LIGAS } from './_lib/ligas.js';
import { guardarEnCache } from './_lib/football/equiposCache.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

    const leagues = [...new Set(String(req.query.leagues ?? '').split(',').filter(Boolean))];
    const { from, to } = req.query;
    if (!leagues.length) return res.status(400).json({ error: 'Debes indicar al menos una liga' });
    if (!DATE_PATTERN.test(from ?? '') || !DATE_PATTERN.test(to ?? '') || from > to) {
      return res.status(400).json({ error: 'El rango de fechas no es válido' });
    }
    if (leagues.some((id) => !LIGAS[id])) return res.status(400).json({ error: 'La liga solicitada no está permitida' });

    const results = [];
    for (const league of leagues) {
      const fixtures = await findFixtures({
        league,
        season: seasonForDate(from, LIGAS[league].seasonMode),
        from,
        to,
        timezone: 'America/Mexico_City',
      });
      results.push(...fixtures.map((fixture) => ({
        ...fixture,
        league: { ...fixture.league, name: LIGAS[league].name },
      })));
    }
    results.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
    await guardarEnCache(results.flatMap((f) => [f.teams.home, f.teams.away]));
    return res.status(200).json({ fixtures: results });
  } catch (error) {
    const status = error instanceof ErrorHttp ? error.status : 500;
    return res.status(status).json({ error: error.message });
  }
}
```

Reemplazar por:

```js
import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { findFixtures, seasonForDate, seasonRangeForDate } from './_lib/football/provider.js';
import { LIGAS } from './_lib/ligas.js';
import { guardarEnCache } from './_lib/football/equiposCache.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

    const leagues = [...new Set(String(req.query.leagues ?? '').split(',').filter(Boolean))];
    if (!leagues.length) return res.status(400).json({ error: 'Debes indicar al menos una liga' });
    if (leagues.some((id) => !LIGAS[id])) return res.status(400).json({ error: 'La liga solicitada no está permitida' });

    const { ronda } = req.query;
    if (ronda) {
      if (leagues.length !== 1) return res.status(400).json({ error: 'La búsqueda por ronda solo admite una liga a la vez' });
      const [league] = leagues;
      if (!LIGAS[league].soportaBusquedaPorRonda) return res.status(400).json({ error: 'Esa liga todavía no soporta búsqueda por ronda' });

      const hoy = new Date().toISOString().slice(0, 10);
      const fixtures = await findFixtures({ league, round: ronda, season: seasonRangeForDate(hoy) });
      const results = fixtures.map((fixture) => ({ ...fixture, league: { ...fixture.league, name: LIGAS[league].name } }));
      results.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
      await guardarEnCache(results.flatMap((f) => [f.teams.home, f.teams.away]));
      return res.status(200).json({ fixtures: results });
    }

    const { from, to } = req.query;
    if (!DATE_PATTERN.test(from ?? '') || !DATE_PATTERN.test(to ?? '') || from > to) {
      return res.status(400).json({ error: 'El rango de fechas no es válido' });
    }

    const results = [];
    for (const league of leagues) {
      const fixtures = await findFixtures({
        league,
        season: seasonForDate(from, LIGAS[league].seasonMode),
        from,
        to,
        timezone: 'America/Mexico_City',
      });
      results.push(...fixtures.map((fixture) => ({
        ...fixture,
        league: { ...fixture.league, name: LIGAS[league].name },
      })));
    }
    results.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
    await guardarEnCache(results.flatMap((f) => [f.teams.home, f.teams.away]));
    return res.status(200).json({ fixtures: results });
  } catch (error) {
    const status = error instanceof ErrorHttp ? error.status : 500;
    return res.status(status).json({ error: error.message });
  }
}
```

- [ ] **Step 3: Verificar sintaxis**

Run: `node --check api/fixtures.js && node --check api/_lib/ligas.js`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add api/_lib/ligas.js api/fixtures.js
git commit -m "api/fixtures.js soporta búsqueda por ronda para ligas marcadas como compatibles"
```

---

### Task 9: `GestionJornadas.vue` — UI de búsqueda por ronda

**Files:**
- Modify: `src/modules/admin/services/adminService.js`
- Modify: `src/modules/admin/views/GestionJornadas.vue`

**Interfaces:**
- Consumes: `GET /api/fixtures?leagues=&ronda=` (Tarea 8).

- [ ] **Step 1: `adminService.js` — `buscarFixtures` acepta `ronda`**

Localizar:

```js
export async function buscarFixtures({ leagues, from, to }) {
  const query = new URLSearchParams({ leagues: leagues.join(','), from, to });
  return llamarApi(`fixtures?${query}`);
}
```

Reemplazar por:

```js
export async function buscarFixtures({ leagues, from, to, ronda }) {
  const params = { leagues: leagues.join(',') };
  if (ronda) params.ronda = String(ronda);
  else Object.assign(params, { from, to });
  const query = new URLSearchParams(params);
  return llamarApi(`fixtures?${query}`);
}
```

- [ ] **Step 2: `GestionJornadas.vue` — estado y función de búsqueda por ronda**

Localizar:

```js
const desde = ref('');
const hasta = ref('');
const fixtures = ref([]);
```

Reemplazar por:

```js
const desde = ref('');
const hasta = ref('');
const ronda = ref(null);
const fixtures = ref([]);
```

Localizar:

```js
async function buscar() {
  ligasSeleccionadas.value = [ligaPrincipal.id];
  seleccionados.value = [];
  await buscarLigas([ligaPrincipal.id], true);
}
```

Reemplazar por:

```js
async function buscar() {
  ligasSeleccionadas.value = [ligaPrincipal.id];
  seleccionados.value = [];
  await buscarLigas([ligaPrincipal.id], true);
}

async function buscarPorRonda() {
  ligasSeleccionadas.value = [ligaPrincipal.id];
  seleccionados.value = [];
  error.value = '';
  mensaje.value = '';
  cargando.value = true;
  try {
    const { fixtures: encontrados } = await buscarFixtures({ leagues: [ligaPrincipal.id], ronda: ronda.value });
    fixtures.value = encontrados;
  } catch (e) {
    error.value = e.message;
  } finally {
    cargando.value = false;
  }
}
```

- [ ] **Step 3: `GestionJornadas.vue` — template, campo de búsqueda por ronda**

Localizar:

```html
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="text-sm font-semibold text-gray-700">Del<input v-model="desde" type="date" :min="hoy" class="mt-1 w-full rounded-xl border-gray-300" /></label>
        <label class="text-sm font-semibold text-gray-700">Al<input v-model="hasta" type="date" :min="hoy" class="mt-1 w-full rounded-xl border-gray-300" /></label>
      </div>
      <button @click="buscar" :disabled="!desde || !hasta || cargando" class="mt-4 w-full rounded-xl bg-quiniela-verde px-5 py-3 font-semibold text-white disabled:opacity-50 sm:w-auto">
        {{ cargando ? 'Buscando…' : 'Buscar partidos' }}
      </button>
    </section>
```

Reemplazar por:

```html
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="text-sm font-semibold text-gray-700">Del<input v-model="desde" type="date" :min="hoy" class="mt-1 w-full rounded-xl border-gray-300" /></label>
        <label class="text-sm font-semibold text-gray-700">Al<input v-model="hasta" type="date" :min="hoy" class="mt-1 w-full rounded-xl border-gray-300" /></label>
      </div>
      <button @click="buscar" :disabled="!desde || !hasta || cargando" class="mt-4 w-full rounded-xl bg-quiniela-verde px-5 py-3 font-semibold text-white disabled:opacity-50 sm:w-auto">
        {{ cargando ? 'Buscando…' : 'Buscar partidos' }}
      </button>
      <div class="mt-5 border-t border-green-100 pt-5">
        <label class="text-sm font-semibold text-gray-700">O buscar por jornada/ronda (solo Liga MX)<input v-model.number="ronda" type="number" min="1" class="mt-1 w-full max-w-[160px] rounded-xl border-gray-300" placeholder="Ej. 8" /></label>
        <button @click="buscarPorRonda" :disabled="!ronda || cargando" class="mt-3 w-full rounded-xl border border-quiniela-verde bg-white px-5 py-3 font-semibold text-quiniela-verde disabled:opacity-50 sm:w-auto">
          {{ cargando ? 'Buscando…' : 'Buscar por ronda' }}
        </button>
      </div>
    </section>
```

- [ ] **Step 4: Compilar y correr toda la suite**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build && npm test`
Expected: build sin errores; todos los tests existentes pasan.

- [ ] **Step 5: Commit**

```bash
git add src/modules/admin/services/adminService.js src/modules/admin/views/GestionJornadas.vue
git commit -m "GestionJornadas agrega búsqueda de partidos por jornada/ronda para Liga MX"
```

---

## Cierre del plan

Al terminar la Tarea 9, el controller aplica (o pide al humano aplicar) la migración `0022_username.sql`, y verifica en vivo el checklist "Pruebas a cubrir" del spec (`docs/superpowers/specs/2026-09-10-username-notificacion-rondas-design.md`): registro con username nuevo y duplicado, login con username/correo/"admin", que el admin reciba el correo de una quiniela web pero no de una presencial, y la búsqueda por ronda en `GestionJornadas.vue` trayendo partidos reales de Liga MX. Push a `main` después, siguiendo el mismo flujo del resto de esta sesión.
