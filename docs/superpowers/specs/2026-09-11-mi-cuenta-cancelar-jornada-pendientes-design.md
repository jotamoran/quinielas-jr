# Mi cuenta, cancelar jornada completa, y pendientes elegidos

## Contexto

Tres pedidos nuevos más una limpieza de backlog, agrupados en un solo spec (mismo patrón que los anteriores de esta sesión):

1. Un apartado "Mi cuenta" donde cualquier usuario logueado pueda cambiar su nombre, correo (con verificación) y contraseña.
2. Poder cancelar una jornada completa desde "Ver jornadas" (`AdministrarJornadas.vue`) — por error al crearla o porque ya no se quiere jugar — avisando por correo a quien ya tuviera una entrada.
3. Resolver 4 de los hallazgos documentados en `docs/PENDIENTES.md`.

## Decisiones confirmadas (de la sesión de brainstorming)

- "Mi cuenta" es para **cualquier usuario logueado**, no solo el admin.
- Cancelar una jornada completa se permite **mientras no esté `finalizada`** (borrador, activa o después de cerrado el registro esperando resultados) — igual que la regla ya usada para cancelar un partido individual.
- Al cancelar, se **avisa por correo** a cada participante que ya tuviera una entrada (por cuenta o por `correo_contacto` si es presencial) — sin automatizar ningún reembolso, eso lo maneja el admin por fuera.
- De los pendientes, se resuelven: el loop de `notificarAdmin` sin aislar por admin, la validación de `numeroJornada` como entero positivo, la distinción de mensajes en `Registro.vue` (formato inválido vs. ya tomado), y una mitigación (no verificable en vivo todavía) para cuando Apertura y Clausura compartan el mismo string de temporada en TheSportsDB. El rate-limiting por IP compartida de Vercel se deja fuera, como ya estaba documentado.

## Investigación previa (ya confirmada, no repetir)

- `perfiles` RLS ya permite `UPDATE` de la propia fila (`"update solo propio" ON perfiles FOR UPDATE ... USING (id = auth.uid())`) — cambiar el nombre no necesita ningún endpoint nuevo, solo un `update` directo desde el cliente.
- Cambiar correo/contraseña de la propia cuenta ya autenticada se hace con `supabase.auth.updateUser({ email })` / `supabase.auth.updateUser({ password })` — son llamadas nativas del SDK, no necesitan endpoint propio. El cambio de correo no aplica hasta que se confirma el enlace que Supabase manda a la nueva dirección (comportamiento estándar, ya usa el mismo SMTP de Brevo que el resto de la app).
- `jornadas.estatus` tiene un `CHECK` (`jornadas_estatus_check`, de la migración `0013`) limitado a `('borrador', 'activa', 'cerrada', 'finalizada')` — cancelar una jornada necesita agregar `'cancelada'` a ese catálogo. En la práctica el código de la app nunca escribe `'cerrada'` (es un valor del enum sin uso real hoy); los estatus que sí se usan son `'borrador'` → `'activa'` → `'finalizada'` (este último vía `api/cerrar-jornada.js`).
- El trigger `validar_nueve_partidos_antes_de_publicar` (migración `0013`) solo valida al entrar a `'activa'` — no interfiere con salir de `'activa'` hacia `'cancelada'`.
- Cancelar una jornada **no** debe llamar `calcular_puntos()` ni la lógica de premios/cupón — a diferencia de cerrar una jornada, cancelar significa "esto no cuenta para nada", no "ya hay resultados que repartir".
- El patrón ya establecido para notificaciones best-effort (`api/cerrar-jornada.js`, `api/notificaciones/registro.js`) es: la acción principal (cambiar el estatus) se hace primero y de forma garantizada; el envío de correos es best-effort con un `try/catch` que junta avisos en un arreglo, sin abortar la respuesta si algún correo falla.
- `TablaPublica.vue` ya trae `estatus` en su consulta a `vista_jornada_publica` (`select('nombre, premio, fecha_cierre, estatus')`) pero hoy no lo usa para nada — mostrar un aviso de "cancelada" ahí es solo agregar el `<p v-if>`, sin tocar la consulta.
- `api/fixtures.js`'s validación de `numeroJornada` hoy es simplemente `if (numeroJornada)` (cualquier string truthy pasa) — no valida que sea un entero positivo.
- `Registro.vue` ya normaliza el username a minúsculas y tiene el `pattern` HTML del input, pero la función `onSubmit` llama a `usernameDisponible()` sin validar antes si el formato es correcto — un username con formato inválido que de alguna forma llegue a `onSubmit` (ej. pegado, o si el navegador no aplica `pattern`) recibe el mismo mensaje "ya está en uso" que uno realmente tomado.
- `getFixtures`'s rama de `round` (agregada en el plan anterior) no tiene ningún límite en la cantidad de eventos que regresa — hoy Liga MX solo tiene el torneo Apertura en curso, así que nunca ha regresado más de 9; no se puede probar en vivo el caso de Apertura+Clausura compartiendo temporada porque el Clausura no ha empezado.

## Diseño

### 1) Mi cuenta

**Migración:** ninguna — `perfiles.nombre_completo` ya existe, y correo/contraseña se manejan con la API nativa de Supabase Auth.

**`src/modules/auth/services/authService.js`:** tres funciones nuevas:
```js
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

**`src/modules/auth/views/MiCuenta.vue`** (nuevo): tres formularios independientes (nombre, correo, contraseña), cada uno con su propio estado de carga/error/éxito, siguiendo el patrón visual ya usado en `Registro.vue`/`Login.vue` (labels con `form-label`/`form-control`, `role="alert"` en errores). Precarga el nombre actual desde `authStore.perfil.nombre_completo` y el correo actual desde `authStore.user.email` (sin editar el campo de correo actual, solo mostrarlo como referencia arriba del campo de "nuevo correo"). Después de guardar el nombre, llama `authStore.cargarPerfil()` para refrescar el store. El formulario de correo muestra un mensaje de éxito indicando que hay que confirmar el cambio desde el correo nuevo (el correo mostrado en pantalla no cambia hasta que se confirma). El formulario de contraseña pide la nueva contraseña dos veces (validación de que coincidan antes de enviar) y usa `minlength="6"` igual que `Registro.vue`.

**`src/modules/auth/router.js`:** nueva ruta:
```js
{ path: '/mi-cuenta', name: 'mi-cuenta', component: () => import('./views/MiCuenta.vue'), meta: { requiresAuth: true } },
```

**`src/components/NavbarComponent.vue`:** un link "Mi cuenta" junto a "Mis quinielas"/"Jugar" en el menú de escritorio, y dentro de la sección "Mi cuenta" que ya existe en el menú móvil (hoy es solo un encabezado de texto, sin enlace).

### 2) Cancelar jornada completa

**Migración `supabase/migrations/0023_cancelar_jornada.sql`:**
```sql
ALTER TABLE jornadas DROP CONSTRAINT jornadas_estatus_check;
ALTER TABLE jornadas ADD CONSTRAINT jornadas_estatus_check
  CHECK (estatus IN ('borrador', 'activa', 'cerrada', 'finalizada', 'cancelada'));
```

**Endpoint nuevo `api/cancelar-jornada.js`** (mismo patrón que `api/cerrar-jornada.js`): recibe `{ jornada_id }`, requiere admin. Verifica que la jornada exista y que su estatus no sea `'finalizada'` ni `'cancelada'` (409 si lo es); actualiza el estatus a `'cancelada'` con un `.neq('estatus', 'finalizada').neq('estatus', 'cancelada')` como guarda extra contra condiciones de carrera (mismo patrón que `cerrar-jornada.js` usa para su propio guard de doble-cierre). Después, junta las `quinielas` de esa jornada (`usuario_id, alias, correo_contacto`) y manda un correo best-effort a cada una — resolviendo el correo real vía `auth.admin.getUserById` cuando hay `usuario_id`, o usando `correo_contacto` directo para las presenciales — igual que ya hace `notificarAdmin` en `api/notificaciones/registro.js`. Responde `{ status: 'ok', avisos: [...] }` si algún correo falló, sin que eso afecte que la jornada sí quedó cancelada.

**`src/modules/admin/services/adminService.js`:** nueva función `cancelarJornada(jornadaId)` que llama al endpoint nuevo vía `llamarApi`.

**`src/modules/admin/views/AdministrarJornadas.vue`:** nuevo botón "Cancelar jornada" (rojo, con `confirmarAccion({danger: true})` advirtiendo que se les avisará por correo a quienes ya se registraron), visible cuando `abierta.estatus !== 'finalizada' && abierta.estatus !== 'cancelada'`. Al confirmar, llama `cancelarJornada`, actualiza `abierta.estatus` localmente y recarga la lista de jornadas (para que el badge de estatus se actualice en el panel izquierdo también).

**`src/modules/publico/views/TablaPublica.vue`:** si `jornada.estatus === 'cancelada'`, se muestra un aviso rojo (ej. "Esta jornada fue cancelada") en vez de/junto al badge de "Registro abierto/cerrado" existente.

### 3) Pendientes elegidos

**`api/notificaciones/registro.js`, `notificarAdmin`:** el `try/catch` que hoy envuelve toda la llamada (`notificarAdmin(...)`) se mantiene, pero adentro de `notificarAdmin` cada envío individual (dentro del `for`) gana su propio `try/catch` con `console.error`, para que un admin cuyo correo falle no le impida el aviso a los demás.

**`api/fixtures.js`:** el chequeo `if (numeroJornada)` se refuerza con una validación de que sea un entero positivo (`/^\d+$/.test(numeroJornada)`), regresando 400 con un mensaje claro si no lo es.

**`src/modules/auth/views/Registro.vue`:** antes de llamar a `usernameDisponible()`, se valida el formato con el mismo patrón del input (`/^[a-z0-9_]{3,20}$/`); si no cumple, se muestra "El nombre de usuario debe tener de 3 a 20 caracteres, solo minúsculas, números y guión bajo." sin llegar a consultar el servidor.

**`api/_lib/football/theSportsDb.js`, `getFixtures`:** en la rama de `round`, si `eventsround.php` regresa más de 9 eventos (señal de que la temporada de TheSportsDB está agrupando más de un torneo bajo el mismo string, como podría pasar con Apertura+Clausura de Liga MX), se conservan los 9 eventos cuya fecha está más cerca de hoy, y se regresan ordenados cronológicamente. Con 9 o menos eventos (el caso de hoy, verificado en vivo) el comportamiento no cambia. Se deja documentado en el código y en `docs/PENDIENTES.md` que esta mitigación no se ha podido probar en vivo porque el Clausura no ha empezado.

## Fuera de alcance (confirmado explícitamente)

- No se automatiza ningún reembolso al cancelar una jornada — lo maneja el admin por fuera, como ya pasa con los pagos en efectivo.
- No se agrega la posibilidad de "reactivar" una jornada cancelada (a diferencia de cancelar un partido individual, que sí es reversible) — si fue un error, se crea una jornada nueva.
- El apartado "Mi cuenta" no incluye cambiar el username (no se pidió) ni eliminar la cuenta.
- No se toca el rate-limiting por IP compartida de Vercel documentado en `docs/PENDIENTES.md` — sigue fuera hasta que se decida una mitigación segura.
- No se generaliza la búsqueda por jornada/ronda a las otras 9 ligas configuradas (ya estaba fuera de alcance del plan anterior).

## Pruebas a cubrir

- Cambiar el nombre desde "Mi cuenta": se refleja de inmediato (el store se recarga).
- Cambiar el correo: llega un correo de confirmación a la dirección nueva; el correo mostrado en la app no cambia hasta confirmar.
- Cambiar la contraseña: cerrar sesión e iniciar con la nueva funciona; la vieja ya no.
- Cancelar una jornada `'activa'` con entradas ya registradas (web y presencial): el estatus cambia a `'cancelada'`, cada participante recibe un correo, y ya no se puede volver a cancelar ni cerrar esa misma jornada.
- Intentar cancelar una jornada ya `'finalizada'`: la API regresa 409 y el botón no debería estar visible.
- Visitar la tabla pública de una jornada cancelada: se ve el aviso de cancelada.
- `notificarAdmin` con dos cuentas admin donde la primera falla: la segunda sí recibe su correo.
- `api/fixtures.js` con `numeroJornada=abc` o `numeroJornada=-1`: 400 con mensaje claro.
- Registro con un username de formato inválido (ej. con mayúsculas o símbolos que burlen el `pattern` del input): mensaje de formato, no de "ya está en uso", y sin llamar al servidor.
