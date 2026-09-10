# Administración de jornadas: compartir registro, sin fechas pasadas, cancelar partido — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compartir el link de registro (no de resultados) desde Administrar jornadas; impedir fechas pasadas al crear/editar una jornada; y permitir cancelar/reactivar un partido individual para que no cuente en ninguna quiniela, sin dejar la jornada imposible de cerrar.

**Architecture:** Una columna nueva `partidos.cancelado` (booleano) es la fuente de verdad; `calcular_puntos()` y `cerrar-jornada.js` la respetan del lado del servidor, y `TarjetaPartido.vue` (componente compartido por el registro web y el presencial) la respeta del lado del cliente, así que el "no cuenta para tu quiniela" se implementa una sola vez y se hereda en ambos flujos de registro.

**Tech Stack:** Vue 3 (`<script setup>`), Vercel serverless functions (Node, ESM), Supabase (Postgres + RLS + funciones).

## Global Constraints

- Un partido se puede cancelar/reactivar en cualquier momento mientras la jornada no esté `finalizada` (antes o después de cerrado el registro).
- La cancelación es reversible (interruptor "Cancelar partido" / "Reactivar partido").
- Quien se registre después de que un partido ya esté cancelado no necesita pronosticarlo — no cuenta para el total requerido de esa quiniela.
- El check de "la jornada debe tener 9 partidos" en la creación (`crearJornada`) y en la advertencia visual de `LlenarQuiniela.vue` (`partidos.length !== 9`) **no cambia** — sigue contando el total real de filas, cancelados o no. Solo los checks de "¿ya pronosticó todo lo que le toca?" cambian para excluir cancelados.
- No se toca `api/sync-results.js` ni `api/manual-results.js`.
- No se agrega expiración, notificación automática, ni edición de los datos de un partido cancelado (equipos/fecha) — cancelar es un interruptor aparte.
- Este proyecto no tiene infraestructura de pruebas de componentes Vue ni de mocking de Supabase para funciones serverless con I/O real (patrón ya establecido). Las tareas de backend se verifican con `node --check` (sintaxis); las de frontend con `npm run build`. La verificación manual en vivo (`npm run dev` o producción) la hace el controller al final de todas las tareas, no cada una por separado — igual que en los planes anteriores de esta sesión.
- Nota de entorno de esta sesión: el `node`/`npm` por defecto en el PATH puede ser una versión vieja (v18) que falla el build de Vite con `crypto.hash is not a function`. Antes de correr `npm run build`/`npm test`, ejecutar en el mismo comando: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build` (el cambio de versión no persiste entre llamadas de terminal separadas).

---

### Task 1: Migración `0020_cancelar_partido.sql`

**Files:**
- Create: `supabase/migrations/0020_cancelar_partido.sql`

**Interfaces:**
- Produces: columna `partidos.cancelado` (`BOOLEAN NOT NULL DEFAULT false`). Todas las tareas siguientes dependen de que esta columna exista.

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/0020_cancelar_partido.sql
ALTER TABLE partidos ADD COLUMN cancelado BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION calcular_puntos(p_jornada_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE quinielas q
  SET aciertos = (
    SELECT COUNT(*)
    FROM predicciones p
    JOIN partidos pa ON pa.id = p.partido_id
    WHERE p.quiniela_id = q.id
      AND pa.cancelado = false
      AND pa.resultado_oficial IS NOT NULL
      AND pa.resultado_oficial = p.pronostico
  )
  WHERE q.jornada_id = p_jornada_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 2: No se aplica en este paso**

Igual que las migraciones anteriores de esta sesión, este archivo se entrega para que el humano lo aplique en el SQL Editor de Supabase cuando quiera — no se ejecuta como parte de esta tarea.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0020_cancelar_partido.sql
git commit -m "Agrega partidos.cancelado y excluye partidos cancelados de calcular_puntos"
```

---

### Task 2: `api/cerrar-jornada.js` — un partido cancelado no bloquea el cierre

**Files:**
- Modify: `api/cerrar-jornada.js`

**Interfaces:** Ninguna nueva — depende de la columna `cancelado` de la Tarea 1.

- [ ] **Step 1: Excluir partidos cancelados del conteo de resultados pendientes**

Localizar:

```js
    const { count: resultadosPendientes, error: errorResultados } = await supabaseAdmin
      .from('partidos')
      .select('id', { count: 'exact', head: true })
      .eq('jornada_id', jornada_id)
      .is('resultado_oficial', null);
```

Reemplazar por:

```js
    const { count: resultadosPendientes, error: errorResultados } = await supabaseAdmin
      .from('partidos')
      .select('id', { count: 'exact', head: true })
      .eq('jornada_id', jornada_id)
      .eq('cancelado', false)
      .is('resultado_oficial', null);
```

- [ ] **Step 2: Verificar sintaxis**

Run: `node --check api/cerrar-jornada.js`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add api/cerrar-jornada.js
git commit -m "cerrar-jornada.js ignora partidos cancelados al validar resultados pendientes"
```

---

### Task 3: `adminService.js` — `cancelarPartido()` y `cancelado` en `listarJornadasAdmin`

**Files:**
- Modify: `src/modules/admin/services/adminService.js`

**Interfaces:**
- Produces: `cancelarPartido(partidoId: string, cancelado: boolean): Promise<void>`. La Tarea 4 (`AdministrarJornadas.vue`) la consume así: `await cancelarPartido(partido.id, !partido.cancelado)`.
- `listarJornadasAdmin()` ahora incluye `cancelado` en cada partido devuelto — la Tarea 4 lo lee como `partido.cancelado`.

- [ ] **Step 1: Agregar `cancelado` a la consulta de `listarJornadasAdmin`**

Localizar:

```js
export async function listarJornadasAdmin() {
  const { data, error } = await supabase
    .from('jornadas')
    .select('id, nombre, costo, premio, fecha_cierre, estatus, creado_el, partidos(id, liga_nombre, equipo_local, equipo_visitante, logo_local, logo_visitante, fecha_partido, resultado_oficial)')
    .order('creado_el', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
```

Reemplazar por:

```js
export async function listarJornadasAdmin() {
  const { data, error } = await supabase
    .from('jornadas')
    .select('id, nombre, costo, premio, fecha_cierre, estatus, creado_el, partidos(id, liga_nombre, equipo_local, equipo_visitante, logo_local, logo_visitante, fecha_partido, resultado_oficial, cancelado)')
    .order('creado_el', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
```

- [ ] **Step 2: Agregar `cancelarPartido`**

Localizar (inmediatamente antes de `export async function crearJornada`):

```js
export async function actualizarCierreJornada(jornadaId, fechaCierre) {
  const { error } = await supabase.from('jornadas').update({ fecha_cierre: fechaCierre }).eq('id', jornadaId);
  if (error) throw error;
}
```

Agregar justo después (sin quitar nada):

```js
export async function actualizarCierreJornada(jornadaId, fechaCierre) {
  const { error } = await supabase.from('jornadas').update({ fecha_cierre: fechaCierre }).eq('id', jornadaId);
  if (error) throw error;
}

export async function cancelarPartido(partidoId, cancelado) {
  const { error } = await supabase.from('partidos').update({ cancelado }).eq('id', partidoId);
  if (error) throw error;
}
```

- [ ] **Step 3: Verificar sintaxis**

Run: `node --check src/modules/admin/services/adminService.js`

Nota: este archivo usa `import`/`export` de ES módulos igual que los `api/*.js`, así que `node --check` funciona igual para validarlo.

- [ ] **Step 4: Commit**

```bash
git add src/modules/admin/services/adminService.js
git commit -m "adminService: agrega cancelarPartido() e incluye cancelado en listarJornadasAdmin"
```

---

### Task 4: `AdministrarJornadas.vue` — botón cancelar/reactivar partido

**Files:**
- Modify: `src/modules/admin/views/AdministrarJornadas.vue`

**Interfaces:**
- Consumes: `cancelarPartido(partidoId, cancelado)` de `adminService.js` (Tarea 3).

- [ ] **Step 1: Importar `cancelarPartido` y agregar el manejador**

Localizar:

```js
import { actualizarCierreJornada, actualizarPremioJornada, listarJornadasAdmin } from '../services/adminService';
```

Reemplazar por:

```js
import { actualizarCierreJornada, actualizarPremioJornada, cancelarPartido, listarJornadasAdmin } from '../services/adminService';
```

Localizar (después de `cerrarRegistro`, antes de `onMounted`):

```js
async function cerrarRegistro() {
  if (!abierta.value) return;
  const confirmado = await confirmarAccion({ title: 'Cerrar registro ahora', text: 'Desde este momento ya no se podrán registrar nuevas quinielas.', confirmText: 'Cerrar registro', danger: true });
  if (!confirmado) return;
  guardando.value = true;
  try {
    const fecha = new Date().toISOString();
    await actualizarCierreJornada(abierta.value.id, fecha);
    abierta.value.fecha_cierre = fecha;
    cierreEditado.value = fechaParaInput(fecha);
    await alertaExito('Registro cerrado');
  } catch (error) {
    await alertaError(error, 'No se pudo cerrar el registro');
  } finally {
    guardando.value = false;
  }
}
```

Agregar justo después (sin quitar nada):

```js
async function alternarCancelacion(partido) {
  const accion = partido.cancelado ? 'reactivar' : 'cancelar';
  const confirmado = await confirmarAccion({
    title: partido.cancelado ? 'Reactivar partido' : 'Cancelar partido',
    text: partido.cancelado
      ? 'Volverá a contar para los pronósticos y para el cierre de la jornada.'
      : 'Ya no contará para ninguna quiniela ni bloqueará el cierre de la jornada.',
    confirmText: partido.cancelado ? 'Reactivar' : 'Cancelar partido',
    danger: !partido.cancelado,
  });
  if (!confirmado) return;
  try {
    await cancelarPartido(partido.id, !partido.cancelado);
    partido.cancelado = !partido.cancelado;
    await alertaExito(partido.cancelado ? 'Partido cancelado' : 'Partido reactivado');
  } catch (error) {
    await alertaError(error, `No se pudo ${accion} el partido`);
  }
}
```

- [ ] **Step 2: Agregar el botón y la etiqueta en la plantilla**

Localizar:

```html
        <div class="grid gap-3 sm:grid-cols-2">
          <article v-for="(partido, index) in abierta.partidos" :key="partido.id" class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div class="mb-3 flex justify-between text-xs text-gray-500"><span>Partido {{ index + 1 }} · {{ partido.liga_nombre }}</span><span>{{ formatoFechaPartido(partido.fecha_partido) }}</span></div>
            <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
              <div><img v-if="partido.logo_local" :src="partido.logo_local" alt="" class="mx-auto mb-2 h-10 w-10 object-contain" /><p class="text-sm font-bold">{{ partido.equipo_local }}</p></div>
              <span class="text-xs font-bold text-gray-400">VS</span>
              <div><img v-if="partido.logo_visitante" :src="partido.logo_visitante" alt="" class="mx-auto mb-2 h-10 w-10 object-contain" /><p class="text-sm font-bold">{{ partido.equipo_visitante }}</p></div>
            </div>
            <p v-if="partido.resultado_oficial" class="mt-3 text-center text-sm font-bold text-quiniela-verde">Resultado: {{ partido.resultado_oficial }}</p>
          </article>
        </div>
```

Reemplazar por:

```html
        <div class="grid gap-3 sm:grid-cols-2">
          <article v-for="(partido, index) in abierta.partidos" :key="partido.id" class="rounded-2xl border p-4 shadow-sm" :class="partido.cancelado ? 'border-red-200 bg-red-50/50' : 'border-gray-200 bg-white'">
            <div class="mb-3 flex justify-between text-xs text-gray-500"><span>Partido {{ index + 1 }} · {{ partido.liga_nombre }}</span><span>{{ formatoFechaPartido(partido.fecha_partido) }}</span></div>
            <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
              <div><img v-if="partido.logo_local" :src="partido.logo_local" alt="" class="mx-auto mb-2 h-10 w-10 object-contain" /><p class="text-sm font-bold">{{ partido.equipo_local }}</p></div>
              <span class="text-xs font-bold text-gray-400">VS</span>
              <div><img v-if="partido.logo_visitante" :src="partido.logo_visitante" alt="" class="mx-auto mb-2 h-10 w-10 object-contain" /><p class="text-sm font-bold">{{ partido.equipo_visitante }}</p></div>
            </div>
            <p v-if="partido.cancelado" class="mt-3 text-center text-sm font-bold text-red-700">Cancelado — no cuenta para las quinielas</p>
            <p v-else-if="partido.resultado_oficial" class="mt-3 text-center text-sm font-bold text-quiniela-verde">Resultado: {{ partido.resultado_oficial }}</p>
            <button v-if="abierta.estatus !== 'finalizada'" type="button" @click="alternarCancelacion(partido)" class="mt-3 w-full rounded-lg border py-2 text-sm font-semibold" :class="partido.cancelado ? 'border-quiniela-verde text-quiniela-verde' : 'border-red-300 text-red-700'">{{ partido.cancelado ? 'Reactivar partido' : 'Cancelar partido' }}</button>
          </article>
        </div>
```

- [ ] **Step 2: Compilar**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build`
Expected: build sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/modules/admin/views/AdministrarJornadas.vue
git commit -m "AdministrarJornadas permite cancelar/reactivar un partido"
```

---

### Task 5: `AdministrarJornadas.vue` — "Compartir quiniela" y fecha mínima en el cierre

**Files:**
- Modify: `src/modules/admin/views/AdministrarJornadas.vue`

**Interfaces:** Ninguna nueva.

- [ ] **Step 1: Reemplazar `copiarEnlace` por `compartirRegistro`**

Localizar:

```js
async function copiarEnlace(jornada) {
  try {
    await navigator.clipboard.writeText(enlacePublico(jornada));
    await alertaExito('Enlace copiado', 'Ya puedes compartir la tabla pública de resultados.');
  } catch (error) {
    await alertaError(error, 'No se pudo copiar el enlace');
  }
}
```

Reemplazar por:

```js
function enlaceRegistro() {
  return new URL(router.resolve({ name: 'llenar-quiniela' }).href, window.location.origin).href;
}

async function compartirRegistro(jornada) {
  const url = enlaceRegistro();
  if (!navigator.share) {
    try {
      await navigator.clipboard.writeText(url);
      await alertaExito('Enlace copiado', 'Ya puedes compartirlo para que se registren.');
    } catch (error) {
      await alertaError(error, 'No se pudo copiar el enlace');
    }
    return;
  }
  try {
    await navigator.share({ title: jornada.nombre, text: `Regístrate en ${jornada.nombre}`, url });
  } catch (error) {
    if (error.name !== 'AbortError') await alertaError(error, 'No se pudo compartir');
  }
}
```

- [ ] **Step 2: Actualizar el botón en la plantilla**

Localizar:

```html
            <button @click="compartirEnlace(abierta)" class="rounded-xl bg-white px-3 py-2.5 font-semibold text-quiniela-verdeOscuro">Compartir resultados</button>
            <button @click="copiarEnlace(abierta)" class="rounded-xl border border-white/40 px-3 py-2.5 font-semibold">Copiar enlace</button>
            <button @click="compartirImagen(abierta)" class="rounded-xl bg-quiniela-dorado px-3 py-2.5 font-semibold text-quiniela-grisTexto">Compartir imagen</button>
```

Reemplazar por:

```html
            <button @click="compartirEnlace(abierta)" class="rounded-xl bg-white px-3 py-2.5 font-semibold text-quiniela-verdeOscuro">Compartir resultados</button>
            <button @click="compartirRegistro(abierta)" class="rounded-xl border border-white/40 px-3 py-2.5 font-semibold">Compartir quiniela</button>
            <button @click="compartirImagen(abierta)" class="rounded-xl bg-quiniela-dorado px-3 py-2.5 font-semibold text-quiniela-grisTexto">Compartir imagen</button>
```

- [ ] **Step 3: Agregar fecha mínima al input de cierre**

Localizar (en el `<script setup>`, justo después de `const guardando = ref(false);`):

```js
const guardando = ref(false);
```

Reemplazar por:

```js
const guardando = ref(false);
const hoy = new Date().toISOString().slice(0, 10);
```

Localizar en la plantilla:

```html
            <label class="form-label flex-1">Fecha límite de registro<input v-model="cierreEditado" type="date" class="form-control mt-1" /></label>
```

Reemplazar por:

```html
            <label class="form-label flex-1">Fecha límite de registro<input v-model="cierreEditado" type="date" :min="hoy" class="form-control mt-1" /></label>
```

Y en `guardarCierre`, localizar:

```js
async function guardarCierre() {
  if (!abierta.value || !cierreEditado.value) return;
  guardando.value = true;
```

Reemplazar por:

```js
async function guardarCierre() {
  if (!abierta.value || !cierreEditado.value) return;
  if (cierreEditado.value < hoy) {
    await alertaError(new Error('La fecha de cierre no puede ser anterior a hoy'));
    return;
  }
  guardando.value = true;
```

- [ ] **Step 4: Compilar**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build`
Expected: build sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/modules/admin/views/AdministrarJornadas.vue
git commit -m "AdministrarJornadas: Compartir quiniela (enlace de registro) y fecha mínima en el cierre"
```

---

### Task 6: `GestionJornadas.vue` — fecha mínima en los 4 inputs de fecha

**Files:**
- Modify: `src/modules/admin/views/GestionJornadas.vue`

**Interfaces:** Ninguna nueva.

- [ ] **Step 1: Agregar la constante `hoy` y `hoyDatetime`**

Localizar:

```js
const MAX_PARTIDOS = 9;
```

Reemplazar por:

```js
const MAX_PARTIDOS = 9;
const hoy = new Date().toISOString().slice(0, 10);
const hoyDatetime = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
```

- [ ] **Step 2: `min` en los 4 inputs**

Localizar:

```html
        <label class="text-sm font-semibold text-gray-700">Del<input v-model="desde" type="date" class="mt-1 w-full rounded-xl border-gray-300" /></label>
        <label class="text-sm font-semibold text-gray-700">Al<input v-model="hasta" type="date" class="mt-1 w-full rounded-xl border-gray-300" /></label>
```

Reemplazar por:

```html
        <label class="text-sm font-semibold text-gray-700">Del<input v-model="desde" type="date" :min="hoy" class="mt-1 w-full rounded-xl border-gray-300" /></label>
        <label class="text-sm font-semibold text-gray-700">Al<input v-model="hasta" type="date" :min="hoy" class="mt-1 w-full rounded-xl border-gray-300" /></label>
```

Localizar:

```html
        <label class="text-sm font-semibold">Fecha y hora<input v-model="partidoManual.fecha" type="datetime-local" class="mt-1 w-full rounded-xl border-gray-300" /></label>
```

Reemplazar por:

```html
        <label class="text-sm font-semibold">Fecha y hora<input v-model="partidoManual.fecha" type="datetime-local" :min="hoyDatetime" class="mt-1 w-full rounded-xl border-gray-300" /></label>
```

Localizar:

```html
<label class="text-sm font-semibold">Cierre<input v-model="fechaCierre" type="date" class="mt-1 w-full rounded-xl border-gray-300" /></label>
```

Reemplazar por:

```html
<label class="text-sm font-semibold">Cierre<input v-model="fechaCierre" type="date" :min="hoy" class="mt-1 w-full rounded-xl border-gray-300" /></label>
```

- [ ] **Step 3: Validar en JS al agregar un partido manual y al publicar la jornada**

Localizar:

```js
function agregarPartidoManual() {
  const { liga, local, visitante, fecha } = partidoManual.value;
  if (!liga.trim() || !local?.name?.trim() || !visitante?.name?.trim() || !fecha) {
    error.value = 'Completa todos los datos del partido manual.';
    return;
  }
```

Reemplazar por:

```js
function agregarPartidoManual() {
  const { liga, local, visitante, fecha } = partidoManual.value;
  if (!liga.trim() || !local?.name?.trim() || !visitante?.name?.trim() || !fecha) {
    error.value = 'Completa todos los datos del partido manual.';
    return;
  }
  if (fecha < hoyDatetime) {
    error.value = 'La fecha del partido no puede ser en el pasado.';
    return;
  }
```

Localizar:

```js
async function guardarJornada() {
  error.value = '';
  if (!completo.value) return;
  try {
```

Reemplazar por:

```js
async function guardarJornada() {
  error.value = '';
  if (!completo.value) return;
  if (fechaCierre.value < hoy) {
    error.value = 'La fecha de cierre no puede ser en el pasado.';
    return;
  }
  try {
```

- [ ] **Step 4: Compilar**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build`
Expected: build sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/modules/admin/views/GestionJornadas.vue
git commit -m "GestionJornadas no permite fechas pasadas al buscar, agregar partido manual o fijar el cierre"
```

---

### Task 7: `TarjetaPartido.vue` — estado cancelado

**Files:**
- Modify: `src/modules/quinielas/components/TarjetaPartido.vue`

**Interfaces:**
- Consumes: `partido.cancelado` (ya llega solo, vía `select('*')`, en todo lugar que ya pasa `partido` a este componente).
- Produces: cuando `partido.cancelado` es verdadero, este componente ya no emite `update:modelValue` (no hay botones que lo disparen) — las Tareas 8 y 9 dependen de que un partido cancelado nunca tenga entrada en el `pronosticos` de su componente padre.

- [ ] **Step 1: Reemplazar el bloque de botones por un aviso cuando está cancelado**

Localizar:

```html
    <div class="grid grid-cols-3 gap-2">
      <button v-for="opcion in opciones" :key="opcion.value" type="button" :disabled="deshabilitado" @click="$emit('update:modelValue', opcion.value)" :aria-pressed="modelValue === opcion.value" class="min-h-12 rounded-xl border px-2 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50" :class="modelValue === opcion.value ? 'border-quiniela-doradoOscuro bg-quiniela-dorado text-quiniela-grisTexto shadow-sm' : 'border-gray-300 text-gray-600 hover:border-quiniela-verde'">{{ opcion.label }}</button>
    </div>
```

Reemplazar por:

```html
    <div v-if="partido.cancelado" class="rounded-xl bg-red-50 py-3 text-center text-sm font-bold text-red-700">Partido cancelado — no cuenta para tu quiniela</div>
    <div v-else class="grid grid-cols-3 gap-2">
      <button v-for="opcion in opciones" :key="opcion.value" type="button" :disabled="deshabilitado" @click="$emit('update:modelValue', opcion.value)" :aria-pressed="modelValue === opcion.value" class="min-h-12 rounded-xl border px-2 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50" :class="modelValue === opcion.value ? 'border-quiniela-doradoOscuro bg-quiniela-dorado text-quiniela-grisTexto shadow-sm' : 'border-gray-300 text-gray-600 hover:border-quiniela-verde'">{{ opcion.label }}</button>
    </div>
```

- [ ] **Step 2: Compilar**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build`
Expected: build sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/modules/quinielas/components/TarjetaPartido.vue
git commit -m "TarjetaPartido muestra Cancelado en vez de los botones de pronóstico"
```

---

### Task 8: `LlenarQuiniela.vue` — `completo` excluye partidos cancelados

**Files:**
- Modify: `src/modules/quinielas/views/LlenarQuiniela.vue`

**Interfaces:**
- Consumes: `partido.cancelado` (Tarea 7 ya hace que nunca se le asigne pronóstico).

- [ ] **Step 1: Reemplazar el computed `completo`**

Localizar:

```js
const completo = computed(() => partidos.value.length === 9 && partidos.value.every((partido) => pronosticos.value[partido.id]));
```

Reemplazar por:

```js
const partidosActivos = computed(() => partidos.value.filter((p) => !p.cancelado));
const completo = computed(() => partidosActivos.value.length > 0 && partidosActivos.value.every((partido) => pronosticos.value[partido.id]));
```

(el resto del archivo, incluido `<p v-if="partidos.length !== 9">Esta jornada no contiene los 9 partidos requeridos.</p>`, no cambia — sigue validando el total real de partidos de la jornada, no cuántos están activos).

- [ ] **Step 2: Compilar y correr toda la suite**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build && npm test`
Expected: build sin errores; todos los tests existentes pasan.

- [ ] **Step 3: Commit**

```bash
git add src/modules/quinielas/views/LlenarQuiniela.vue
git commit -m "LlenarQuiniela no exige pronóstico en partidos cancelados para completar la quiniela"
```

---

### Task 9: `EdicionManual.vue` — `completas` excluye cancelados y texto dinámico del botón

**Files:**
- Modify: `src/modules/admin/views/EdicionManual.vue`

**Interfaces:**
- Consumes: `partido.cancelado`.

- [ ] **Step 1: Reemplazar el computed `completas`**

Localizar:

```js
const completas = computed(() => partidos.value.length === 9 && partidos.value.every((partido) => pronosticos.value[partido.id]));
```

Reemplazar por:

```js
const partidosActivos = computed(() => partidos.value.filter((p) => !p.cancelado));
const completas = computed(() => partidosActivos.value.length > 0 && partidosActivos.value.every((partido) => pronosticos.value[partido.id]));
```

- [ ] **Step 2: Texto dinámico del botón de registrar**

Localizar:

```html
      <button v-if="partidos.length" @click="registrar" :disabled="!completas || !alias.trim() || loading" class="sticky bottom-3 w-full rounded-xl bg-quiniela-verde py-3 font-bold text-white shadow-xl disabled:opacity-50">{{ loading ? 'Registrando…' : `${Object.keys(pronosticos).length} de 9 · Registrar quiniela` }}</button>
```

Reemplazar por:

```html
      <button v-if="partidos.length" @click="registrar" :disabled="!completas || !alias.trim() || loading" class="sticky bottom-3 w-full rounded-xl bg-quiniela-verde py-3 font-bold text-white shadow-xl disabled:opacity-50">{{ loading ? 'Registrando…' : `${Object.keys(pronosticos).length} de ${partidosActivos.length} · Registrar quiniela` }}</button>
```

- [ ] **Step 3: Compilar y correr toda la suite**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build && npm test`
Expected: build sin errores; todos los tests pasan.

- [ ] **Step 4: Commit**

```bash
git add src/modules/admin/views/EdicionManual.vue
git commit -m "EdicionManual no exige pronóstico en partidos cancelados y muestra el total real requerido"
```

---

### Task 10: `api/admin-quinielas.js` — validación dinámica de conteo de pronósticos

**Files:**
- Modify: `api/admin-quinielas.js`

**Interfaces:** Ninguna nueva.

- [ ] **Step 1: Reemplazar el bloque de validación del POST**

Localizar:

```js
    if (req.method === 'POST') {
      const { jornada_id: jornadaId, alias, correo_contacto: correoContactoRaw, estatus_pago: estatus, predicciones } = req.body ?? {};
      if (!jornadaId || !alias?.trim() || !ESTATUS.has(estatus) || !Array.isArray(predicciones) || predicciones.length !== 9) {
        return res.status(400).json({ error: 'Completa la entrada, el estatus y los 9 pronósticos' });
      }
      const correoContacto = normalizarCorreo(correoContactoRaw);
      if (new Set(predicciones.map((item) => item.partido_id)).size !== 9 || predicciones.some((item) => !PRONOSTICOS.has(item.pronostico))) {
        return res.status(400).json({ error: 'Los pronósticos no son válidos' });
      }

      const { data: jornada, error: jornadaError } = await supabase.from('jornadas').select('id, costo, fecha_cierre, estatus').eq('id', jornadaId).single();
      if (jornadaError) throw jornadaError;
      if (jornada.estatus !== 'activa' || new Date(jornada.fecha_cierre) <= new Date()) return res.status(409).json({ error: 'La jornada ya no admite quinielas' });
      const { data: partidos, error: partidosError } = await supabase.from('partidos').select('id').eq('jornada_id', jornadaId).in('id', predicciones.map((item) => item.partido_id));
      if (partidosError) throw partidosError;
      if (partidos.length !== 9) return res.status(400).json({ error: 'Los partidos no corresponden a la jornada' });
```

Reemplazar por:

```js
    if (req.method === 'POST') {
      const { jornada_id: jornadaId, alias, correo_contacto: correoContactoRaw, estatus_pago: estatus, predicciones } = req.body ?? {};
      if (!jornadaId || !alias?.trim() || !ESTATUS.has(estatus) || !Array.isArray(predicciones)) {
        return res.status(400).json({ error: 'Completa la entrada, el estatus y los pronósticos' });
      }
      const correoContacto = normalizarCorreo(correoContactoRaw);

      const { data: jornada, error: jornadaError } = await supabase.from('jornadas').select('id, costo, fecha_cierre, estatus').eq('id', jornadaId).single();
      if (jornadaError) throw jornadaError;
      if (jornada.estatus !== 'activa' || new Date(jornada.fecha_cierre) <= new Date()) return res.status(409).json({ error: 'La jornada ya no admite quinielas' });

      const { data: partidosActivos, error: partidosError } = await supabase.from('partidos').select('id').eq('jornada_id', jornadaId).eq('cancelado', false);
      if (partidosError) throw partidosError;
      const idsActivos = new Set(partidosActivos.map((p) => p.id));

      if (predicciones.length !== idsActivos.size) {
        return res.status(400).json({ error: `Completa los ${idsActivos.size} pronósticos` });
      }
      if (new Set(predicciones.map((item) => item.partido_id)).size !== idsActivos.size || predicciones.some((item) => !PRONOSTICOS.has(item.pronostico) || !idsActivos.has(item.partido_id))) {
        return res.status(400).json({ error: 'Los pronósticos no son válidos' });
      }
```

- [ ] **Step 2: Verificar sintaxis**

Run: `node --check api/admin-quinielas.js`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add api/admin-quinielas.js
git commit -m "admin-quinielas.js valida el conteo de pronósticos contra los partidos activos, no un 9 fijo"
```

---

### Task 11: `SincronizarResultados.vue` — `cancelado` en el select y etiqueta "Cancelado"

**Files:**
- Modify: `src/modules/admin/views/SincronizarResultados.vue`

**Interfaces:** Ninguna nueva.

- [ ] **Step 1: Agregar `cancelado` a la consulta**

Localizar:

```js
  const { data, error: queryError } = await supabase.from('partidos').select('id, liga_nombre, equipo_local, equipo_visitante, logo_local, logo_visitante, fecha_partido, resultado_oficial, provider').eq('jornada_id', jornada.id).order('fecha_partido');
```

Reemplazar por:

```js
  const { data, error: queryError } = await supabase.from('partidos').select('id, liga_nombre, equipo_local, equipo_visitante, logo_local, logo_visitante, fecha_partido, resultado_oficial, provider, cancelado').eq('jornada_id', jornada.id).order('fecha_partido');
```

- [ ] **Step 2: Mostrar "Cancelado" en vez de los botones de resultado**

Localizar:

```html
        <article v-for="partido in partidos" :key="partido.id" class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div class="mb-3 flex flex-wrap justify-between gap-2 text-xs text-gray-500"><span>{{ partido.liga_nombre }} · {{ partido.provider === 'manual' ? 'Manual' : 'TheSportsDB' }}</span><span>{{ fechaPartido(partido.fecha_partido) }}</span></div>
          <div class="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <div><img v-if="partido.logo_local" :src="partido.logo_local" alt="" class="mx-auto mb-2 h-10 w-10 object-contain" /><div v-else class="mx-auto mb-2 h-10 w-10 rounded-full bg-gray-100"></div><p class="text-sm font-bold text-quiniela-verdeOscuro">{{ partido.equipo_local }}</p></div>
            <span class="text-xs font-bold text-gray-400">VS</span>
            <div><img v-if="partido.logo_visitante" :src="partido.logo_visitante" alt="" class="mx-auto mb-2 h-10 w-10 object-contain" /><div v-else class="mx-auto mb-2 h-10 w-10 rounded-full bg-gray-100"></div><p class="text-sm font-bold text-quiniela-verdeOscuro">{{ partido.equipo_visitante }}</p></div>
          </div>
          <div class="grid grid-cols-3 gap-2"><button v-for="opcion in opciones" :key="opcion.value" @click="resultados[partido.id] = opcion.value" class="min-h-11 rounded-xl border px-2 py-2 text-sm font-semibold" :class="resultados[partido.id] === opcion.value ? 'border-quiniela-doradoOscuro bg-quiniela-dorado text-quiniela-grisTexto' : 'border-gray-300 text-gray-600'">{{ opcion.label }}</button></div>
        </article>
```

Reemplazar por:

```html
        <article v-for="partido in partidos" :key="partido.id" class="rounded-2xl border p-4 shadow-sm" :class="partido.cancelado ? 'border-red-200 bg-red-50/50' : 'border-gray-200 bg-white'">
          <div class="mb-3 flex flex-wrap justify-between gap-2 text-xs text-gray-500"><span>{{ partido.liga_nombre }} · {{ partido.provider === 'manual' ? 'Manual' : 'TheSportsDB' }}</span><span>{{ fechaPartido(partido.fecha_partido) }}</span></div>
          <div class="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <div><img v-if="partido.logo_local" :src="partido.logo_local" alt="" class="mx-auto mb-2 h-10 w-10 object-contain" /><div v-else class="mx-auto mb-2 h-10 w-10 rounded-full bg-gray-100"></div><p class="text-sm font-bold text-quiniela-verdeOscuro">{{ partido.equipo_local }}</p></div>
            <span class="text-xs font-bold text-gray-400">VS</span>
            <div><img v-if="partido.logo_visitante" :src="partido.logo_visitante" alt="" class="mx-auto mb-2 h-10 w-10 object-contain" /><div v-else class="mx-auto mb-2 h-10 w-10 rounded-full bg-gray-100"></div><p class="text-sm font-bold text-quiniela-verdeOscuro">{{ partido.equipo_visitante }}</p></div>
          </div>
          <p v-if="partido.cancelado" class="rounded-xl bg-red-50 py-3 text-center text-sm font-bold text-red-700">Cancelado — no se le captura resultado</p>
          <div v-else class="grid grid-cols-3 gap-2"><button v-for="opcion in opciones" :key="opcion.value" @click="resultados[partido.id] = opcion.value" class="min-h-11 rounded-xl border px-2 py-2 text-sm font-semibold" :class="resultados[partido.id] === opcion.value ? 'border-quiniela-doradoOscuro bg-quiniela-dorado text-quiniela-grisTexto' : 'border-gray-300 text-gray-600'">{{ opcion.label }}</button></div>
        </article>
```

- [ ] **Step 3: Compilar**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build`
Expected: build sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/modules/admin/views/SincronizarResultados.vue
git commit -m "SincronizarResultados muestra Cancelado y no pide resultado para un partido cancelado"
```

---

### Task 12: `TablaPublica.vue` — etiqueta "Cancelado" en "Resultados al momento"

**Files:**
- Modify: `src/modules/publico/views/TablaPublica.vue`

**Interfaces:** Ninguna nueva — `partidos.value` ya trae `cancelado` vía `select('*')`.

- [ ] **Step 1: Agregar el estado "Cancelado" a la etiqueta**

Localizar:

```html
          <div class="mb-3 flex items-center justify-between gap-2 text-xs text-gray-500"><span>Partido {{ index + 1 }} · {{ p.liga_nombre }}</span><span class="rounded-full px-2 py-1 font-bold" :class="p.resultado_oficial ? 'bg-green-50 text-quiniela-verde' : 'bg-gray-100'">{{ p.resultado_oficial ? 'Finalizado' : 'Pendiente' }}</span></div>
```

Reemplazar por:

```html
          <div class="mb-3 flex items-center justify-between gap-2 text-xs text-gray-500"><span>Partido {{ index + 1 }} · {{ p.liga_nombre }}</span><span class="rounded-full px-2 py-1 font-bold" :class="p.cancelado ? 'bg-red-50 text-red-700' : p.resultado_oficial ? 'bg-green-50 text-quiniela-verde' : 'bg-gray-100'">{{ p.cancelado ? 'Cancelado' : p.resultado_oficial ? 'Finalizado' : 'Pendiente' }}</span></div>
```

- [ ] **Step 2: Compilar y correr toda la suite**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build && npm test`
Expected: build sin errores; todos los tests pasan.

- [ ] **Step 3: Commit**

```bash
git add src/modules/publico/views/TablaPublica.vue
git commit -m "TablaPublica muestra Cancelado en Resultados al momento para partidos cancelados"
```

---

## Cierre del plan

Al terminar la Tarea 12, el controller aplica (o pide al humano aplicar) la migración de la Tarea 1, y verifica en vivo el checklist "Pruebas a cubrir" del spec (`docs/superpowers/specs/2026-09-09-admin-jornadas-design.md`): cancelar un partido con registro abierto y con registro cerrado, reactivarlo, cerrar una jornada con un partido cancelado sin resultado, y confirmar que `calcular_puntos()` lo ignora. Push a `main` después, siguiendo el mismo flujo del resto de esta sesión.
