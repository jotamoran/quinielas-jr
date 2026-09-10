# Mis quinielas: tabla condicionada, ver pronósticos de los demás, ver mis pronósticos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En `MisQuinielas.vue`: solo mostrar la tabla de posiciones si el usuario ya tiene una entrada en la jornada activa; agregar el mismo toggle "ver pronósticos de los demás" (con resaltado ámbar/rojo) que ya existe en `TablaPublica.vue`; y agregar un botón para ver los pronósticos que uno mismo guardó en cada una de sus propias entradas, marcando acierto/fallo cuando ya hay resultado oficial.

**Architecture:** El grid de detalle de pronósticos que hoy vive inline dentro de `TablaPosiciones.vue` se extrae a un componente compartido `DetallePronosticos.vue`, que gana la capacidad opcional de marcar ✓/✗ contra un `resultado_oficial`. `MisQuinielas.vue` reutiliza ese componente dos veces: dentro de `TablaPosiciones` (sin cambios de comportamiento, vía el prop ya existente `obtenerPronosticosFn`) y en su propia lista de entradas (vía una función nueva del servicio que lee `predicciones` directo, protegida por una política RLS que ya existe).

**Tech Stack:** Vue 3 (`<script setup>`), Supabase (Postgres + RLS, sin cambios de esquema).

## Global Constraints

- No se crea ninguna migración ni vista nueva — todo se resuelve con RLS/vistas ya existentes (`vista_pronosticos_publicos`, política `"ver predicciones propias o admin"` sobre `predicciones`).
- El gateo de la tabla de posiciones es solo sobre la jornada activa que ya se muestra hoy en `MisQuinielas.vue` — no se agrega historial de jornadas pasadas.
- `TablaPublica.vue` no se toca en ningún task de este plan — sigue con su propia función local `obtenerPronosticosPublicos`, intencionalmente duplicada (mismo patrón, sin dependencia cruzada de módulos).
- Ningún prop público de `TablaPosiciones.vue` cambia (`jornadaId`, `obtenerRankingFn`, `obtenerPronosticosFn`, `bloqueada`, `resaltarExtremos`) — su comportamiento visible en `TablaPublica.vue` y en la propia "Tabla de posiciones" de `MisQuinielas.vue` debe ser idéntico al de antes de este plan.
- El botón "Ver pronósticos" de una entrada propia (Task 4) debe funcionar sin importar el estatus de pago de la entrada ni el estatus de la jornada (activa, cerrada o finalizada) — no lleva ningún gateo por fecha.
- Este proyecto no tiene infraestructura de pruebas de componentes Vue. Las tareas se verifican con `npm run build` (compila) y `npm test` (no se rompen los tests existentes); no se agregan tests nuevos porque no hay arnés de pruebas de componentes en este repo (patrón ya establecido en planes anteriores). La verificación manual en vivo la hace el controller al final de todas las tareas.
- Nota de entorno de esta sesión: el `node`/`npm` por defecto en el PATH puede ser una versión vieja (v18) que falla el build de Vite con `crypto.hash is not a function`. Antes de correr `npm run build`/`npm test`, ejecutar en el mismo comando: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build && npm test` (el cambio de versión no persiste entre llamadas de terminal separadas).

---

### Task 1: Extraer `DetallePronosticos.vue` desde `TablaPosiciones.vue`

**Files:**
- Create: `src/modules/quinielas/components/DetallePronosticos.vue`
- Modify: `src/modules/quinielas/components/TablaPosiciones.vue`

**Interfaces:**
- Produces: componente `DetallePronosticos` con prop `items: Array` (cada item: `{ partido_id, equipo_local, equipo_visitante, logo_local, logo_visitante, pronostico, resultado_oficial? }`). Si `resultado_oficial` es `null`/`undefined`, el badge se ve igual que hoy (verde neutro, sin ✓/✗). Las Tareas 2-4 no dependen de esta interfaz todavía; la Tarea 4 sí la consume.

- [ ] **Step 1: Crear el componente `DetallePronosticos.vue`**

```vue
<script setup>
defineProps({
  items: { type: Array, required: true },
});

function etiquetaPronostico(valor) {
  return { L: 'Local', E: 'Empate', V: 'Visita' }[valor] ?? valor;
}

function esAcierto(detalle) {
  return detalle.resultado_oficial != null && detalle.resultado_oficial === detalle.pronostico;
}

function esFallo(detalle) {
  return detalle.resultado_oficial != null && detalle.resultado_oficial !== detalle.pronostico;
}
</script>

<template>
  <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
    <div v-for="(detalle, index) in items" :key="detalle.partido_id" class="flex items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm">
      <div class="flex min-w-0 items-center gap-1.5">
        <span class="text-xs text-gray-400">{{ index + 1 }}</span>
        <img v-if="detalle.logo_local" :src="detalle.logo_local" alt="" class="h-5 w-5 shrink-0 object-contain" /><span v-else class="h-5 w-5 shrink-0 rounded-full bg-gray-100"></span>
        <p class="truncate font-semibold">{{ detalle.equipo_local }} vs {{ detalle.equipo_visitante }}</p>
        <img v-if="detalle.logo_visitante" :src="detalle.logo_visitante" alt="" class="h-5 w-5 shrink-0 object-contain" /><span v-else class="h-5 w-5 shrink-0 rounded-full bg-gray-100"></span>
      </div>
      <span class="shrink-0 rounded-full px-2 py-1 text-xs font-bold" :class="esAcierto(detalle) ? 'bg-green-100 text-green-700' : esFallo(detalle) ? 'bg-red-100 text-red-700' : 'bg-green-50 text-quiniela-verde'">{{ esAcierto(detalle) ? '✓ ' : esFallo(detalle) ? '✗ ' : '' }}{{ etiquetaPronostico(detalle.pronostico) }}</span>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Quitar el grid inline de `TablaPosiciones.vue` y usar el componente nuevo**

Localizar (dentro de `<script setup>`, cerca del final):

```js
function etiquetaPronostico(valor) {
  return { L: 'Local', E: 'Empate', V: 'Visita' }[valor] ?? valor;
}
```

Eliminar ese bloque completo (ya vive en `DetallePronosticos.vue`) y agregar el import al inicio del `<script setup>`, junto a los imports existentes:

```js
import { computed, ref, onMounted, watch } from 'vue';
```

reemplazar por:

```js
import { computed, ref, onMounted, watch } from 'vue';
import DetallePronosticos from './DetallePronosticos.vue';
```

Localizar (en el `<template>`):

```html
      <div v-if="abiertaId === fila.quiniela_id" class="border-t border-gray-100 bg-gray-50 p-3 sm:p-4">
        <p v-if="cargandoDetalle === fila.quiniela_id" class="text-center text-sm text-gray-500">Cargando pronósticos…</p>
        <p v-else-if="errorDetalle[fila.quiniela_id]" class="text-center text-sm text-red-600">{{ errorDetalle[fila.quiniela_id] }}</p>
        <div v-else class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="(detalle, index) in detalles[fila.quiniela_id]" :key="detalle.partido_id" class="flex items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm">
            <div class="flex min-w-0 items-center gap-1.5">
              <span class="text-xs text-gray-400">{{ index + 1 }}</span>
              <img v-if="detalle.logo_local" :src="detalle.logo_local" alt="" class="h-5 w-5 shrink-0 object-contain" /><span v-else class="h-5 w-5 shrink-0 rounded-full bg-gray-100"></span>
              <p class="truncate font-semibold">{{ detalle.equipo_local }} vs {{ detalle.equipo_visitante }}</p>
              <img v-if="detalle.logo_visitante" :src="detalle.logo_visitante" alt="" class="h-5 w-5 shrink-0 object-contain" /><span v-else class="h-5 w-5 shrink-0 rounded-full bg-gray-100"></span>
            </div>
            <span class="shrink-0 rounded-full bg-green-50 px-2 py-1 text-xs font-bold text-quiniela-verde">{{ etiquetaPronostico(detalle.pronostico) }}</span>
          </div>
        </div>
      </div>
```

Reemplazar por:

```html
      <div v-if="abiertaId === fila.quiniela_id" class="border-t border-gray-100 bg-gray-50 p-3 sm:p-4">
        <p v-if="cargandoDetalle === fila.quiniela_id" class="text-center text-sm text-gray-500">Cargando pronósticos…</p>
        <p v-else-if="errorDetalle[fila.quiniela_id]" class="text-center text-sm text-red-600">{{ errorDetalle[fila.quiniela_id] }}</p>
        <DetallePronosticos v-else :items="detalles[fila.quiniela_id]" />
      </div>
```

- [ ] **Step 3: Compilar y correr toda la suite**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build && npm test`
Expected: build sin errores; todos los tests existentes pasan.

- [ ] **Step 4: Commit**

```bash
git add src/modules/quinielas/components/DetallePronosticos.vue src/modules/quinielas/components/TablaPosiciones.vue
git commit -m "Extrae DetallePronosticos.vue desde TablaPosiciones.vue, con soporte opcional de marca acierto/fallo"
```

---

### Task 2: `quinielasService.js` — `obtenerPronosticosDeQuiniela`

**Files:**
- Modify: `src/modules/quinielas/services/quinielasService.js`

**Interfaces:**
- Produces: `obtenerPronosticosDeQuiniela(quinielaId): Promise<Array<{ partido_id, equipo_local, equipo_visitante, logo_local, logo_visitante, pronostico, resultado_oficial }>>`, ordenado por `fecha_partido` ascendente. Consumida por la Tarea 4.

- [ ] **Step 1: Agregar la función al final del archivo**

Localizar (el final del archivo):

```js
export async function obtenerRanking(jornadaId) {
  const { data, error } = await supabase
    .from('vista_ranking_jornada')
    .select('*')
    .eq('jornada_id', jornadaId)
    .order('posicion');
  if (error) throw error;
  return data;
}
```

Reemplazar por:

```js
export async function obtenerRanking(jornadaId) {
  const { data, error } = await supabase
    .from('vista_ranking_jornada')
    .select('*')
    .eq('jornada_id', jornadaId)
    .order('posicion');
  if (error) throw error;
  return data;
}

export async function obtenerPronosticosDeQuiniela(quinielaId) {
  const { data, error } = await supabase
    .from('predicciones')
    .select('partido_id, pronostico, partidos(equipo_local, equipo_visitante, logo_local, logo_visitante, resultado_oficial, fecha_partido)')
    .eq('quiniela_id', quinielaId);
  if (error) throw error;
  return (data ?? [])
    .slice()
    .sort((a, b) => new Date(a.partidos?.fecha_partido ?? 0) - new Date(b.partidos?.fecha_partido ?? 0))
    .map((item) => ({
      partido_id: item.partido_id,
      equipo_local: item.partidos.equipo_local,
      equipo_visitante: item.partidos.equipo_visitante,
      logo_local: item.partidos.logo_local,
      logo_visitante: item.partidos.logo_visitante,
      pronostico: item.pronostico,
      resultado_oficial: item.partidos.resultado_oficial,
    }));
}
```

- [ ] **Step 2: Verificar sintaxis**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build`
Expected: build sin errores (este archivo no tiene tests unitarios propios; el build ya lo transpila e incluye en el bundle de `quinielas`).

- [ ] **Step 3: Commit**

```bash
git add src/modules/quinielas/services/quinielasService.js
git commit -m "Agrega obtenerPronosticosDeQuiniela para leer los propios pronósticos de una entrada"
```

---

### Task 3: `MisQuinielas.vue` — tabla de posiciones condicionada + toggle de pronósticos de los demás

**Files:**
- Modify: `src/modules/quinielas/views/MisQuinielas.vue`

**Interfaces:**
- Consumes: `obtenerPartidos(jornadaId)` (ya existe en `quinielasService.js`, usada hoy por `LlenarQuiniela.vue`).

- [ ] **Step 1: Imports**

Localizar:

```js
<script setup>
import { ref, onMounted } from 'vue';
import { obtenerMisQuinielas, obtenerRanking, obtenerJornadaActiva } from '../services/quinielasService';
import { calcularResumenBalance } from '../utils/balance';
import TablaPosiciones from '../components/TablaPosiciones.vue';
```

Reemplazar por:

```js
<script setup>
import { computed, ref, onMounted } from 'vue';
import { supabase } from '@/lib/supabase';
import { obtenerMisQuinielas, obtenerRanking, obtenerJornadaActiva, obtenerPartidos } from '../services/quinielasService';
import { calcularResumenBalance } from '../utils/balance';
import TablaPosiciones from '../components/TablaPosiciones.vue';
```

- [ ] **Step 2: Estado y `cargar()`**

Localizar:

```js
const quinielas = ref([]);
const resumen = ref(null);
const jornadaActivaId = ref(null);

async function cargar() {
  quinielas.value = await obtenerMisQuinielas();
  resumen.value = calcularResumenBalance(quinielas.value);
  const jornadaActiva = await obtenerJornadaActiva();
  jornadaActivaId.value = jornadaActiva?.id ?? null;
}
```

Reemplazar por:

```js
const quinielas = ref([]);
const resumen = ref(null);
const jornadaActiva = ref(null);
const partidosJornadaActiva = ref([]);

async function cargar() {
  quinielas.value = await obtenerMisQuinielas();
  resumen.value = calcularResumenBalance(quinielas.value);
  jornadaActiva.value = await obtenerJornadaActiva();
  partidosJornadaActiva.value = jornadaActiva.value ? await obtenerPartidos(jornadaActiva.value.id) : [];
}

const jornadaActivaId = computed(() => jornadaActiva.value?.id ?? null);
const tengoEntradaEnJornadaActiva = computed(() => quinielas.value.some((q) => q.jornada_id === jornadaActivaId.value));
const bloqueada = computed(() => jornadaActiva.value && new Date(jornadaActiva.value.fecha_cierre) <= new Date());
const empezaronPartidos = computed(() => partidosJornadaActiva.value.some((p) => new Date(p.fecha_partido) <= new Date()));
const mostrarDestacados = computed(() => bloqueada.value || empezaronPartidos.value);

async function obtenerPronosticosPublicos(quinielaId) {
  const { data, error: queryError } = await supabase
    .from('vista_pronosticos_publicos')
    .select('partido_id, pronostico')
    .eq('jornada_id', jornadaActivaId.value)
    .eq('quiniela_id', quinielaId);
  if (queryError) throw queryError;
  const porPartido = new Map((data ?? []).map((item) => [item.partido_id, item.pronostico]));
  return partidosJornadaActiva.value.map((partido) => ({
    partido_id: partido.id,
    equipo_local: partido.equipo_local,
    equipo_visitante: partido.equipo_visitante,
    logo_local: partido.logo_local,
    logo_visitante: partido.logo_visitante,
    pronostico: porPartido.get(partido.id),
  }));
}
```

- [ ] **Step 3: Gatear la tabla de posiciones y pasarle los props nuevos**

Localizar (en el `<template>`, al final):

```html
    <div v-if="jornadaActivaId">
      <h2 class="font-semibold text-quiniela-verde mb-2">Tabla de posiciones</h2>
      <TablaPosiciones :jornadaId="jornadaActivaId" :obtenerRankingFn="obtenerRanking" />
    </div>
```

Reemplazar por:

```html
    <div v-if="jornadaActivaId && tengoEntradaEnJornadaActiva">
      <h2 class="font-semibold text-quiniela-verde mb-2">Tabla de posiciones</h2>
      <TablaPosiciones :jornadaId="jornadaActivaId" :obtenerRankingFn="obtenerRanking" :obtenerPronosticosFn="obtenerPronosticosPublicos" :bloqueada="bloqueada" :resaltarExtremos="mostrarDestacados" />
    </div>
```

- [ ] **Step 4: Compilar y correr toda la suite**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build && npm test`
Expected: build sin errores; todos los tests existentes pasan.

- [ ] **Step 5: Commit**

```bash
git add src/modules/quinielas/views/MisQuinielas.vue
git commit -m "MisQuinielas solo muestra la tabla de posiciones si el usuario ya se registró, y agrega el toggle de pronósticos de los demás"
```

---

### Task 4: `MisQuinielas.vue` — botón "Ver pronósticos" en cada entrada propia

**Files:**
- Modify: `src/modules/quinielas/views/MisQuinielas.vue`

**Interfaces:**
- Consumes: `DetallePronosticos` (Tarea 1), `obtenerPronosticosDeQuiniela` (Tarea 2).

- [ ] **Step 1: Import y estado nuevo**

Localizar:

```js
import { computed, ref, onMounted } from 'vue';
import { supabase } from '@/lib/supabase';
import { obtenerMisQuinielas, obtenerRanking, obtenerJornadaActiva, obtenerPartidos } from '../services/quinielasService';
import { calcularResumenBalance } from '../utils/balance';
import TablaPosiciones from '../components/TablaPosiciones.vue';
```

Reemplazar por:

```js
import { computed, ref, onMounted } from 'vue';
import { supabase } from '@/lib/supabase';
import { obtenerMisQuinielas, obtenerRanking, obtenerJornadaActiva, obtenerPartidos, obtenerPronosticosDeQuiniela } from '../services/quinielasService';
import { calcularResumenBalance } from '../utils/balance';
import TablaPosiciones from '../components/TablaPosiciones.vue';
import DetallePronosticos from '../components/DetallePronosticos.vue';
```

Localizar:

```js
const quinielas = ref([]);
const resumen = ref(null);
const jornadaActiva = ref(null);
const partidosJornadaActiva = ref([]);
```

Reemplazar por:

```js
const quinielas = ref([]);
const resumen = ref(null);
const jornadaActiva = ref(null);
const partidosJornadaActiva = ref([]);
const abiertaEntrada = ref(null);
const detallesEntrada = ref({});
const cargandoEntrada = ref(null);
const errorEntrada = ref({});

async function alternarDetalleEntrada(quiniela) {
  if (abiertaEntrada.value === quiniela.id) {
    abiertaEntrada.value = null;
    return;
  }
  abiertaEntrada.value = quiniela.id;
  if (detallesEntrada.value[quiniela.id]) return;
  cargandoEntrada.value = quiniela.id;
  try {
    detallesEntrada.value[quiniela.id] = await obtenerPronosticosDeQuiniela(quiniela.id);
  } catch (error) {
    errorEntrada.value[quiniela.id] = error.message;
  } finally {
    cargandoEntrada.value = null;
  }
}
```

- [ ] **Step 2: Botón y detalle en la tarjeta móvil**

Localizar:

```html
    <div v-if="quinielas.length" class="grid gap-3 sm:hidden">
      <article v-for="q in quinielas" :key="q.id" class="rounded-2xl bg-white p-4 shadow-sm"><div class="flex items-start justify-between gap-3"><div><p class="font-bold text-quiniela-verdeOscuro">{{ q.alias }}</p><p class="text-sm text-gray-500">{{ q.jornadas?.nombre }}</p></div><span class="rounded-full px-2 py-1 text-xs font-bold" :class="q.estatus_pago === 'aprobado' ? 'bg-green-100 text-green-800' : q.estatus_pago === 'rechazado' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'">{{ q.estatus_pago === 'aprobado' ? 'Pagada' : q.estatus_pago === 'rechazado' ? 'Cancelada' : 'Pendiente' }}</span></div><p v-if="q.estatus_pago !== 'aprobado'" class="mt-2 text-xs text-amber-700">No estás participando todavía — falta confirmar tu pago.</p><p class="mt-4 border-t pt-3 text-sm"><span class="text-gray-500">Aciertos:</span> <strong class="text-quiniela-verde">{{ q.aciertos }}</strong></p></article>
    </div>
```

Reemplazar por:

```html
    <div v-if="quinielas.length" class="grid gap-3 sm:hidden">
      <article v-for="q in quinielas" :key="q.id" class="rounded-2xl bg-white p-4 shadow-sm">
        <div class="flex items-start justify-between gap-3"><div><p class="font-bold text-quiniela-verdeOscuro">{{ q.alias }}</p><p class="text-sm text-gray-500">{{ q.jornadas?.nombre }}</p></div><span class="rounded-full px-2 py-1 text-xs font-bold" :class="q.estatus_pago === 'aprobado' ? 'bg-green-100 text-green-800' : q.estatus_pago === 'rechazado' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'">{{ q.estatus_pago === 'aprobado' ? 'Pagada' : q.estatus_pago === 'rechazado' ? 'Cancelada' : 'Pendiente' }}</span></div>
        <p v-if="q.estatus_pago !== 'aprobado'" class="mt-2 text-xs text-amber-700">No estás participando todavía — falta confirmar tu pago.</p>
        <p class="mt-4 border-t pt-3 text-sm"><span class="text-gray-500">Aciertos:</span> <strong class="text-quiniela-verde">{{ q.aciertos }}</strong></p>
        <button type="button" @click="alternarDetalleEntrada(q)" class="mt-3 w-full rounded-lg border border-gray-200 py-2 text-xs font-semibold text-quiniela-verde">{{ abiertaEntrada === q.id ? 'Ocultar' : 'Ver pronósticos' }}</button>
        <div v-if="abiertaEntrada === q.id" class="mt-3 border-t pt-3">
          <p v-if="cargandoEntrada === q.id" class="text-center text-sm text-gray-500">Cargando pronósticos…</p>
          <p v-else-if="errorEntrada[q.id]" class="text-center text-sm text-red-600">{{ errorEntrada[q.id] }}</p>
          <DetallePronosticos v-else :items="detallesEntrada[q.id]" />
        </div>
      </article>
    </div>
```

- [ ] **Step 3: Botón y detalle en la tabla de escritorio**

Localizar:

```html
    <div v-if="quinielas.length" class="hidden overflow-x-auto sm:block">
      <table class="w-full bg-white rounded-lg shadow overflow-hidden">
        <thead class="bg-quiniela-verdeOscuro text-white">
          <tr>
            <th class="px-4 py-2 text-left">Jornada</th>
            <th class="px-4 py-2 text-left">Entrada</th>
            <th class="px-4 py-2 text-left">Pago</th>
            <th class="px-4 py-2 text-right">Aciertos</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="q in quinielas" :key="q.id" class="border-b">
            <td class="px-4 py-2">{{ q.jornadas?.nombre }}</td>
            <td class="px-4 py-2">{{ q.alias }}</td>
            <td class="px-4 py-2">{{ q.estatus_pago === 'aprobado' ? 'Pagada' : q.estatus_pago === 'rechazado' ? 'Cancelada' : 'Pendiente' }}<span v-if="q.estatus_pago !== 'aprobado'" class="ml-2 text-xs text-amber-700">(no participa todavía)</span></td>
            <td class="px-4 py-2 text-right">{{ q.aciertos }}</td>
          </tr>
        </tbody>
      </table>
    </div>
```

Reemplazar por:

```html
    <div v-if="quinielas.length" class="hidden overflow-x-auto sm:block">
      <table class="w-full bg-white rounded-lg shadow overflow-hidden">
        <thead class="bg-quiniela-verdeOscuro text-white">
          <tr>
            <th class="px-4 py-2 text-left">Jornada</th>
            <th class="px-4 py-2 text-left">Entrada</th>
            <th class="px-4 py-2 text-left">Pago</th>
            <th class="px-4 py-2 text-right">Aciertos</th>
            <th class="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="q in quinielas" :key="q.id">
            <tr class="border-b">
              <td class="px-4 py-2">{{ q.jornadas?.nombre }}</td>
              <td class="px-4 py-2">{{ q.alias }}</td>
              <td class="px-4 py-2">{{ q.estatus_pago === 'aprobado' ? 'Pagada' : q.estatus_pago === 'rechazado' ? 'Cancelada' : 'Pendiente' }}<span v-if="q.estatus_pago !== 'aprobado'" class="ml-2 text-xs text-amber-700">(no participa todavía)</span></td>
              <td class="px-4 py-2 text-right">{{ q.aciertos }}</td>
              <td class="px-4 py-2 text-right"><button type="button" @click="alternarDetalleEntrada(q)" class="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-quiniela-verde">{{ abiertaEntrada === q.id ? 'Ocultar' : 'Ver pronósticos' }}</button></td>
            </tr>
            <tr v-if="abiertaEntrada === q.id" class="border-b bg-gray-50">
              <td colspan="5" class="p-4">
                <p v-if="cargandoEntrada === q.id" class="text-center text-sm text-gray-500">Cargando pronósticos…</p>
                <p v-else-if="errorEntrada[q.id]" class="text-center text-sm text-red-600">{{ errorEntrada[q.id] }}</p>
                <DetallePronosticos v-else :items="detallesEntrada[q.id]" />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
```

(Nota: `<tr v-for>` se cambia por `<template v-for>` envolviendo la fila normal y la fila de detalle, porque una tabla HTML no permite una segunda fila condicional dentro del mismo `<tr>` — es el patrón estándar de Vue para "filas expandibles".)

- [ ] **Step 4: Compilar y correr toda la suite**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build && npm test`
Expected: build sin errores; todos los tests existentes pasan.

- [ ] **Step 5: Commit**

```bash
git add src/modules/quinielas/views/MisQuinielas.vue
git commit -m "MisQuinielas agrega botón para ver los pronósticos propios de cada entrada, con marca de acierto/fallo"
```

---

## Cierre del plan

Al terminar la Tarea 4, el controller corre `npm run build && npm test` sobre toda la rama, dispatcha la revisión final de rama completa, y hace una verificación en vivo (`vercel dev` o producción) del checklist "Pruebas a cubrir" del spec (`docs/superpowers/specs/2026-09-09-mis-quinielas-design.md`): usuario sin entrada en la jornada activa no ve la tabla; usuario con entrada sí la ve, con el toggle apareciendo solo después del cierre/inicio de partidos; el botón "Ver pronósticos" de una entrada propia funciona en cualquier momento y marca ✓/✗ correctamente; y que `TablaPosiciones.vue` se ve igual que antes en `TablaPublica.vue` (sin regresión visual). Este es el quinto y último subsistema de la sesión — al fusionar a `main`, se cierra la lista completa de observaciones de producción.
