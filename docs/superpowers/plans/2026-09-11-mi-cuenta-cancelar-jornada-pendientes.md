# Mi cuenta, cancelar jornada completa, pendientes elegidos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cualquier usuario logueado puede cambiar su nombre, correo (con verificación) y contraseña desde un apartado "Mi cuenta"; el admin puede cancelar una jornada completa desde "Ver jornadas" (avisando por correo a quien ya se haya registrado); y se resuelven 4 pendientes de bajo riesgo del backlog.

**Architecture:** "Mi cuenta" usa directamente la API nativa de Supabase Auth (`updateUser`) — sin endpoint nuevo, el cambio de correo dispara su propio flujo de confirmación por correo. Cancelar una jornada agrega `'cancelada'` al catálogo de estatus y un endpoint nuevo (`api/cancelar-jornada.js`) que sigue el mismo patrón best-effort ya usado en `cerrar-jornada.js`/`notificaciones/registro.js`: la acción principal (cambiar el estatus) es garantizada, los correos son best-effort. Los 4 pendientes son cambios pequeños y aislados en archivos ya tocados en el plan anterior.

**Tech Stack:** Vue 3 (`<script setup>`), Vercel serverless functions (Node, ESM), Supabase (Postgres + RLS + Auth).

## Global Constraints

- Cancelar una jornada completa se permite mientras `estatus` no sea `'finalizada'` ni ya `'cancelada'` — no es reversible (a diferencia de cancelar un partido individual).
- Cancelar una jornada NO llama `calcular_puntos()` ni la lógica de premios/cupón — solo cambia el estatus y avisa por correo, best-effort.
- El apartado "Mi cuenta" es para cualquier usuario logueado, no solo el admin.
- No se automatiza ningún reembolso al cancelar una jornada.
- Este proyecto no tiene infraestructura de pruebas de componentes Vue ni de mocking de Supabase para funciones serverless con I/O real (patrón ya establecido). Las tareas de backend se verifican con `node --check`; las de frontend con `npm run build`.
- Nota de entorno de esta sesión: el `node`/`npm` por defecto en el PATH puede ser una versión vieja (v18) que falla el build de Vite con `crypto.hash is not a function`. Antes de correr `npm run build`/`npm test`, ejecutar en el mismo comando: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build && npm test` (el cambio de versión no persiste entre llamadas de terminal separadas).

---

### Task 1: Migración `0023_cancelar_jornada.sql`

**Files:**
- Create: `supabase/migrations/0023_cancelar_jornada.sql`

**Interfaces:**
- Produces: `'cancelada'` como valor válido de `jornadas.estatus`. Las Tareas 2-4 dependen de que exista.

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/0023_cancelar_jornada.sql
ALTER TABLE jornadas DROP CONSTRAINT jornadas_estatus_check;
ALTER TABLE jornadas ADD CONSTRAINT jornadas_estatus_check
  CHECK (estatus IN ('borrador', 'activa', 'cerrada', 'finalizada', 'cancelada'));
```

- [ ] **Step 2: No se aplica en este paso**

Igual que las migraciones anteriores de esta sesión, este archivo se entrega para que el humano lo aplique en el SQL Editor de Supabase cuando quiera — no se ejecuta como parte de esta tarea.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0023_cancelar_jornada.sql
git commit -m "Agrega 'cancelada' al catálogo de estatus de jornadas"
```

---

### Task 2: `api/cancelar-jornada.js`

**Files:**
- Create: `api/cancelar-jornada.js`

**Interfaces:**
- Consumes: columna `jornadas.estatus` con `'cancelada'` (Tarea 1).
- Produces: `POST /api/cancelar-jornada` con body `{ jornada_id }` → `{ status: 'ok', avisos?: string[] }` en éxito, `{ error }` en fallo (404 si no existe, 409 si ya está finalizada/cancelada). Requiere admin. La Tarea 3 lo consume.

- [ ] **Step 1: Crear el endpoint**

```js
import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { enviarCorreo, escaparHtml } from './_lib/email.js';

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { jornada_id } = req.body ?? {};
    if (!jornada_id) return res.status(400).json({ error: 'Falta jornada_id' });

    const supabaseAdmin = getSupabaseAdmin();
    const { data: jornada, error: errorJornada } = await supabaseAdmin.from('jornadas').select('id, nombre, estatus').eq('id', jornada_id).single();
    if (errorJornada) throw errorJornada;
    if (!jornada) return res.status(404).json({ error: 'La jornada no existe' });
    if (jornada.estatus === 'finalizada') return res.status(409).json({ error: 'No se puede cancelar una jornada ya finalizada' });
    if (jornada.estatus === 'cancelada') return res.status(409).json({ error: 'Esta jornada ya está cancelada' });

    const { data: cancelada, error: errorCancelar } = await supabaseAdmin
      .from('jornadas')
      .update({ estatus: 'cancelada' })
      .eq('id', jornada_id)
      .neq('estatus', 'finalizada')
      .neq('estatus', 'cancelada')
      .select('id')
      .maybeSingle();
    if (errorCancelar) throw errorCancelar;
    if (!cancelada) return res.status(409).json({ error: 'Esta jornada ya no se puede cancelar' });

    const avisos = [];
    async function intentar(etiqueta, fn) {
      try {
        await fn();
      } catch (e) {
        console.error(`cancelar-jornada (${jornada_id}) — falló ${etiqueta}:`, e.message);
        avisos.push(`${etiqueta}: ${e.message}`);
      }
    }

    const { data: quinielas } = await supabaseAdmin.from('quinielas').select('usuario_id, alias, correo_contacto').eq('jornada_id', jornada_id);
    for (const quiniela of quinielas ?? []) {
      let correo = quiniela.correo_contacto;
      if (quiniela.usuario_id) {
        await intentar(`resolver correo de ${quiniela.alias ?? 'una entrada'}`, async () => {
          const { data: cuenta } = await supabaseAdmin.auth.admin.getUserById(quiniela.usuario_id);
          correo = cuenta?.user?.email ?? correo;
        });
      }
      if (!correo) continue;
      await intentar(`avisar a ${quiniela.alias ?? 'una entrada'}`, () => enviarCorreo({
        to: correo,
        subject: `Jornada cancelada: ${jornada.nombre}`,
        heading: '⚠️ Esta jornada fue cancelada',
        bodyHtml: `<p>La jornada <b>${escaparHtml(jornada.nombre)}</b> fue cancelada por el administrador.</p><p>Tu entrada "${escaparHtml(quiniela.alias ?? 'Entrada')}" ya no participa.</p>`,
      }));
    }

    return res.status(200).json({ status: 'ok', avisos: avisos.length ? avisos : undefined });
  } catch (e) {
    const status = e instanceof ErrorHttp ? e.status : 500;
    return res.status(status).json({ error: e.message });
  }
}
```

- [ ] **Step 2: Verificar sintaxis**

Run: `node --check api/cancelar-jornada.js`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add api/cancelar-jornada.js
git commit -m "Agrega endpoint para cancelar una jornada completa, con aviso best-effort a los participantes"
```

---

### Task 3: `adminService.js` y `AdministrarJornadas.vue` — botón "Cancelar jornada"

**Files:**
- Modify: `src/modules/admin/services/adminService.js`
- Modify: `src/modules/admin/views/AdministrarJornadas.vue`

**Interfaces:**
- Consumes: `POST /api/cancelar-jornada` (Tarea 2).

- [ ] **Step 1: `adminService.js` — nueva función**

Localizar (el final del archivo):

```js
export async function editarQuinielaManual(quinielaId, cambios) {
  const { error } = await supabase.from('quinielas').update(cambios).eq('id', quinielaId);
  if (error) throw error;
}
```

Reemplazar por:

```js
export async function editarQuinielaManual(quinielaId, cambios) {
  const { error } = await supabase.from('quinielas').update(cambios).eq('id', quinielaId);
  if (error) throw error;
}

export async function cancelarJornada(jornadaId) {
  return llamarApi('cancelar-jornada', { method: 'POST', body: JSON.stringify({ jornada_id: jornadaId }) });
}
```

- [ ] **Step 2: `AdministrarJornadas.vue` — import y función**

Localizar:

```js
import { actualizarCierreJornada, actualizarPremioJornada, cancelarPartido, listarJornadasAdmin } from '../services/adminService';
```

Reemplazar por:

```js
import { actualizarCierreJornada, actualizarPremioJornada, cancelarJornada, cancelarPartido, listarJornadasAdmin } from '../services/adminService';
```

Localizar:

```js
async function alternarCancelacion(partido) {
```

Insertar justo antes de esa línea (sin tocar `alternarCancelacion`, que sigue igual después):

```js
async function cancelarJornadaCompleta() {
  if (!abierta.value) return;
  const confirmado = await confirmarAccion({
    title: 'Cancelar jornada',
    text: 'Se avisará por correo a quien ya tenga una entrada registrada. Esta acción no se puede deshacer.',
    confirmText: 'Cancelar jornada',
    danger: true,
  });
  if (!confirmado) return;
  guardando.value = true;
  try {
    await cancelarJornada(abierta.value.id);
    abierta.value.estatus = 'cancelada';
    const jornadaEnLista = jornadas.value.find((j) => j.id === abierta.value.id);
    if (jornadaEnLista) jornadaEnLista.estatus = 'cancelada';
    await alertaExito('Jornada cancelada');
  } catch (error) {
    await alertaError(error, 'No se pudo cancelar la jornada');
  } finally {
    guardando.value = false;
  }
}

async function alternarCancelacion(partido) {
```

- [ ] **Step 3: `AdministrarJornadas.vue` — template, botón de cancelar jornada**

Localizar:

```html
        <form @submit.prevent="guardarCierre" class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label class="form-label flex-1">Fecha límite de registro<input v-model="cierreEditado" type="date" :min="hoy" class="form-control mt-1" /></label>
            <button :disabled="guardando || !cierreEditado" class="rounded-xl bg-quiniela-verde px-5 py-3 font-semibold text-white disabled:opacity-50">Guardar fecha</button>
            <button v-if="new Date(abierta.fecha_cierre) > new Date()" type="button" @click="cerrarRegistro" :disabled="guardando" class="rounded-xl border border-red-300 px-5 py-3 font-semibold text-red-700 disabled:opacity-50">Cerrar registro ahora</button>
            <span v-else class="rounded-xl bg-gray-100 px-4 py-3 text-center text-sm font-bold text-gray-600">Registro cerrado</span>
          </div>
          <p class="mt-2 text-xs text-gray-500">Al llegar esta fecha, el sistema bloquea automáticamente nuevas entradas y habilita los pronósticos públicos.</p>
        </form>

        <div class="grid gap-3 sm:grid-cols-2">
```

Reemplazar por:

```html
        <form @submit.prevent="guardarCierre" class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label class="form-label flex-1">Fecha límite de registro<input v-model="cierreEditado" type="date" :min="hoy" class="form-control mt-1" /></label>
            <button :disabled="guardando || !cierreEditado" class="rounded-xl bg-quiniela-verde px-5 py-3 font-semibold text-white disabled:opacity-50">Guardar fecha</button>
            <button v-if="new Date(abierta.fecha_cierre) > new Date()" type="button" @click="cerrarRegistro" :disabled="guardando" class="rounded-xl border border-red-300 px-5 py-3 font-semibold text-red-700 disabled:opacity-50">Cerrar registro ahora</button>
            <span v-else class="rounded-xl bg-gray-100 px-4 py-3 text-center text-sm font-bold text-gray-600">Registro cerrado</span>
          </div>
          <p class="mt-2 text-xs text-gray-500">Al llegar esta fecha, el sistema bloquea automáticamente nuevas entradas y habilita los pronósticos públicos.</p>
        </form>

        <div v-if="abierta.estatus !== 'finalizada' && abierta.estatus !== 'cancelada'" class="rounded-2xl border border-red-200 bg-red-50/50 p-4 shadow-sm">
          <p class="text-sm font-semibold text-red-800">Zona de peligro</p>
          <p class="mt-1 text-xs text-red-700">Cancela esta jornada completa si se creó por error o ya no se va a jugar. Se avisará por correo a quien ya se haya registrado. No se puede deshacer.</p>
          <button type="button" @click="cancelarJornadaCompleta" :disabled="guardando" class="mt-3 w-full rounded-xl border border-red-300 bg-white px-5 py-3 font-semibold text-red-700 disabled:opacity-50 sm:w-auto">Cancelar jornada</button>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
```

- [ ] **Step 4: Compilar**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build`
Expected: build sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/modules/admin/services/adminService.js src/modules/admin/views/AdministrarJornadas.vue
git commit -m "AdministrarJornadas agrega botón para cancelar una jornada completa"
```

---

### Task 4: `TablaPublica.vue` — aviso de jornada cancelada

**Files:**
- Modify: `src/modules/publico/views/TablaPublica.vue`

**Interfaces:** Ninguna nueva — `jornada.estatus` ya llega en la consulta existente a `vista_jornada_publica`.

- [ ] **Step 1: Agregar el aviso en el header**

Localizar:

```html
      <p class="mt-4 text-sm text-green-100">Cierre de registro: {{ formatoFecha(jornada?.fecha_cierre) }}</p>
      <span class="mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold" :class="bloqueada ? 'bg-white/15 text-white' : 'bg-green-200 text-quiniela-verdeOscuro'">{{ bloqueada ? 'Registro cerrado' : 'Registro abierto' }}</span>
    </header>
```

Reemplazar por:

```html
      <p class="mt-4 text-sm text-green-100">Cierre de registro: {{ formatoFecha(jornada?.fecha_cierre) }}</p>
      <span class="mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold" :class="bloqueada ? 'bg-white/15 text-white' : 'bg-green-200 text-quiniela-verdeOscuro'">{{ bloqueada ? 'Registro cerrado' : 'Registro abierto' }}</span>
      <p v-if="jornada?.estatus === 'cancelada'" role="alert" class="mt-3 rounded-xl bg-red-500/90 px-3 py-2 text-sm font-bold text-white">Esta jornada fue cancelada.</p>
    </header>
```

- [ ] **Step 2: Compilar**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build`
Expected: build sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/modules/publico/views/TablaPublica.vue
git commit -m "TablaPublica muestra un aviso si la jornada fue cancelada"
```

---

### Task 5: `authService.js` — funciones para actualizar nombre, correo y contraseña

**Files:**
- Modify: `src/modules/auth/services/authService.js`

**Interfaces:**
- Produces: `actualizarNombre(nombreCompleto): Promise<void>`, `actualizarCorreo(nuevoCorreo): Promise<void>`, `actualizarPassword(nuevaPassword): Promise<void>`. La Tarea 6 las consume.

- [ ] **Step 1: Agregar las tres funciones al final del archivo**

Localizar:

```js
export async function recuperarPassword({ email }) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}
```

Reemplazar por:

```js
export async function recuperarPassword({ email }) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function actualizarNombre(nombreCompleto) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('perfiles').update({ nombre_completo: nombreCompleto }).eq('id', user.id);
  if (error) throw error;
}

export async function actualizarCorreo(nuevoCorreo) {
  const { error } = await supabase.auth.updateUser({ email: nuevoCorreo });
  if (error) throw error;
}

export async function actualizarPassword(nuevaPassword) {
  const { error } = await supabase.auth.updateUser({ password: nuevaPassword });
  if (error) throw error;
}
```

- [ ] **Step 2: Compilar y correr toda la suite**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build && npm test`
Expected: build sin errores; todos los tests existentes pasan.

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/services/authService.js
git commit -m "authService agrega actualizarNombre, actualizarCorreo y actualizarPassword"
```

---

### Task 6: `MiCuenta.vue` — apartado de cuenta

**Files:**
- Create: `src/modules/auth/views/MiCuenta.vue`
- Modify: `src/modules/auth/router.js`
- Modify: `src/components/NavbarComponent.vue`

**Interfaces:**
- Consumes: `actualizarNombre`, `actualizarCorreo`, `actualizarPassword`, `traducirErrorAuth` (Tarea 5); `authStore.perfil.nombre_completo`, `authStore.user.email`, `authStore.cargarPerfil()` (ya existen en `src/store/auth.js`, sin cambios).

- [ ] **Step 1: Crear `MiCuenta.vue`**

```vue
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
```

- [ ] **Step 2: Agregar la ruta**

Localizar (`src/modules/auth/router.js`, archivo completo actual):

```js
export default [
  { path: '/login', name: 'login', component: () => import('./views/Login.vue'), meta: { guestOnly: true } },
  { path: '/registro', name: 'registro', component: () => import('./views/Registro.vue'), meta: { guestOnly: true } },
  { path: '/verificar-codigo', name: 'verificar-codigo', component: () => import('./views/VerificarCodigo.vue'), meta: { guestOnly: true } },
  { path: '/recuperar-password', name: 'recuperar-password', component: () => import('./views/RecuperarPassword.vue'), meta: { guestOnly: true } },
];
```

Reemplazar por:

```js
export default [
  { path: '/login', name: 'login', component: () => import('./views/Login.vue'), meta: { guestOnly: true } },
  { path: '/registro', name: 'registro', component: () => import('./views/Registro.vue'), meta: { guestOnly: true } },
  { path: '/verificar-codigo', name: 'verificar-codigo', component: () => import('./views/VerificarCodigo.vue'), meta: { guestOnly: true } },
  { path: '/recuperar-password', name: 'recuperar-password', component: () => import('./views/RecuperarPassword.vue'), meta: { guestOnly: true } },
  { path: '/mi-cuenta', name: 'mi-cuenta', component: () => import('./views/MiCuenta.vue'), meta: { requiresAuth: true } },
];
```

- [ ] **Step 3: Agregar el link en `NavbarComponent.vue`**

Localizar (menú de escritorio):

```html
          <router-link :to="{ name: 'mis-quinielas' }" class="nav-link">Mis quinielas</router-link>
          <router-link :to="{ name: 'llenar-quiniela' }" class="nav-link">Jugar</router-link>
```

Reemplazar por:

```html
          <router-link :to="{ name: 'mis-quinielas' }" class="nav-link">Mis quinielas</router-link>
          <router-link :to="{ name: 'llenar-quiniela' }" class="nav-link">Jugar</router-link>
          <router-link :to="{ name: 'mi-cuenta' }" class="nav-link">Mi cuenta</router-link>
```

Localizar (menú móvil):

```html
        <p class="px-3 pb-1 text-xs font-bold uppercase tracking-widest text-white/60">Mi cuenta</p>
        <router-link :to="{ name: 'mis-quinielas' }" @click="cerrarMenu" class="mobile-nav-link">Mis quinielas</router-link>
        <router-link :to="{ name: 'llenar-quiniela' }" @click="cerrarMenu" class="mobile-nav-link">Llenar quiniela</router-link>
```

Reemplazar por:

```html
        <p class="px-3 pb-1 text-xs font-bold uppercase tracking-widest text-white/60">Mi cuenta</p>
        <router-link :to="{ name: 'mis-quinielas' }" @click="cerrarMenu" class="mobile-nav-link">Mis quinielas</router-link>
        <router-link :to="{ name: 'llenar-quiniela' }" @click="cerrarMenu" class="mobile-nav-link">Llenar quiniela</router-link>
        <router-link :to="{ name: 'mi-cuenta' }" @click="cerrarMenu" class="mobile-nav-link">Configuración</router-link>
```

- [ ] **Step 4: Compilar y correr toda la suite**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build && npm test`
Expected: build sin errores; todos los tests existentes pasan.

- [ ] **Step 5: Commit**

```bash
git add src/modules/auth/views/MiCuenta.vue src/modules/auth/router.js src/components/NavbarComponent.vue
git commit -m "Agrega el apartado Mi cuenta para editar nombre, correo y contraseña"
```

---

### Task 7: Pendientes elegidos

**Files:**
- Modify: `api/notificaciones/registro.js`
- Modify: `api/fixtures.js`
- Modify: `src/modules/auth/views/Registro.vue`
- Modify: `api/_lib/football/theSportsDb.js`
- Modify: `docs/PENDIENTES.md`

**Interfaces:** Ninguna nueva — cambios internos en archivos ya existentes.

- [ ] **Step 1: `api/notificaciones/registro.js` — aislar fallos por admin**

Localizar:

```js
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
        <p>Jornada: <b>${escaparHtml(jornadaNombre)}</b></p>
        <p>Entrada: ${escaparHtml(alias ?? 'Entrada')}</p>
        <p>Método de pago: ${metodoPago}</p>
        <p>Estatus: ${estatusPago}</p>`,
    });
  }
}
```

Reemplazar por:

```js
async function notificarAdmin(supabaseAdmin, { alias, metodoPago, estatusPago, jornadaNombre }) {
  const { data: admins } = await supabaseAdmin.from('perfiles').select('id').eq('rol', 'admin');
  for (const admin of admins ?? []) {
    try {
      const { data: cuenta } = await supabaseAdmin.auth.admin.getUserById(admin.id);
      const correoAdmin = cuenta?.user?.email;
      if (!correoAdmin) continue;
      await enviarCorreo({
        to: correoAdmin,
        subject: `Nueva quiniela registrada: ${jornadaNombre}`,
        heading: '📋 Nueva quiniela registrada',
        bodyHtml: `<p>Alguien acaba de registrar una quiniela.</p>
          <p>Jornada: <b>${escaparHtml(jornadaNombre)}</b></p>
          <p>Entrada: ${escaparHtml(alias ?? 'Entrada')}</p>
          <p>Método de pago: ${metodoPago}</p>
          <p>Estatus: ${estatusPago}</p>`,
      });
    } catch (error) {
      console.error(`notificaciones/registro: falló el aviso al admin ${admin.id}`, error.message);
    }
  }
}
```

- [ ] **Step 2: `api/fixtures.js` — validar `numeroJornada` como entero positivo**

Localizar:

```js
    const { numeroJornada } = req.query;
    if (numeroJornada) {
      if (leagues.length !== 1) return res.status(400).json({ error: 'La búsqueda por jornada solo admite una liga a la vez' });
```

Reemplazar por:

```js
    const { numeroJornada } = req.query;
    if (numeroJornada) {
      if (!/^\d+$/.test(numeroJornada)) return res.status(400).json({ error: 'El número de jornada debe ser un entero positivo' });
      if (leagues.length !== 1) return res.status(400).json({ error: 'La búsqueda por jornada solo admite una liga a la vez' });
```

- [ ] **Step 3: `Registro.vue` — distinguir formato inválido de username ya tomado**

Localizar:

```js
async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    const usernameNormalizado = username.value.trim().toLowerCase();
    if (!(await usernameDisponible(usernameNormalizado))) {
      error.value = 'Ese nombre de usuario ya está en uso.';
      return;
    }
```

Reemplazar por:

```js
const PATRON_USERNAME = /^[a-z0-9_]{3,20}$/;

async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    const usernameNormalizado = username.value.trim().toLowerCase();
    if (!PATRON_USERNAME.test(usernameNormalizado)) {
      error.value = 'El nombre de usuario debe tener de 3 a 20 caracteres, solo minúsculas, números y guión bajo.';
      return;
    }
    if (!(await usernameDisponible(usernameNormalizado))) {
      error.value = 'Ese nombre de usuario ya está en uso.';
      return;
    }
```

(Nota: `PATRON_USERNAME` se declara fuera de la función `onSubmit`, junto a los `ref`s existentes al inicio del `<script setup>`, no dentro de la función — verificar que quede en el nivel superior del script, no anidada.)

- [ ] **Step 4: `theSportsDb.js` — mitigar Apertura/Clausura compartiendo temporada**

Localizar:

```js
export async function getFixtures({ league, from, to, round, season }) {
  if (round) {
    const payload = await request(`eventsround.php?id=${encodeURIComponent(league)}&r=${encodeURIComponent(round)}&s=${encodeURIComponent(season)}`);
    return (payload.events ?? []).map(normalizeFixture);
  }
```

Reemplazar por:

```js
export async function getFixtures({ league, from, to, round, season }) {
  if (round) {
    const payload = await request(`eventsround.php?id=${encodeURIComponent(league)}&r=${encodeURIComponent(round)}&s=${encodeURIComponent(season)}`);
    const eventos = (payload.events ?? []).map(normalizeFixture);
    if (eventos.length <= 9) return eventos;
    // Si TheSportsDB agrupa más de un torneo bajo el mismo string de temporada
    // (posible con Apertura+Clausura de Liga MX), una ronda puede traer el
    // doble de partidos. Nos quedamos con los 9 más cercanos a hoy — no
    // verificado en vivo todavía porque el Clausura no ha empezado.
    const hoy = Date.now();
    return eventos
      .sort((a, b) => Math.abs(new Date(a.fixture.date) - hoy) - Math.abs(new Date(b.fixture.date) - hoy))
      .slice(0, 9)
      .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
  }
```

- [ ] **Step 5: Actualizar `docs/PENDIENTES.md`**

Localizar (en la sección "## Funcionalidad menor"):

```
- **`api/notificaciones/registro.js`, `notificarAdmin`**: si hay más de una cuenta admin y el correo al primero falla, el `for` no sigue con los demás (no hay try/catch por admin dentro del loop). Hoy solo existe una cuenta admin en producción, así que no tiene impacto real todavía.
- **`api/fixtures.js`**: el orden de validación cambió — ahora "liga no permitida" se revisa antes que "rango de fechas inválido". Si alguien manda ambos errores a la vez (liga desconocida + fechas inválidas, sin `ronda`), el mensaje que ve es distinto al de antes. Ningún test depende del orden viejo.
- **Búsqueda por ronda usa la fecha de hoy para calcular la temporada** (`seasonRangeForDate(hoy)` en `api/fixtures.js`), no la temporada real de la ronda que se está pidiendo. Podría fallar justo en el límite de una temporada (ej. buscar una ronda vieja poco después de que arrancó la siguiente temporada).
- **Apertura y Clausura de Liga MX comparten el mismo string de temporada en TheSportsDB** (ej. `"2026-2027"`). Cuando arranque el Clausura, `eventsround.php?s=2026-2027&r=8` probablemente regrese los 18 partidos de esa ronda en ambos torneos, no los 9 esperados — hay que probarlo cuando llegue esa fecha.
- **`api/fixtures.js` no valida que `ronda` sea un entero positivo** — un valor inválido simplemente regresa una respuesta vacía de TheSportsDB, no un error claro.
- **`api/auth/username-disponible.js`** regresa `disponible: false` tanto para un username ya tomado como para uno con formato inválido — el frontend lo muestra igual ("ya está en uso") en ambos casos. La validación del `pattern` del input ya evita que esto se note en el flujo normal, pero es una conflación frágil si algo cambia.
```

Reemplazar por:

```
- **`api/fixtures.js`**: el orden de validación cambió — ahora "liga no permitida" se revisa antes que "rango de fechas inválido". Si alguien manda ambos errores a la vez (liga desconocida + fechas inválidas, sin `numeroJornada`), el mensaje que ve es distinto al de antes. Ningún test depende del orden viejo.
- **Búsqueda por jornada usa la fecha de hoy para calcular la temporada** (`seasonRangeForDate(hoy)` en `api/fixtures.js`), no la temporada real de la jornada que se está pidiendo. Podría fallar justo en el límite de una temporada (ej. buscar una jornada vieja poco después de que arrancó la siguiente temporada).
- **Apertura y Clausura de Liga MX comparten el mismo string de temporada en TheSportsDB** (ej. `"2026-2027"`). `getFixtures` ahora se queda con los 9 partidos más cercanos a hoy si `eventsround.php` regresa más de 9 — es una mitigación razonable pero **no verificada en vivo todavía**, porque el Clausura no ha empezado. Revisar cuando arranque.

(Resueltos en esta pasada: `notificarAdmin` ya aísla fallos por admin; `numeroJornada` ya se valida como entero positivo; `username-disponible` ya no se confunde con "ya está en uso" gracias a la validación de formato en `Registro.vue` antes de consultar el servidor.)
```

- [ ] **Step 6: Compilar, verificar sintaxis y correr toda la suite**

Run: `node --check api/notificaciones/registro.js && node --check api/fixtures.js`
Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build && npm test`
Expected: sin errores; todos los tests existentes pasan.

- [ ] **Step 7: Commit**

```bash
git add api/notificaciones/registro.js api/fixtures.js src/modules/auth/views/Registro.vue api/_lib/football/theSportsDb.js docs/PENDIENTES.md
git commit -m "Resuelve pendientes: aislar fallos de notificarAdmin, validar numeroJornada, distinguir formato de username, mitigar Apertura/Clausura"
```

---

## Cierre del plan

Al terminar la Tarea 7, el controller aplica (o pide al humano aplicar) la migración `0023_cancelar_jornada.sql`, y verifica en vivo el checklist "Pruebas a cubrir" del spec (`docs/superpowers/specs/2026-09-11-mi-cuenta-cancelar-jornada-pendientes-design.md`): cambiar nombre/correo/contraseña desde "Mi cuenta"; cancelar una jornada activa con entradas registradas y confirmar el correo de aviso; intentar cancelar una jornada finalizada (debe fallar); visitar la tabla pública de una jornada cancelada. Push a `main` después, siguiendo el mismo flujo del resto de esta sesión.
