# Vista pública de resultados: ocultar premio y destacados hasta que corresponda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En la tabla pública de resultados, ocultar el monto del premio hasta que cierre el registro, y ocultar el resaltado amarillo/rojo (quién va ganando el premio / el cupón "Por tarugo") hasta que cierre el registro o ya haya arrancado el primer partido, lo que pase primero.

**Architecture:** Todo el cambio vive en un solo archivo (`src/modules/publico/views/TablaPublica.vue`). Dos computeds nuevos (`empezaronPartidos`, `mostrarDestacados`) se derivan de datos que el componente ya carga (`partidos.value`, `bloqueada`); no se toca `TablaPosiciones.vue` ni ninguna consulta a Supabase.

**Tech Stack:** Vue 3 (`<script setup>`), Tailwind.

## Global Constraints

- Solo se modifica `src/modules/publico/views/TablaPublica.vue`. No se toca `TablaPosiciones.vue`, `MisQuinielas.vue`, ni ninguna consulta a Supabase — `partidos.value` ya trae `fecha_partido` de los 9 partidos vía `select('*')`.
- "Ya empezaron los partidos" = al menos uno de los 9 partidos tiene `fecha_partido` en el pasado (no hace falta que todos hayan empezado, ni que tengan `resultado_oficial`).
- El resaltado se muestra si `bloqueada` **O** `empezaronPartidos` (basta cualquiera de las dos).
- Cuando el premio está oculto, se muestra el texto "Se revela al cierre del registro" en su lugar (la etiqueta "Premio" se queda visible).
- Este proyecto no tiene infraestructura de pruebas de componentes Vue (no hay `@vue/test-utils`/`jsdom`). La verificación de cada tarea es `npm run build` (compila) + una verificación manual en `npm run dev` contra datos reales — no se agregan tests automatizados en este plan.

---

### Task 1: Ocultar el premio hasta que cierre el registro

**Files:**
- Modify: `src/modules/publico/views/TablaPublica.vue`

**Interfaces:** Ninguna nueva — usa el computed `bloqueada` que ya existe en este archivo (`computed(() => jornada.value && new Date(jornada.value.fecha_cierre) <= new Date())`).

- [ ] **Step 1: Reemplazar el bloque del premio en el header**

Localizar en la plantilla:

```html
      <div class="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
        <span class="text-sm text-green-100">Premio</span>
        <strong class="text-xl text-quiniela-dorado">{{ formatoMoneda(jornada?.premio) }}</strong>
      </div>
```

Reemplazar por:

```html
      <div class="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
        <span class="text-sm text-green-100">Premio</span>
        <strong v-if="bloqueada" class="text-xl text-quiniela-dorado">{{ formatoMoneda(jornada?.premio) }}</strong>
        <span v-else class="text-sm italic text-green-100">Se revela al cierre del registro</span>
      </div>
```

- [ ] **Step 2: Verificación manual**

Run: `npm run dev`.

1. Abrir `/publico/<jornadaId>` de una jornada **con registro abierto** → el header muestra "Premio" + "Se revela al cierre del registro", sin ningún monto.
2. Abrir `/publico/<jornadaId>` de una jornada **con registro cerrado o finalizada** → el header muestra "Premio" + el monto real, como hoy.

- [ ] **Step 3: Compilar**

Run: `npm run build`
Expected: build sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/modules/publico/views/TablaPublica.vue
git commit -m "Oculta el monto del premio en la tabla pública hasta que cierre el registro"
```

---

### Task 2: Ocultar "quién va ganando"/"quién va ganando el cupón" hasta que corresponda

**Files:**
- Modify: `src/modules/publico/views/TablaPublica.vue`

**Interfaces:**
- Consumes: `bloqueada` (ya existe), `partidos` (ref ya existente, ya trae `fecha_partido` de los 9 partidos vía `select('*')` en `cargar()`).
- Produces: computed `mostrarDestacados` — no lo consume ninguna otra tarea de este plan, solo se usa dentro de este mismo archivo para el prop `resaltarExtremos` de `<TablaPosiciones>`.

- [ ] **Step 1: Agregar los dos computeds nuevos**

Localizar en el `<script setup>`:

```js
const bloqueada = computed(() => jornada.value && new Date(jornada.value.fecha_cierre) <= new Date());
```

Agregar inmediatamente después (sin quitar la línea anterior):

```js
const bloqueada = computed(() => jornada.value && new Date(jornada.value.fecha_cierre) <= new Date());
const empezaronPartidos = computed(() => partidos.value.some((p) => new Date(p.fecha_partido) <= new Date()));
const mostrarDestacados = computed(() => bloqueada.value || empezaronPartidos.value);
```

- [ ] **Step 2: Usar el nuevo computed en `<TablaPosiciones>`**

Localizar en la plantilla:

```html
      <TablaPosiciones ref="tablaPosiciones" :jornadaId="jornadaId" :obtenerRankingFn="obtenerRankingPublico" :obtenerPronosticosFn="obtenerPronosticosPublicos" :bloqueada="bloqueada" resaltarExtremos />
```

Reemplazar el atributo estático `resaltarExtremos` por el binding al computed (el resto de la línea no cambia):

```html
      <TablaPosiciones ref="tablaPosiciones" :jornadaId="jornadaId" :obtenerRankingFn="obtenerRankingPublico" :obtenerPronosticosFn="obtenerPronosticosPublicos" :bloqueada="bloqueada" :resaltarExtremos="mostrarDestacados" />
```

- [ ] **Step 3: Verificación manual**

Run: `npm run dev`.

1. Jornada con registro **abierto** y **ningún** partido arrancado todavía (todos los `fecha_partido` en el futuro): la tabla de posiciones aparece, pero **sin** el resaltado amarillo/rojo ni la leyenda de "Va ganando"/"Por tarugo" (eso lo controla internamente `TablaPosiciones.vue` según el prop que recibe).
2. Jornada con registro **cerrado** (`bloqueada`): resaltado y leyenda visibles, igual que antes de este cambio.
3. Si es posible probarlo (jornada con registro abierto pero algún `fecha_partido` ya en el pasado): resaltado visible aunque el registro siga técnicamente abierto.

- [ ] **Step 4: Compilar y correr toda la suite**

Run: `npm run build && npm test`
Expected: build sin errores; todos los tests existentes pasan (ninguno de este plan agrega tests nuevos).

- [ ] **Step 5: Commit**

```bash
git add src/modules/publico/views/TablaPublica.vue
git commit -m "Oculta el resaltado de ganadores en la tabla pública hasta que cierre el registro o empiecen los partidos"
```

---

## Cierre del plan

Al terminar la Tarea 2, el checklist "Pruebas a cubrir" del spec (`docs/superpowers/specs/2026-09-09-vista-publica-resultados-design.md`) queda cubierto. El controller hace una verificación final en vivo (`npm run dev` o producción) antes de mergear a `main`, siguiendo el mismo flujo del resto de esta sesión.
