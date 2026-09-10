# Administración de jornadas (compartir registro, sin fechas pasadas, cancelar partido)

## Contexto

Cuarta de cinco sub-mejoras solicitadas tras probar la app en producción (las tres primeras — autenticación, equipos/escudos, vista pública — ya están en `main`). Tres pedidos sobre la administración de jornadas:

1. Que "Copiar enlace" comparta el link de **registro**, no el de resultados.
2. No permitir fechas pasadas al crear/editar una jornada.
3. Poder cancelar/inhabilitar un partido para que no cuente en la quiniela de nadie.

## Decisiones confirmadas (de la sesión de brainstorming)

- Un partido se puede cancelar **en cualquier momento mientras la jornada no esté finalizada** (antes o después de cerrado el registro) — cubre el caso real de partidos pospuestos el mismo día.
- La cancelación **es reversible** (botón interruptor "Cancelar partido" / "Reactivar partido").
- Quien se registre después de que un partido ya esté cancelado **no necesita pronosticarlo** — su quiniela queda completa con los partidos activos restantes (si la jornada tiene 9 y uno está cancelado, con 8 pronósticos basta).

## Investigación previa (ya confirmada, no repetir)

- `TarjetaPartido.vue` es el único componente que renderiza los botones Local/Empate/Visita, usado tanto por `LlenarQuiniela.vue` (registro web) como por `EdicionManual.vue` (registro presencial) — el cambio de "mostrar Cancelado en vez de los botones" se hace una sola vez ahí y beneficia a los dos flujos.
- `calcular_puntos()` (función SQL, `0008_calcular_puntos.sql`) solo cuenta partidos con `resultado_oficial = pronostico`; no valida ningún total de 9 en ningún lado de la base de datos — un partido cancelado simplemente se excluye de ese `COUNT`.
- **Hallazgo importante durante la investigación:** `api/cerrar-jornada.js` hoy bloquea el cierre de la jornada si **cualquier** partido no tiene `resultado_oficial` — un partido cancelado nunca va a tener resultado oficial, así que sin ajustar esta consulta, cancelar un partido **dejaría la jornada imposible de cerrar para siempre**. Se corrige como parte de este mismo cambio.
- `partidos.value` en `LlenarQuiniela.vue`, `EdicionManual.vue` y `TablaPublica.vue` ya usa `select('*')`, así que la columna nueva `cancelado` llega sola a esos tres sin tocar esas consultas. Los que sí usan listas explícitas de columnas y necesitan el campo agregado: `adminService.js` (`listarJornadasAdmin`, para `AdministrarJornadas.vue`) y `SincronizarResultados.vue`.
- Los checks de "exactamente 9" existen hoy en 3 lugares con roles distintos:
  - `LlenarQuiniela.vue` (`completo`) y `EdicionManual.vue` (`completas`): validan que el usuario ya pronosticó todos los partidos que le tocan — **estos sí cambian** (deben excluir los cancelados del conteo requerido).
  - `LlenarQuiniela.vue`'s `<p v-if="partidos.length !== 9">Esta jornada no contiene los 9 partidos requeridos.</p>`: valida la integridad de la jornada en sí (siempre debe tener 9 partidos creados, cancelados o no) — **este NO cambia**, sigue contando el total real de filas.
  - `api/admin-quinielas.js`: valida en el servidor que el número de pronósticos recibidos coincida con los partidos activos de la jornada — **cambia** de un `9` fijo a un conteo dinámico de partidos con `cancelado = false`.

## Diseño

### 1) "Copiar enlace" → "Compartir quiniela"

En `src/modules/admin/views/AdministrarJornadas.vue`, el botón que hoy dice **"Copiar enlace"** y solo copia al portapapeles el link de resultados (`copiarEnlace()`, vía `enlacePublico()` hacia `tabla-publica`) se reemplaza por un botón **"Compartir quiniela"** que apunta a `/llenar-quiniela` (registro) en vez de a resultados, y que **comparte** (usa `navigator.share` si está disponible, igual que ya hace "Compartir resultados"; si no, cae a copiar al portapapeles) en vez de solo copiar — coincide con el pedido original de "enviárselo a las personas para que se registren", que es una acción de compartir, no de copiar.

Concretamente: nueva función `compartirRegistro(jornada)` (mismo patrón que la ya existente `compartirEnlace()`, pero armando la URL con `router.resolve({ name: 'llenar-quiniela' })` en vez de `tabla-publica`, y con un texto acorde: `Regístrate en ${jornada.nombre}`). El botón "Copiar enlace" y su función `copiarEnlace()` se eliminan — ya no hacen falta, "Compartir quiniela" cubre el mismo caso de uso (compartir ya incluye copiar como respaldo cuando `navigator.share` no está disponible). Los tres botones quedan:
- "Compartir resultados" → sigue igual, enlace a resultados.
- "Compartir quiniela" (reemplaza a "Copiar enlace") → nuevo, comparte/copia el enlace a `/llenar-quiniela`.
- "Compartir imagen" → sigue igual.

### 2) No permitir fechas pasadas

Se agrega `:min` (la fecha de hoy, `YYYY-MM-DD`) a los inputs de fecha:
- `GestionJornadas.vue`: `desde`, `hasta` (búsqueda de partidos por liga), `partidoManual.fecha` (es `datetime-local`, así que el `min` lleva hora `T00:00`), `fechaCierre` (datos de la jornada).
- `AdministrarJornadas.vue`: `cierreEditado`.

Un computed `hoy` (o una constante calculada una vez al montar el componente) provee el valor para el atributo `:min` en cada archivo. Además de `min` (que ya evita seleccionarla con el date picker nativo), se agrega una validación en JS antes de enviar cada formulario, por si se pega una fecha a mano: si la fecha elegida es anterior a hoy, se muestra un error y no se continúa.

### 3) Cancelar/inhabilitar un partido

**Migración `supabase/migrations/0020_cancelar_partido.sql`:**

```sql
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

(la función se re-crea completa con `CREATE OR REPLACE`, agregando solo la condición `pa.cancelado = false`; el resto es idéntico a `0008_calcular_puntos.sql`).

**`api/cerrar-jornada.js`** (corrige el hallazgo de arriba): el conteo de resultados pendientes agrega `.eq('cancelado', false)`, para que un partido cancelado no bloquee el cierre:

```js
const { count: resultadosPendientes, error: errorResultados } = await supabaseAdmin
  .from('partidos')
  .select('id', { count: 'exact', head: true })
  .eq('jornada_id', jornada_id)
  .eq('cancelado', false)
  .is('resultado_oficial', null);
```

**`src/modules/admin/services/adminService.js`:**
- Agregar `cancelado` a la lista de columnas de `partidos(...)` en `listarJornadasAdmin()`.
- Nueva función `cancelarPartido(partidoId, cancelado)`: `UPDATE partidos SET cancelado = <valor> WHERE id = <partidoId>` (vía Supabase directo, misma RLS de admin que ya protege escritura en `partidos`, sin endpoint nuevo).

**`src/modules/admin/views/AdministrarJornadas.vue`:** en cada tarjeta de partido, un botón que alterna entre "Cancelar partido" (si `!partido.cancelado`) y "Reactivar partido" (si `partido.cancelado`), llama a `cancelarPartido` y actualiza el estado local del partido en `abierta.partidos` al resolver. Visible mientras la jornada no esté `finalizada`. Cada tarjeta de partido cancelado se marca visualmente (ej. una etiqueta roja "Cancelado" y el borde/fondo atenuado).

**`src/modules/quinielas/components/TarjetaPartido.vue`:** si `partido.cancelado`, en vez de los tres botones Local/Empate/Visita se muestra un aviso "Partido cancelado — no cuenta para tu quiniela" (mismo lugar donde irían los botones). No se emite `update:modelValue` para un partido cancelado.

**`src/modules/quinielas/views/LlenarQuiniela.vue`:** el computed `completo` solo exige pronóstico en los partidos con `!cancelado`:

```js
const partidosActivos = computed(() => partidos.value.filter((p) => !p.cancelado));
const completo = computed(() => partidosActivos.value.length > 0 && partidosActivos.value.every((partido) => pronosticos.value[partido.id]));
```

(el check existente `<p v-if="partidos.length !== 9">` no cambia, sigue usando `partidos.value.length`, el total real de la jornada).

**`src/modules/admin/views/EdicionManual.vue`:** mismo patrón para `completas`, y el texto del botón (`{{ Object.keys(pronosticos).length }} de 9`) pasa a usar el total de partidos activos en vez de un `9` fijo.

**`api/admin-quinielas.js`:** el POST deja de validar `predicciones.length !== 9` contra un número fijo; en su lugar consulta cuántos partidos de esa jornada tienen `cancelado = false` y valida contra ese número (y que ningún `partido_id` enviado corresponda a un partido cancelado).

**`src/modules/admin/views/SincronizarResultados.vue`:** agregar `cancelado` a su `select`. Un partido cancelado muestra una etiqueta "Cancelado" en vez de los botones Local/Empate/Visita para capturar resultado (no tiene sentido capturarle un resultado).

**`src/modules/publico/views/TablaPublica.vue`** ("Resultados al momento"): la etiqueta que hoy alterna entre "Finalizado"/"Pendiente" agrega un tercer estado "Cancelado" cuando `p.cancelado` es verdadero (con su propio color, ej. gris/rojo tenue), sin importar si tiene o no `resultado_oficial`.

## Fuera de alcance (confirmado explícitamente)

- No se agrega ninguna notificación automática a los participantes cuando se cancela un partido ya pronosticado por ellos — se enteran al ver la app.
- No se permite "editar" los datos de un partido cancelado (equipos, fecha) — cancelar es un interruptor aparte, no una edición.
- No se toca `api/sync-results.js` ni `api/manual-results.js` — un admin simplemente no captura resultado para un partido cancelado; si lo hiciera de todos modos, `calcular_puntos()` lo ignoraría igual gracias al filtro `cancelado = false`.
- No se agrega la posibilidad de cancelar un partido después de que la jornada esté `finalizada` (ya no tendría efecto en los puntajes, que ya están calculados y el premio ya se repartió).

## Pruebas a cubrir

- Cancelar un partido con el registro todavía abierto: en `LlenarQuiniela.vue` se ve "Cancelado" sin botones; alguien que se registre después completa su quiniela sin pronosticarlo.
- Cancelar un partido después de cerrado el registro (antes de capturar resultados): `SincronizarResultados.vue` lo muestra como "Cancelado", no pide resultado para él; `cerrar-jornada.js` no lo cuenta como resultado pendiente y permite cerrar la jornada con los otros 8 resueltos.
- Reactivar un partido cancelado por error: vuelve a pedir pronóstico en registros nuevos, y vuelve a contar para resultados pendientes en el cierre.
- `calcular_puntos()` no cuenta como acierto ningún pronóstico hecho sobre un partido cancelado, aunque por error se le haya capturado un `resultado_oficial`.
- "Copiar enlace" ahora comparte/copia la URL de `/llenar-quiniela`, no la de `/publico/:jornadaId`.
- Los selectores de fecha de "Crear jornada" y "Fecha límite de registro" no dejan elegir un día anterior a hoy, ni con el date picker ni pegando una fecha a mano.
