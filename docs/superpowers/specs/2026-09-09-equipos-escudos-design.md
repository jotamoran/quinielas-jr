# Equipos y escudos (caché + mostrar siempre que se pueda)

## Contexto

Segunda de cinco sub-mejoras solicitadas tras probar la app en producción (la primera, autenticación menos invasiva, ya está implementada y en `main`). Dos pedidos relacionados:

1. Evitar consultar la API externa (TheSportsDB) repetidamente por los mismos equipos.
2. Mostrar el escudo del equipo en cualquier lugar donde se muestre un partido, si el dato está disponible.

## Investigación previa (ya confirmada, no repetir)

- Una vez creada una jornada, los escudos ya quedan guardados directo en `partidos.logo_local` / `partidos.logo_visitante` — `TarjetaPartido.vue` y `AdministrarJornadas.vue` ya los muestran leyendo de base de datos, **sin** volver a llamar ninguna API. No hay nada que cachear ahí.
- El consumo real de API pasa solo **mientras se arma una jornada nueva**, en dos endpoints:
  - `api/fixtures.js` (buscar partidos por liga, vía `GestionJornadas.vue` → "Buscar partidos") — trae partidos nuevos que no existían antes; no tiene sentido cachear esto, debe seguir siendo fresco.
  - `api/teams.js` (buscar un equipo a mano, vía `EquipoAutocomplete.vue`, usado al agregar un partido manual) — aquí sí hay redundancia real: buscar el mismo equipo en jornadas distintas repite la llamada a TheSportsDB desde cero cada vez.
- Lugares donde falta mostrar el escudo aunque el dato ya esté disponible o casi disponible (solo texto hoy):
  - `src/modules/admin/views/SincronizarResultados.vue` — su query ni siquiera selecciona `logo_local`/`logo_visitante`.
  - `src/modules/publico/views/TablaPublica.vue`, sección "Resultados al momento" — el dato ya se trae (`select('*')`), solo falta el `<img>`.
  - `src/modules/quinielas/components/TablaPosiciones.vue`, detalle de "ver pronósticos de X" — depende de que `TablaPublica.vue` le pase los logos en el mapeo (`obtenerPronosticosPublicos`).

## Decisiones confirmadas

- El caché de equipos vive en una **tabla nueva de Supabase** (`equipos_cache`) — es la única forma de que sirva entre jornadas y sesiones distintas, ya que las funciones serverless de Vercel no tienen memoria propia entre invocaciones.
- La tabla se alimenta desde **ambos** endpoints: `api/teams.js` (búsqueda manual) y `api/fixtures.js` (búsqueda de partidos por liga) — así crece sola con el uso normal de la app, sin trabajo extra del admin.
- Solo `api/teams.js` **lee** de la caché (es el único de los dos que busca un equipo específico por nombre); `api/fixtures.js` solo escribe/alimenta.

## Diseño

### Migración: `supabase/migrations/0018_equipos_cache.sql`

```sql
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

Sin `GRANT` a `anon` — es una herramienta interna de administración, no dato público. `es_admin()` ya existe (`supabase/migrations/0002_helpers.sql`).

`nombre_normalizado` es `lower(trim(nombre))`, calculado en el código (no como columna generada de Postgres, para mantener la migración simple) antes de cada insert/upsert y antes de cada búsqueda.

### `api/_lib/football/equiposCache.js` (nuevo, helper compartido)

Un módulo chico compartido por `api/teams.js` y `api/fixtures.js`, para no duplicar la lógica de normalización/upsert:

```js
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
  // best-effort: si falla, no debe tumbar la respuesta del endpoint que llama
  try {
    await supabaseAdmin.from('equipos_cache').upsert(filas, { onConflict: 'nombre_normalizado' });
  } catch (e) {
    console.error('equiposCache: falló guardarEnCache', e.message);
  }
}
```

Nota: `api/_lib/supabaseAdmin.js` ya existe (usado por el resto de los endpoints admin) — se importa igual que en `api/admin-quinielas.js` u otros.

### `api/teams.js` (modificado)

Antes de llamar a TheSportsDB, intenta la caché primero:

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

Comportamiento: si la caché tiene **algún** resultado para el término buscado, se regresa eso y no se toca la API externa. Si la caché no tiene nada, se cae al comportamiento actual (llamar TheSportsDB) y de paso se guarda lo encontrado. No se combinan resultados de caché + API en la misma respuesta — mantiene la lógica simple y es exactamente lo que se pidió (evitar la llamada repetida cuando ya se conoce el equipo).

### `api/fixtures.js` (modificado)

Después de armar `results` (sin cambiar la lógica de búsqueda por liga), alimenta la caché en un solo lote antes de responder:

```js
import { guardarEnCache } from './_lib/football/equiposCache.js';
// ...dentro del handler, justo antes del `return res.status(200).json({ fixtures: results });`:
const equiposVistos = results.flatMap((f) => [f.teams.home, f.teams.away]);
await guardarEnCache(equiposVistos);
```

`guardarEnCache` ya es best-effort (atrapa su propio error), así que un fallo de la base de datos no puede tumbar la búsqueda de fixtures.

### Mostrar el escudo donde falta

**`src/modules/admin/views/SincronizarResultados.vue`:**
- En `abrirJornada()`, agregar `logo_local, logo_visitante` al `.select(...)` de partidos (hoy: `'id, liga_nombre, equipo_local, equipo_visitante, fecha_partido, resultado_oficial, provider'`).
- En la plantilla, dentro del `<article>` de cada partido, reemplazar el texto plano de equipos por el mismo patrón visual que ya usa `TarjetaPartido.vue` (logo si existe, círculo gris si no):

```html
<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
  <div><img v-if="partido.logo_local" :src="partido.logo_local" alt="" class="mx-auto mb-2 h-10 w-10 object-contain" /><div v-else class="mx-auto mb-2 h-10 w-10 rounded-full bg-gray-100"></div><p class="text-sm font-bold">{{ partido.equipo_local }}</p></div>
  <span class="text-xs font-bold text-gray-400">VS</span>
  <div><img v-if="partido.logo_visitante" :src="partido.logo_visitante" alt="" class="mx-auto mb-2 h-10 w-10 object-contain" /><div v-else class="mx-auto mb-2 h-10 w-10 rounded-full bg-gray-100"></div><p class="text-sm font-bold">{{ partido.equipo_visitante }}</p></div>
</div>
```
reemplazando el actual `<p class="mb-4 text-center font-bold ...">{{ partido.equipo_local }} vs {{ partido.equipo_visitante }}</p>`.

**`src/modules/publico/views/TablaPublica.vue`** ("Resultados al momento"): el `partidos` ref ya viene de `select('*')`, así que `p.logo_local`/`p.logo_visitante` ya existen. Se agrega el mismo patrón de `<img>`/círculo gris alrededor de la línea `<p class="text-center font-bold ...">{{ p.equipo_local }} vs {{ p.equipo_visitante }}</p>` dentro de cada `<article>` de partido.

**`obtenerPronosticosPublicos()`** (en el mismo archivo `TablaPublica.vue`): agregar `logo_local: partido.logo_local, logo_visitante: partido.logo_visitante` al objeto que arma por cada partido (hoy solo arma `partido_id, equipo_local, equipo_visitante, pronostico`).

**`src/modules/quinielas/components/TablaPosiciones.vue`** (detalle "ver pronósticos de X"): el `<div>` de cada partido en la lista de detalle agrega los mismos `<img>` chicos (usar el tamaño ya usado en ese detalle, p. ej. `h-8 w-8`) antes del nombre de cada equipo, junto a `{{ detalle.equipo_local }} vs {{ detalle.equipo_visitante }}`.

## Fuera de alcance

- No se toca `EquipoAutocomplete.vue` — el cambio de caché es transparente para el frontend, sigue llamando `/api/teams` igual que hoy y mostrando lo que reciba.
- No se agrega ningún mecanismo de expiración/invalidación de la caché (un escudo de equipo casi nunca cambia; si algún día cambia, un admin puede borrar la fila a mano en Supabase).
- No se modifica `api/_lib/football/theSportsDb.js` ni `provider.js` — la normalización de fixtures/equipos que ya hacen se queda igual, el caché se alimenta con su salida tal cual.
- No se agrega caché para la búsqueda de partidos por liga (`/api/fixtures`) del lado de lectura — solo escribe/alimenta la caché de equipos, sigue consultando TheSportsDB siempre para traer partidos frescos.

## Pruebas a cubrir

- Buscar un equipo nuevo (nunca antes visto) en `EquipoAutocomplete` → llama TheSportsDB, guarda en `equipos_cache`.
- Buscar ese mismo equipo de nuevo (misma sesión u otra) → responde desde la caché, sin llamar TheSportsDB (verificar con un log o interceptando la llamada de red).
- Buscar partidos por liga en `GestionJornadas.vue` → los equipos que aparecen quedan guardados/actualizados en `equipos_cache`, sin que la respuesta de fixtures se vea afectada si el guardado fallara.
- `SincronizarResultados.vue`, `TablaPublica.vue` ("Resultados al momento") y el detalle de pronósticos en `TablaPosiciones.vue` muestran el escudo cuando existe, y el círculo gris de placeholder cuando no.
- Jornadas ya creadas antes de este cambio (sin filas en `equipos_cache`) siguen funcionando igual — nada de esto depende de datos migrados retroactivamente.
