# Equipos y escudos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evitar llamadas repetidas a TheSportsDB por equipos ya vistos (vía una caché en Supabase), y mostrar el escudo del equipo en los tres lugares de la app donde falta hoy.

**Architecture:** Un helper compartido (`api/_lib/football/equiposCache.js`) centraliza la normalización de nombre y el acceso a una tabla nueva `equipos_cache`. `api/teams.js` la consulta primero (y solo llama a TheSportsDB si no hay resultado); `api/fixtures.js` solo la alimenta, sin cambiar su propia lógica de búsqueda. En el frontend, tres vistas que ya tienen o pueden tener el dato de logo en su query simplemente le agregan el `<img>` que ya usa `TarjetaPartido.vue` como referencia visual.

**Tech Stack:** Vue 3 (`<script setup>`), Vercel serverless functions (Node, ESM), Supabase (Postgres + RLS), Vitest.

## Global Constraints

- La caché vive en una tabla nueva de Supabase (`equipos_cache`), solo accesible para admin (RLS con `es_admin()`, sin grant a `anon`).
- `api/teams.js` (búsqueda manual) **lee y escribe** la caché; `api/fixtures.js` (búsqueda por liga) **solo escribe/alimenta**, nunca lee de ella.
- Si la caché tiene algún resultado para el término buscado en `api/teams.js`, se regresa eso y **no** se llama a TheSportsDB — no se combinan resultados de caché + API en una misma respuesta.
- Guardar en caché es siempre best-effort: un fallo al guardar (`guardarEnCache`) nunca debe tumbar la respuesta del endpoint que la llama.
- No se toca `EquipoAutocomplete.vue`, `api/_lib/football/theSportsDb.js` ni `api/_lib/football/provider.js` — el cambio es transparente para esos archivos.
- No se agrega expiración/invalidación de caché.
- Este proyecto no tiene infraestructura de pruebas de componentes Vue (no hay `@vue/test-utils`/`jsdom`) ni de mocking de Supabase para funciones serverless con I/O real. El patrón ya establecido en `tests/unit/` es probar solo funciones puras con tests reales (ver `tests/unit/thesportsdb-provider.test.js`, que importa directo de `api/_lib/football/theSportsDb.js`); las funciones con I/O (`buscarEnCache`, `guardarEnCache`, y los propios handlers de `api/teams.js`/`api/fixtures.js`) se verifican con `node --check <archivo>` (sintaxis) y, al final de todas las tareas, con una verificación manual en vivo contra producción (la hace el controller, no cada implementador) — igual que se hizo en el plan anterior de esta sesión.
- Los cambios de plantilla en `.vue` se verifican con `npm run build` (falla si hay un error de compilación) — no hay tests automatizados de UI en este proyecto.

---

### Task 1: Migración `0018_equipos_cache.sql`

**Files:**
- Create: `supabase/migrations/0018_equipos_cache.sql`

**Interfaces:**
- Produces: tabla `equipos_cache` con columnas `id, nombre, nombre_normalizado (UNIQUE), logo, id_externo, actualizado_el`. Las tareas siguientes (2, 3, 4) dependen de este esquema exacto.

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/0018_equipos_cache.sql
CREATE TABLE equipos_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  nombre_normalizado TEXT NOT NULL UNIQUE,  -- lower(trim(nombre)); clave del upsert y de la búsqueda
  logo TEXT,
  id_externo TEXT,                          -- idTeam de TheSportsDB, cuando venga de búsqueda manual (nullable)
  actualizado_el TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_equipos_cache_normalizado ON equipos_cache (nombre_normalizado);

ALTER TABLE equipos_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "solo admin usa equipos_cache" ON equipos_cache FOR ALL TO authenticated
  USING (es_admin()) WITH CHECK (es_admin());
```

- [ ] **Step 2: No se aplica en este paso**

Esta migración **no** se ejecuta contra producción como parte de esta tarea — igual que las migraciones anteriores de esta sesión, el archivo se entrega para que el humano la corra desde el SQL Editor de Supabase cuando quiera. No hay "test" para un archivo `.sql` que no se ejecuta aquí; el paso de verificación es que el archivo exista y su sintaxis sea SQL válido a simple vista (revisarlo, no ejecutarlo).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0018_equipos_cache.sql
git commit -m "Agrega tabla equipos_cache para evitar consultas repetidas a TheSportsDB"
```

---

### Task 2: Helper `api/_lib/football/equiposCache.js`

**Files:**
- Create: `api/_lib/football/equiposCache.js`
- Test: `tests/unit/equiposCache.test.js`

**Interfaces:**
- Consumes: `getSupabaseAdmin()` de `api/_lib/supabaseAdmin.js` (ya existe, sin cambios: `createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)`, cacheado en un singleton del módulo).
- Produces: `normalizarNombreEquipo(nombre: string): string`, `buscarEnCache(termino: string): Promise<Array<{id_externo, nombre, logo}>>`, `guardarEnCache(equipos: Array<{id?, name, logo?}>): Promise<void>`. Las Tareas 3 y 4 importan estas tres funciones tal cual.

- [ ] **Step 1: Escribir el test de la única función pura de este módulo (debe fallar, el archivo no existe)**

```js
// tests/unit/equiposCache.test.js
import { describe, expect, it } from 'vitest';
import { normalizarNombreEquipo } from '../../api/_lib/football/equiposCache.js';

describe('normalizarNombreEquipo', () => {
  it('recorta espacios y pasa a minúsculas', () => {
    expect(normalizarNombreEquipo('  Club América  ')).toBe('club américa');
  });

  it('produce el mismo resultado sin importar mayúsculas/espacios de entrada', () => {
    expect(normalizarNombreEquipo('CRUZ AZUL')).toBe(normalizarNombreEquipo('  cruz azul  '));
  });
});
```

`buscarEnCache` y `guardarEnCache` no se prueban con un test automatizado en esta tarea — son funciones con I/O real contra Supabase, y este proyecto no tiene infraestructura para mockear eso (ver Global Constraints). Se verifican en vivo más adelante.

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx vitest run tests/unit/equiposCache.test.js`
Expected: FAIL — no se puede resolver el módulo `../../api/_lib/football/equiposCache.js` (el archivo no existe).

- [ ] **Step 3: Crear el helper**

```js
// api/_lib/football/equiposCache.js
import { getSupabaseAdmin } from '../supabaseAdmin.js';

export function normalizarNombreEquipo(nombre) {
  return nombre.trim().toLowerCase();
}

export async function buscarEnCache(termino) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from('equipos_cache')
    .select('id_externo, nombre, logo')
    .ilike('nombre_normalizado', `%${normalizarNombreEquipo(termino)}%`)
    .limit(10);
  if (error) throw error;
  return data ?? [];
}

export async function guardarEnCache(equipos) {
  const supabaseAdmin = getSupabaseAdmin();
  const filas = equipos
    .filter((e) => e?.name)
    .map((e) => ({
      nombre: e.name,
      nombre_normalizado: normalizarNombreEquipo(e.name),
      logo: e.logo ?? null,
      id_externo: e.id ? String(e.id) : null,
    }));
  if (!filas.length) return;
  try {
    await supabaseAdmin.from('equipos_cache').upsert(filas, { onConflict: 'nombre_normalizado' });
  } catch (e) {
    console.error('equiposCache: falló guardarEnCache', e.message);
  }
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx vitest run tests/unit/equiposCache.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Verificar sintaxis del nuevo archivo y correr toda la suite**

Run: `node --check api/_lib/football/equiposCache.js && npm test`
Expected: sin errores de sintaxis; los 25 tests pasan (23 existentes + 2 nuevos).

- [ ] **Step 6: Commit**

```bash
git add api/_lib/football/equiposCache.js tests/unit/equiposCache.test.js
git commit -m "Agrega helper equiposCache con normalización, búsqueda y guardado best-effort"
```

---

### Task 3: `api/teams.js` — leer la caché antes de llamar a TheSportsDB

**Files:**
- Modify: `api/teams.js` (reemplazo completo)

**Interfaces:**
- Consumes: `buscarEnCache(termino)`, `guardarEnCache(equipos)` de `api/_lib/football/equiposCache.js` (Task 2).

- [ ] **Step 1: Reemplazar el contenido completo de `api/teams.js`**

```js
import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { buscarEnCache, guardarEnCache } from './_lib/football/equiposCache.js';

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
    const search = String(req.query.search ?? '').trim();
    if (search.length < 2 || search.length > 80) return res.status(400).json({ error: 'Escribe al menos 2 caracteres' });

    const desdeCache = await buscarEnCache(search);
    if (desdeCache.length) {
      return res.status(200).json({ teams: desdeCache.map((e) => ({ id: e.id_externo, name: e.nombre, logo: e.logo })) });
    }

    const key = process.env.SPORTSDB_API_KEY || '123';
    const response = await fetch(`https://www.thesportsdb.com/api/v1/json/${key}/searchteams.php?t=${encodeURIComponent(search)}`);
    if (!response.ok) throw new Error(`TheSportsDB respondió ${response.status}`);
    const payload = await response.json();
    const teams = (payload.teams ?? [])
      .filter((team) => !team.strSport || team.strSport === 'Soccer')
      .map((team) => ({ id: String(team.idTeam), name: team.strTeam, logo: team.strBadge || team.strTeamBadge || null }))
      .slice(0, 10);

    await guardarEnCache(teams);
    return res.status(200).json({ teams });
  } catch (error) {
    const status = error instanceof ErrorHttp ? error.status : 500;
    return res.status(status).json({ error: error.message });
  }
}
```

- [ ] **Step 2: Verificar sintaxis y correr la suite**

Run: `node --check api/teams.js && npm test`
Expected: sin errores de sintaxis; los 25 tests pasan.

- [ ] **Step 3: Commit**

```bash
git add api/teams.js
git commit -m "api/teams.js busca primero en equipos_cache antes de llamar a TheSportsDB"
```

---

### Task 4: `api/fixtures.js` — alimentar la caché con los equipos encontrados

**Files:**
- Modify: `api/fixtures.js`

**Interfaces:**
- Consumes: `guardarEnCache(equipos)` de `api/_lib/football/equiposCache.js` (Task 2).

- [ ] **Step 1: Agregar el import**

En `api/fixtures.js`, la línea 1-3 hoy son:

```js
import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { findFixtures, seasonForDate } from './_lib/football/provider.js';
import { LIGAS } from './_lib/ligas.js';
```

Reemplazar por:

```js
import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { findFixtures, seasonForDate } from './_lib/football/provider.js';
import { LIGAS } from './_lib/ligas.js';
import { guardarEnCache } from './_lib/football/equiposCache.js';
```

- [ ] **Step 2: Alimentar la caché antes de responder**

Localizar (al final del handler):

```js
    results.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
    return res.status(200).json({ fixtures: results });
```

Reemplazar por:

```js
    results.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
    await guardarEnCache(results.flatMap((f) => [f.teams.home, f.teams.away]));
    return res.status(200).json({ fixtures: results });
```

- [ ] **Step 3: Verificar sintaxis y correr la suite**

Run: `node --check api/fixtures.js && npm test`
Expected: sin errores de sintaxis; los 25 tests pasan.

- [ ] **Step 4: Commit**

```bash
git add api/fixtures.js
git commit -m "api/fixtures.js alimenta equipos_cache con los equipos de cada búsqueda por liga"
```

---

### Task 5: Escudos en `SincronizarResultados.vue`

**Files:**
- Modify: `src/modules/admin/views/SincronizarResultados.vue`

**Interfaces:** Ninguna nueva — usa las columnas `logo_local`/`logo_visitante` que ya existen en `partidos` desde que se creó cada jornada.

- [ ] **Step 1: Agregar las columnas de logo a la consulta**

Localizar (dentro de `abrirJornada`):

```js
  const { data, error: queryError } = await supabase.from('partidos').select('id, liga_nombre, equipo_local, equipo_visitante, fecha_partido, resultado_oficial, provider').eq('jornada_id', jornada.id).order('fecha_partido');
```

Reemplazar por:

```js
  const { data, error: queryError } = await supabase.from('partidos').select('id, liga_nombre, equipo_local, equipo_visitante, logo_local, logo_visitante, fecha_partido, resultado_oficial, provider').eq('jornada_id', jornada.id).order('fecha_partido');
```

- [ ] **Step 2: Mostrar los escudos en la plantilla**

Localizar:

```html
          <p class="mb-4 text-center font-bold text-quiniela-verdeOscuro">{{ partido.equipo_local }} <span class="mx-2 text-gray-400">vs</span> {{ partido.equipo_visitante }}</p>
```

Reemplazar por (mismo patrón visual que ya usa `src/modules/quinielas/components/TarjetaPartido.vue`: escudo si existe, círculo gris si no):

```html
          <div class="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <div><img v-if="partido.logo_local" :src="partido.logo_local" alt="" class="mx-auto mb-2 h-10 w-10 object-contain" /><div v-else class="mx-auto mb-2 h-10 w-10 rounded-full bg-gray-100"></div><p class="text-sm font-bold text-quiniela-verdeOscuro">{{ partido.equipo_local }}</p></div>
            <span class="text-xs font-bold text-gray-400">VS</span>
            <div><img v-if="partido.logo_visitante" :src="partido.logo_visitante" alt="" class="mx-auto mb-2 h-10 w-10 object-contain" /><div v-else class="mx-auto mb-2 h-10 w-10 rounded-full bg-gray-100"></div><p class="text-sm font-bold text-quiniela-verdeOscuro">{{ partido.equipo_visitante }}</p></div>
          </div>
```

- [ ] **Step 3: Compilar**

Run: `npm run build`
Expected: build sin errores. (Verificación visual real —con una jornada que tenga escudos guardados— la hace el controller al final, contra producción o `npm run dev`.)

- [ ] **Step 4: Commit**

```bash
git add src/modules/admin/views/SincronizarResultados.vue
git commit -m "SincronizarResultados muestra el escudo de cada equipo"
```

---

### Task 6: Escudos en `TablaPublica.vue` ("Resultados al momento" y detalle de pronósticos)

**Files:**
- Modify: `src/modules/publico/views/TablaPublica.vue`

**Interfaces:** `obtenerPronosticosPublicos` pasa a incluir `logo_local`/`logo_visitante` en cada objeto que arma — la Tarea 7 (`TablaPosiciones.vue`) depende de que estos dos campos vengan en cada `detalle`.

- [ ] **Step 1: Agregar los logos al detalle de pronósticos**

Localizar (dentro de `obtenerPronosticosPublicos`):

```js
  return partidos.value.map((partido) => ({
    partido_id: partido.id,
    equipo_local: partido.equipo_local,
    equipo_visitante: partido.equipo_visitante,
    pronostico: porPartido.get(partido.id),
  }));
```

Reemplazar por:

```js
  return partidos.value.map((partido) => ({
    partido_id: partido.id,
    equipo_local: partido.equipo_local,
    equipo_visitante: partido.equipo_visitante,
    logo_local: partido.logo_local,
    logo_visitante: partido.logo_visitante,
    pronostico: porPartido.get(partido.id),
  }));
```

(`partidos.value` ya trae `logo_local`/`logo_visitante` porque su query usa `select('*')` — no hace falta tocar esa consulta.)

- [ ] **Step 2: Mostrar los escudos en "Resultados al momento"**

Localizar:

```html
          <p class="text-center font-bold text-quiniela-verdeOscuro">{{ p.equipo_local }} <span class="mx-2 text-gray-400">vs</span> {{ p.equipo_visitante }}</p>
```

Reemplazar por:

```html
          <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <div><img v-if="p.logo_local" :src="p.logo_local" alt="" class="mx-auto mb-2 h-10 w-10 object-contain" /><div v-else class="mx-auto mb-2 h-10 w-10 rounded-full bg-gray-100"></div><p class="text-sm font-bold text-quiniela-verdeOscuro">{{ p.equipo_local }}</p></div>
            <span class="text-xs font-bold text-gray-400">VS</span>
            <div><img v-if="p.logo_visitante" :src="p.logo_visitante" alt="" class="mx-auto mb-2 h-10 w-10 object-contain" /><div v-else class="mx-auto mb-2 h-10 w-10 rounded-full bg-gray-100"></div><p class="text-sm font-bold text-quiniela-verdeOscuro">{{ p.equipo_visitante }}</p></div>
          </div>
```

- [ ] **Step 3: Compilar**

Run: `npm run build`
Expected: build sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/modules/publico/views/TablaPublica.vue
git commit -m "TablaPublica muestra escudos en Resultados al momento y los pasa al detalle de pronósticos"
```

---

### Task 7: Escudos en el detalle de "ver pronósticos de X" (`TablaPosiciones.vue`)

**Files:**
- Modify: `src/modules/quinielas/components/TablaPosiciones.vue`

**Interfaces:**
- Consumes: `detalle.logo_local`/`detalle.logo_visitante`, ya provistos por `obtenerPronosticosPublicos` (Task 6). Este componente no valida su presencia — si vienen `undefined` (por ejemplo si algún consumidor futuro no los manda), simplemente no se muestra el `<img>` (mismo patrón `v-if` que en las demás tareas).

- [ ] **Step 1: Agregar los escudos a cada fila del detalle**

Localizar:

```html
            <div class="min-w-0"><span class="text-xs text-gray-400">{{ index + 1 }}</span><p class="truncate font-semibold">{{ detalle.equipo_local }} vs {{ detalle.equipo_visitante }}</p></div>
```

Reemplazar por:

```html
            <div class="flex min-w-0 items-center gap-1.5">
              <span class="text-xs text-gray-400">{{ index + 1 }}</span>
              <img v-if="detalle.logo_local" :src="detalle.logo_local" alt="" class="h-5 w-5 shrink-0 object-contain" />
              <p class="truncate font-semibold">{{ detalle.equipo_local }} vs {{ detalle.equipo_visitante }}</p>
              <img v-if="detalle.logo_visitante" :src="detalle.logo_visitante" alt="" class="h-5 w-5 shrink-0 object-contain" />
            </div>
```

- [ ] **Step 2: Compilar y correr toda la suite**

Run: `npm run build && npm test`
Expected: build sin errores; los 25 tests pasan.

- [ ] **Step 3: Verificación manual completa (checklist de la spec)**

Esta verificación la hace el controller (no este task), después de que las 7 tareas estén implementadas, contra `npm run dev` o producción:
1. Buscar un equipo nuevo en `EquipoAutocomplete` (Crear jornada → Agregar partido manual) → confirma que llama a TheSportsDB y que el equipo queda guardado en `equipos_cache`.
2. Buscar ese mismo equipo de nuevo → confirma que responde desde la caché (por ejemplo, interceptando la llamada de red a `thesportsdb.com` y viendo que no se repite).
3. Buscar partidos por liga en "Crear jornada" → confirma que los equipos encontrados quedan en `equipos_cache`.
4. Ver una jornada con resultados en "Resultados de partidos" (admin) → aparecen los escudos.
5. Ver la tabla pública de una jornada con partidos → "Resultados al momento" muestra escudos, y el detalle de "ver pronósticos de X" (con el registro ya cerrado) también.

- [ ] **Step 4: Commit**

```bash
git add src/modules/quinielas/components/TablaPosiciones.vue
git commit -m "TablaPosiciones muestra escudos en el detalle de pronósticos de cada participante"
```

---

## Cierre del plan

Al terminar la Tarea 7, el controller aplica la migración de la Tarea 1 (o pide al humano que la aplique en Supabase) y corre el checklist de verificación manual de la Tarea 7 contra `npm run dev` o producción antes de dar el plan por terminado. Push a `main` después, siguiendo el mismo flujo usado en el resto de esta sesión.
