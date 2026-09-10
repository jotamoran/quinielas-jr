# Mis quinielas (tabla condicionada, ver pronósticos de los demás, ver mis pronósticos)

## Contexto

Quinta y última de cinco sub-mejoras solicitadas tras probar la app en producción (las cuatro primeras — autenticación, equipos/escudos, vista pública, administración de jornadas — ya están en `main`). Tres pedidos sobre "Mis quinielas" (`src/modules/quinielas/views/MisQuinielas.vue`):

1. Solo mostrar la tabla de posiciones si el usuario ya se registró en la jornada activa.
2. Agregar el toggle "ver pronósticos de los demás" una vez cerrado el registro, igual que ya existe en la tabla pública (`TablaPublica.vue`).
3. Agregar un botón para ver los pronósticos que uno mismo guardó en cada una de sus entradas.

## Decisiones confirmadas (de la sesión de brainstorming)

- El gateo del punto 1 es solo sobre la jornada activa que ya se muestra hoy (una sola tabla) — no se agrega historial de jornadas pasadas en las que el usuario participó.
- El punto 2 replica el comportamiento completo de `TablaPublica.vue`: `bloqueada`, `resaltarExtremos` (con su leyenda ámbar/rojo) y el toggle de pronósticos — no una versión reducida.
- El punto 3 aplica a todas las entradas del usuario sin importar el estatus de pago o el estatus de la jornada (activa, cerrada o finalizada), y marca cada pronóstico con ✓ (acertó) / ✗ (falló) cuando el partido ya tiene `resultado_oficial`; sin marca si todavía no lo tiene.

## Investigación previa (ya confirmada, no repetir)

- `MisQuinielas.vue` hoy llama `obtenerJornadaActiva()` y solo se queda con el `id`; siempre muestra `<TablaPosiciones :jornadaId="jornadaActivaId" :obtenerRankingFn="obtenerRanking" />` sin pasar `obtenerPronosticosFn`, `bloqueada` ni `resaltarExtremos` — por eso hoy no tiene ni el toggle ni el resaltado que sí tiene `TablaPublica.vue`.
- `TablaPosiciones.vue` ya soporta los tres props (`obtenerPronosticosFn`, `bloqueada`, `resaltarExtremos`) — no requiere cambios de props, ya está listo para recibir lo mismo que ya le pasa `TablaPublica.vue`.
- `vista_pronosticos_publicos` (creada en `0015_cierre_y_pronosticos_publicos.sql`) ya tiene `GRANT SELECT ... TO anon, authenticated` y su condición `WHERE q.estatus_pago = 'aprobado' AND j.fecha_cierre <= NOW()` — se puede reutilizar tal cual desde `MisQuinielas.vue`, mismo patrón que usa `TablaPublica.vue`.
- La política RLS `"ver predicciones propias o admin"` (`0010_rls.sql`) ya permite a un usuario autenticado leer sus propias filas de `predicciones` en cualquier momento (sin depender de `fecha_cierre`) — el punto 3 no necesita ninguna vista ni migración nueva, es una consulta directa a `predicciones` + `partidos`.
- `obtenerMisQuinielas()` filtra por `usuario_id = auth.uid()`, así que las entradas presenciales con `usuario_id = null` (creadas por un admin) nunca aparecen en "Mis quinielas" — el punto 3 no necesita ningún caso especial para ellas.
- `vista_ranking_jornada` (de la que depende `obtenerRanking()`) ya expone `quiniela_id`, requerido por el toggle interno de `TablaPosiciones.vue` — no requiere cambios.
- El grid de detalle de pronósticos que hoy vive inline dentro de `TablaPosiciones.vue` (líneas ~102-112: índice, logos, nombres de equipo, badge de pronóstico) es visualmente el mismo elemento que necesita el punto 3, con el agregado de marcar acierto/fallo — se extrae a un componente compartido en vez de duplicar el markup.

## Diseño

### Componente compartido: `src/modules/quinielas/components/DetallePronosticos.vue` (nuevo)

Recibe un único prop:
```js
items: { type: Array, required: true }
// cada item: { partido_id, equipo_local, equipo_visitante, logo_local, logo_visitante, pronostico, resultado_oficial? }
```

Renderiza el mismo grid que hoy está inline en `TablaPosiciones.vue` (índice, logos, "equipo_local vs equipo_visitante", badge de pronóstico). Diferencia de comportamiento: si `item.resultado_oficial` está definido (no `undefined`/`null`), el badge del pronóstico cambia de estilo:
- `resultado_oficial === pronostico` → badge verde con ✓ (acertó).
- `resultado_oficial !== pronostico` → badge rojo con ✗ (falló).
- Si `resultado_oficial` es `null`/`undefined` (partido sin resultado aún, o el llamador no lo pasa) → badge neutro actual (fondo verde claro, sin ✓/✗), idéntico al comportamiento de hoy.

Incluye la función `etiquetaPronostico(valor)` (movida desde `TablaPosiciones.vue`, sin cambios: `{ L: 'Local', E: 'Empate', V: 'Visita' }[valor] ?? valor`).

### `src/modules/quinielas/components/TablaPosiciones.vue`

Se reemplaza el grid inline (dentro de `<div v-if="abiertaId === fila.quiniela_id">`) por:
```html
<DetallePronosticos v-if="detalles[fila.quiniela_id]" :items="detalles[fila.quiniela_id]" />
```
(los estados de carga/error que ya existen — `cargandoDetalle`, `errorDetalle` — no cambian, siguen renderizando su propio mensaje antes de este componente). Se elimina `etiquetaPronostico` de este archivo (se mueve al componente nuevo) y se agrega el `import DetallePronosticos from './DetallePronosticos.vue'`. Ningún prop de `TablaPosiciones.vue` cambia — `TablaPublica.vue` sigue usándolo exactamente igual que hoy.

### `src/modules/quinielas/services/quinielasService.js`

Nueva función:
```js
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
(el `sort` corre antes del `.map`, sobre los objetos crudos que todavía traen `item.partidos.fecha_partido`, para no perder el dato antes de usarlo).

### `src/modules/quinielas/views/MisQuinielas.vue`

**Estado y carga:**
```js
const jornadaActiva = ref(null);
const partidosJornadaActiva = ref([]);
```
reemplaza al actual `jornadaActivaId = ref(null)`. En `cargar()`:
```js
async function cargar() {
  quinielas.value = await obtenerMisQuinielas();
  resumen.value = calcularResumenBalance(quinielas.value);
  jornadaActiva.value = await obtenerJornadaActiva();
  partidosJornadaActiva.value = jornadaActiva.value ? await obtenerPartidos(jornadaActiva.value.id) : [];
}
```
(`obtenerPartidos` ya existe y se importa desde el mismo `quinielasService.js`).

**Computeds nuevos** (mismo patrón que `TablaPublica.vue`):
```js
const jornadaActivaId = computed(() => jornadaActiva.value?.id ?? null);
const tengoEntradaEnJornadaActiva = computed(() => quinielas.value.some((q) => q.jornada_id === jornadaActivaId.value));
const bloqueada = computed(() => jornadaActiva.value && new Date(jornadaActiva.value.fecha_cierre) <= new Date());
const empezaronPartidos = computed(() => partidosJornadaActiva.value.some((p) => new Date(p.fecha_partido) <= new Date()));
const mostrarDestacados = computed(() => bloqueada.value || empezaronPartidos.value);
```

**Función local** (mismo patrón que la ya existente en `TablaPublica.vue`):
```js
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
Requiere `import { supabase } from '@/lib/supabase'` (nuevo import en este archivo).

**Tabla de posiciones**, se cambia:
```html
<div v-if="jornadaActivaId">
  <h2 class="font-semibold text-quiniela-verde mb-2">Tabla de posiciones</h2>
  <TablaPosiciones :jornadaId="jornadaActivaId" :obtenerRankingFn="obtenerRanking" />
</div>
```
por:
```html
<div v-if="jornadaActivaId && tengoEntradaEnJornadaActiva">
  <h2 class="font-semibold text-quiniela-verde mb-2">Tabla de posiciones</h2>
  <TablaPosiciones :jornadaId="jornadaActivaId" :obtenerRankingFn="obtenerRanking" :obtenerPronosticosFn="obtenerPronosticosPublicos" :bloqueada="bloqueada" :resaltarExtremos="mostrarDestacados" />
</div>
```

**Botón "Pronósticos" por entrada propia** (lista de arriba). Nuevo estado local:
```js
const abiertaEntrada = ref(null);
const detallesEntrada = ref({});
const cargandoEntrada = ref(null);
const errorEntrada = ref({});

async function alternarDetalleEntrada(quiniela) {
  if (abiertaEntrada.value === quiniela.id) { abiertaEntrada.value = null; return; }
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

En la tarjeta móvil de cada entrada (dentro del `v-for="q in quinielas"` ya existente), se agrega debajo del contenido actual:
```html
<button type="button" @click="alternarDetalleEntrada(q)" class="mt-3 w-full rounded-lg border border-gray-200 py-2 text-xs font-semibold text-quiniela-verde">{{ abiertaEntrada === q.id ? 'Ocultar' : 'Ver pronósticos' }}</button>
<div v-if="abiertaEntrada === q.id" class="mt-3 border-t pt-3">
  <p v-if="cargandoEntrada === q.id" class="text-center text-sm text-gray-500">Cargando pronósticos…</p>
  <p v-else-if="errorEntrada[q.id]" class="text-center text-sm text-red-600">{{ errorEntrada[q.id] }}</p>
  <DetallePronosticos v-else :items="detallesEntrada[q.id]" />
</div>
```

En la tabla de escritorio, se agrega una quinta columna con el botón, y una fila adicional expandible con `colspan="5"`:
```html
<th class="px-4 py-2 text-right">Aciertos</th>
<th class="px-4 py-2"></th>
```
```html
<tr v-for="q in quinielas" :key="q.id">
  <td colspan="4" class="...">...</td> <!-- columnas existentes, sin cambio -->
  <td class="px-4 py-2 text-right"><button type="button" @click="alternarDetalleEntrada(q)" class="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-quiniela-verde">{{ abiertaEntrada === q.id ? 'Ocultar' : 'Ver pronósticos' }}</button></td>
</tr>
<tr v-if="abiertaEntrada === q.id" :key="`${q.id}-detalle`" class="border-b bg-gray-50">
  <td colspan="5" class="p-4">
    <p v-if="cargandoEntrada === q.id" class="text-center text-sm text-gray-500">Cargando pronósticos…</p>
    <p v-else-if="errorEntrada[q.id]" class="text-center text-sm text-red-600">{{ errorEntrada[q.id] }}</p>
    <DetallePronosticos v-else :items="detallesEntrada[q.id]" />
  </td>
</tr>
```
(el plan de implementación trae el markup exacto completo de ambas tablas, con todas las columnas actuales incluidas, no solo el diff).

Se agrega `import DetallePronosticos from '../components/DetallePronosticos.vue'` y `import { obtenerPronosticosDeQuiniela } from '../services/quinielasService'` (junto a los imports ya existentes de ese archivo).

## Fuera de alcance (confirmado explícitamente)

- No se agrega historial de jornadas pasadas con su propia tabla de posiciones — solo se gatea la que ya existe para la jornada activa.
- No se agrega ninguna vista ni migración nueva — todo se resuelve con vistas/políticas RLS que ya existen.
- No se modifica `TablaPublica.vue` — sigue usando su propia función local `obtenerPronosticosPublicos` sin cambios (no se unifica con la de `MisQuinielas.vue`, que es un duplicado intencional del mismo patrón, no una dependencia cruzada de módulos).

## Pruebas a cubrir

- Usuario sin ninguna entrada en la jornada activa: no aparece la sección "Tabla de posiciones".
- Usuario con una entrada (aprobada o no) en la jornada activa: aparece la tabla de posiciones; antes del cierre del registro y antes de que empiece cualquier partido, no se ve el botón "Pronósticos" de los demás ni el resaltado ámbar/rojo; después del cierre (o si ya empezó algún partido) sí aparecen ambos, igual que en `TablaPublica.vue`.
- Botón "Ver pronósticos" de una entrada propia en la lista de arriba: funciona en cualquier momento (jornada activa, cerrada o finalizada), sin importar el estatus de pago; muestra ✓/✗ en los partidos que ya tienen `resultado_oficial`, sin marca en los que no; funciona igual en la vista móvil (tarjetas) y de escritorio (tabla).
- `TablaPosiciones.vue` se ve exactamente igual que antes de este cambio tanto en `TablaPublica.vue` como en la propia "Tabla de posiciones" de `MisQuinielas.vue` (no hay regresión visual tras extraer `DetallePronosticos.vue`).
