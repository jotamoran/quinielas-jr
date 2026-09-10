# Login por username, notificación al admin al registrar, búsqueda de partidos por ronda

## Contexto

Tres pedidos sueltos, agrupados en un solo spec porque son mejoras independientes de tamaño chico/mediano sobre flujos ya existentes (mismo patrón que "Administración de jornadas", que agrupó tres pedidos similares):

1. Que el registro también pida un nombre de usuario, y que el login acepte username o correo.
2. Que al admin le llegue un correo cuando alguien registra una quiniela.
3. Que se pueda buscar partidos por número de jornada/ronda de Liga MX, no solo por rango de fechas (surgió al crear "Jornada 8" a mano porque el buscador actual no la encontraba).

## Decisiones confirmadas (de la sesión de brainstorming)

- El login se resuelve con un **endpoint de servidor que hace todo el login** (recibe `{entrada, password}`, resuelve username→correo internamente y entrega la sesión ya lista) — nunca se expone el correo real de nadie al navegador, ni siquiera al dueño del username.
- El username es **obligatorio** al registrarse (no hay backfill de cuentas viejas porque hoy en producción solo existe la cuenta admin).
- Formato de username: **3-20 caracteres, `a-z0-9_`, siempre en minúsculas**.
- La cuenta admin recibe `username = 'admin'`, **reemplazando** el truco especial actual (`resolverCorreo()` + `VITE_ADMIN_ALIAS_EMAIL`) — un solo mecanismo para todos, sin casos aparte.
- La notificación al admin al registrar una quiniela **solo aplica a registros web** (`LlenarQuiniela.vue`) — los registros presenciales los hace el propio admin, no hace falta avisarle de algo que él mismo hizo.
- La búsqueda por ronda se implementa **solo para Liga MX** por ahora — es la única liga de las diez configuradas cuyo formato de temporada en TheSportsDB (`"2026-2027"`, verificado empíricamente) se confirmó; las demás quedan fuera de alcance hasta verificar cada una por separado.

## Investigación previa (ya confirmada, no repetir)

- `perfiles` tiene RLS `"select propio o admin"` (`0010_rls.sql`) — un visitante anónimo **no puede** consultar `perfiles` directamente desde el navegador. Por eso tanto la resolución de username→correo (login) como la verificación de disponibilidad (registro) necesitan pasar por un endpoint de servidor con la llave de servicio, no una consulta directa desde el cliente.
- `handle_new_user()` (trigger `AFTER INSERT ON auth.users`, `0001_perfiles.sql`) es el **único** lugar que inserta filas en `perfiles` — confirmado con una búsqueda completa del repo. Cualquier cambio de columnas obligatorias en `perfiles` solo necesita tocar esta función.
- `handle_new_user()` ya fue hardeneada en `0012_security_definer_search_path.sql` (`SET search_path = public, pg_temp`) — el `CREATE OR REPLACE FUNCTION` de este spec **debe conservar** esa cláusula (la migración 0020 de esta misma sesión se olvidó de hacerlo la primera vez con `calcular_puntos()` y el review final lo encontró; no se repite el error aquí).
- `api/notificaciones/registro.js` ya envía un correo de confirmación al participante cuando se registra una quiniela vía `LlenarQuiniela.vue` (que ya llama `notificarRegistro(quiniela.id)` después de crear la entrada) — es el punto de extensión natural para el correo al admin, no hace falta ningún gancho nuevo en el flujo de registro.
- `getFixtures({ league, from, to })` en `theSportsDb.js` llama a `eventsnextleague.php?id=<liga>` y filtra por fecha del lado del cliente — **en la llave de prueba gratuita (`123`), este endpoint solo regresa 1-2 eventos futuros**, confirmado en vivo (retornó un solo partido). `eventsround.php?id=<liga>&r=<ronda>&s=<temporada>` sí regresa la ronda completa (9 partidos verificados para Liga MX jornada 8), pero exige el formato de temporada exacto que usa TheSportsDB para esa liga — para Liga MX es `"AAAA-AAAA+1"` (ej. `"2026-2027"`), **no** el año simple que hoy produce `seasonForDate()` (que además hoy es un parámetro que `getFixtures` recibe pero nunca usa — confirmado leyendo el archivo completo).
- `LIGAS` (`api/_lib/ligas.js`) ya tiene un campo `seasonMode: 'calendar' | 'european'` que hoy no tiene ningún efecto real (no se usa en `getFixtures`) — no debe confundirse con el formato de temporada que necesita `eventsround.php`; son dos cosas distintas (`seasonMode` es una idea preexistente sin implementar aún, el formato de ronda es nuevo).

## Diseño

### 1) Registro y login con username

**Migración `supabase/migrations/0022_username.sql`:**

```sql
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

**Endpoint nuevo `api/auth/username-disponible.js`** (público, GET, sin sesión): recibe `?username=`, normaliza a minúsculas, valida el patrón `^[a-z0-9_]{3,20}$` (si no cumple, regresa `disponible: false` sin tocar la base), consulta `perfiles` con la llave de servicio y regresa `{ disponible: boolean }`.

**Endpoint nuevo `api/auth/iniciar-sesion.js`** (público, POST, sin sesión): recibe `{ entrada, password }`.
- Si `entrada` contiene `@`, se usa tal cual como correo.
- Si no, se normaliza a minúsculas y se busca en `perfiles.username` (llave de servicio) para obtener el `id`; con `supabaseAdmin.auth.admin.getUserById(id)` se obtiene el correo real. Si el username no existe, se regresa el mismo mensaje genérico que si la contraseña fuera incorrecta (no se delata si el username existe o no).
- Con el correo ya resuelto, se hace el login real llamando directamente al endpoint nativo de Supabase Auth (`POST {SUPABASE_URL}/auth/v1/token?grant_type=password`, con la anon key) — es exactamente lo mismo que hace `supabase-js` internamente en `signInWithPassword`, solo que aquí corre en el servidor para nunca exponer el correo resuelto.
- Si el login es exitoso, regresa `{ access_token, refresh_token }`. Si falla, regresa el mismo mensaje genérico de credenciales inválidas.

**`src/modules/auth/services/authService.js`:**
- `iniciarSesion({ entrada, password })` ahora llama a `POST /api/auth/iniciar-sesion` y, con la respuesta, adopta la sesión vía `supabase.auth.setSession({ access_token, refresh_token })`.
- Se elimina `resolverCorreo()` (ya no hace falta — "admin" ahora es simplemente un username como cualquier otro).
- `registrar({ email, password, nombreCompleto, username })` agrega `username` a `options.data` del `supabase.auth.signUp(...)` existente, para que `handle_new_user()` lo reciba.

**`src/modules/auth/views/Registro.vue`:** nuevo campo "Nombre de usuario" (`v-model="username"`, se normaliza a minúsculas al escribir, `pattern="[a-z0-9_]{3,20}"`, `minlength="3"`, `maxlength="20"`). Antes de llamar a `registrar()`, se consulta `GET /api/auth/username-disponible?username=` y si no está disponible se muestra un error sin enviar el formulario.

**`src/components/LoginModal.vue` y `src/modules/auth/views/Login.vue`:** el campo `email` se renombra a `entrada`, con placeholder "correo@ejemplo.com o tu usuario" (ya no "Correo (o admin)"); dejan de importar/usar `resolverCorreo`.

**Nota sobre `VITE_ADMIN_ALIAS_EMAIL`:** queda sin uso en el código después de este cambio; se deja la variable de entorno tal cual (no se toca `.env.local`), solo se deja de referenciar desde el frontend.

### 2) Notificación al admin al registrar una quiniela

**`api/notificaciones/registro.js`:** después de enviar el correo de confirmación al participante (sin cambios en esa parte), se agrega un envío adicional a cada cuenta con `rol = 'admin'` (consultando `perfiles` y resolviendo el correo real vía `auth.admin.getUserById`, igual que en el login), con un correo breve: jornada, alias de la entrada, método de pago y estatus. Este envío va en su propio `try/catch` — si falla, se registra en el log del servidor pero **no** afecta la respuesta al participante (su propio correo de confirmación ya se mandó, o se seguirá best-effort igual que hoy).

### 3) Búsqueda de partidos por ronda (Liga MX)

**`api/_lib/football/theSportsDb.js`:** `getFixtures` acepta un parámetro opcional `round`. Cuando viene presente, en vez de `eventsnextleague.php` llama a `eventsround.php?id=<liga>&r=<round>&s=<season>`, donde `season` se calcula con una función nueva `seasonRangeForDate(fecha)`:

```js
export function seasonRangeForDate(date) {
  const parsed = new Date(`${date}T12:00:00Z`);
  const year = parsed.getUTCFullYear();
  const startYear = parsed.getUTCMonth() < 6 ? year - 1 : year;
  return `${startYear}-${startYear + 1}`;
}
```

(Verificado: para una fecha de septiembre 2026, produce `"2026-2027"`, que es el formato real que usa TheSportsDB para Liga MX.)

**`api/_lib/ligas.js`:** Liga MX (`'4350'`) gana un campo `soportaBusquedaPorRonda: true`; ninguna otra liga lo tiene todavía (no se ha verificado su formato de temporada).

**`api/fixtures.js`:** acepta un query param opcional `ronda`. Si viene presente:
- Se exige que sea la única liga en `leagues` y que esa liga tenga `soportaBusquedaPorRonda` (si no, error 400 explicando que esa liga no soporta búsqueda por ronda todavía).
- No se exige `from`/`to` en este modo (se usan solo para el modo de búsqueda por fecha, sin cambios).
- Se llama a `findFixtures({ league, round: ronda, season: seasonRangeForDate(fechaDeReferencia) })`, donde `fechaDeReferencia` es la fecha de hoy (no depende de `from`/`to` porque no se piden en este modo).

**`src/modules/admin/services/adminService.js`:** `buscarFixtures` acepta un parámetro opcional `ronda`; cuando viene, arma el query string con `ronda` en vez de `from`/`to`.

**`src/modules/admin/views/GestionJornadas.vue`:** junto al buscador por rango de fechas que ya existe, un campo opcional "Buscar por jornada/ronda (solo Liga MX)" con un input numérico; al usarlo, se llama `buscarFixtures({ leagues: [ligaPrincipal.id], ronda })` en vez de la búsqueda por fecha. Los dos modos de búsqueda conviven (no se elimina el buscador por fecha).

## Fuera de alcance (confirmado explícitamente)

- No se toca `RecuperarPassword.vue` — la recuperación de contraseña sigue siendo solo por correo (no se agregó recuperación por username).
- No hay backfill de usernames para cuentas viejas — no aplica porque en producción solo existe la cuenta admin, que sí se actualiza en la migración.
- La búsqueda por ronda no se generaliza a las otras 9 ligas configuradas — solo Liga MX, hasta verificar el formato de temporada real de cada una.
- No se elimina la variable de entorno `VITE_ADMIN_ALIAS_EMAIL` — solo se deja de usar en el código.

## Pruebas a cubrir

- Registrar una cuenta nueva sin username: el formulario no deja enviar (validación de formato) o el endpoint de disponibilidad avisa si ya existe.
- Registrar dos cuentas con el mismo username (uno después de otro): la segunda falla con un mensaje claro, sin crear una cuenta de auth huérfana.
- Iniciar sesión con el username de una cuenta recién creada: funciona igual que con el correo.
- Iniciar sesión con `"admin"` (ahora como username real, no como alias especial): sigue funcionando igual que antes.
- Iniciar sesión con un username que no existe, o con la contraseña incorrecta: mismo mensaje genérico en ambos casos.
- Registrar una quiniela desde `LlenarQuiniela.vue`: el admin recibe un correo aparte del de confirmación al participante.
- Registrar una quiniela presencial desde `EdicionManual.vue`: el admin **no** recibe correo (él mismo la registró).
- Buscar partidos de Liga MX por número de ronda en `GestionJornadas.vue`: trae los partidos reales de esa ronda con sus escudos, igual que se hizo manualmente para crear "Jornada 8" en esta sesión.
