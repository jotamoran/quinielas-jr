# Quinielas Liga MX — Diseño

**Fecha:** 2026-09-07
**Estado:** Aprobado para pasar a plan de implementación

## 1. Resumen

Reconvertir el repositorio actual (plantilla corporativa Vue 3 + Vuetify + Tailwind, con módulos de negocio ajenos a este proyecto) en una plataforma de quinielas deportivas: los usuarios registran pronósticos (Local/Empate/Visita) de partidos agrupados en "jornadas", pagan por SPEI, y consultan su historial y el ranking de la jornada. El admin arma las jornadas eligiendo partidos desde API-Football (pudiendo combinar Liga MX con otras ligas en una misma jornada), aprueba pagos y sincroniza resultados.

Hosting: Vercel (frontend estático + funciones serverless Node.js en `/api`). Datos: Supabase (PostgreSQL, Auth, Storage). Datos deportivos: API-Football (API-Sports).

## 2. Alcance de la v1 (y qué queda fuera)

**Incluido en v1:**
- Autenticación por correo + contraseña, con verificación por código enviado al correo (Supabase Auth Email OTP). Solo usuarios logueados pueden registrar quinielas.
- Registro de pronósticos L/E/V por partido, con múltiples entradas (alias) por usuario por jornada.
- Pago únicamente por transferencia SPEI + subida de comprobante; aprobación/rechazo manual por el admin.
- Sincronización de resultados manual (botón en el panel admin), sin cron automático.
- Panel admin: gestión de jornadas (búsqueda de partidos vía API-Football, pudiendo mezclar ligas/competiciones dentro de una misma jornada), autorización de pagos, sincronización de resultados, edición manual de quinielas.
- Historial y balance informativo del usuario (gastado, jornadas jugadas, aciertos, mejor posición) — sin manejo de saldo/dinero real dentro del sistema.
- Tabla de posiciones en vivo (según el último sync) para usuarios logueados, de la jornada activa.
- **Página pública sin login** (`/publico/:jornadaId`) con la tabla de posiciones y resultados de partidos, pensada para compartirse por WhatsApp/redes. Expone solo alias/nombre + aciertos + posición (nunca correos ni montos).

**Explícitamente fuera de v1 (backlog / fase 2):**
- Pago con tarjeta (Mercado Pago/Stripe).
- Sincronización automática por cron (Vercel Cron) — requiere plan Pro de Vercel para frecuencias útiles durante partidos; el botón manual cubre la necesidad actual.
- Balance monetario real / monedero dentro de la plataforma.
- Verificación por SMS/WhatsApp (solo email OTP en v1).
- Actualización en tiempo real vía Supabase Realtime en la página pública (v1 usa polling cada 30-60s).
- Repositorio remoto en GitHub — se prepara git localmente; el usuario conecta el remoto cuando lo cree.

## 3. Cambios de stack

**Se elimina:**
- Módulos de negocio ajenos: `src/modules/{almacen,cotizador_ia,tracker_proyectos,dashboard_permisos,nuevo_modulo}`.
- `src/api/mainApi.js`, `src/api/externalApi.js` (axios contra backend propio con JWT manual).
- `src/store/auth.js` actual y `src/modules/auth/*` (login por JWT + `jwt-decode`).
- Dependencia `vuetify`, `chart.js`, `xlsx`, `openpgp`, `jwt-decode`, `pinia-plugin-persistedstate` (Supabase persiste la sesión).
- `docker-compose*.yml`, `Dockerfile`, `nginx.conf`, `.gitlab-ci.yml` (hosting es Vercel, no Docker/GitLab).
- `src/theme/corporate.js` (colores TRACSA/OyL).

**Se conserva (la convención del template funciona bien):**
- Estructura `src/modules/<nombre>/{views,components,services,router.js}`.
- Alias de Vite: `@`, `@assets`, `@components` (se agrega `@services`).
- Pinia (sin plugin de persistencia — la sesión vive en Supabase/localStorage propio del SDK).
- Vue Router con guards por `meta`.

**Se agrega:**
- `@supabase/supabase-js` como cliente único (Auth + DB + Storage).
- Carpeta `/api` en la raíz del repo con funciones serverless Node.js (Vercel Functions).
- `vercel.json` con rewrite catch-all para SPA (se cambia `createWebHashHistory` → `createWebHistory`).
- Corrección de `vite.config.js`: se quita el `outDir` hardcodeado (`B:/inetpub/wwwroot/login`, residuo de otro entorno) → build estándar a `dist/`.
- `src/theme/quiniela.js` con la paleta bet365.

## 4. Modelo de datos (PostgreSQL / Supabase)

```sql
-- 1. Perfiles (complementa auth.users de Supabase)
CREATE TABLE perfiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nombre_completo TEXT NOT NULL,
  rol TEXT DEFAULT 'usuario' CHECK (rol IN ('usuario', 'admin')),
  creado_el TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Jornadas
CREATE TABLE jornadas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,                    -- "Jornada 7 - Liga MX"
  costo NUMERIC(10,2) NOT NULL DEFAULT 0,  -- costo por quiniela, definido por jornada
  fecha_cierre TIMESTAMPTZ NOT NULL,
  estatus TEXT DEFAULT 'activa' CHECK (estatus IN ('activa','cerrada','finalizada')),
  creado_por UUID REFERENCES perfiles(id),
  creado_el TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Partidos (una jornada puede combinar partidos de distintas ligas/competiciones)
CREATE TABLE partidos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jornada_id UUID REFERENCES jornadas(id) ON DELETE CASCADE,
  api_fixture_id INT UNIQUE,
  api_league_id INT NOT NULL,      -- liga de este partido en API-Football
  liga_nombre TEXT,                -- "Liga MX", "Champions League", etc. (para UI)
  equipo_local TEXT NOT NULL,
  logo_local TEXT,
  equipo_visitante TEXT NOT NULL,
  logo_visitante TEXT,
  fecha_partido TIMESTAMPTZ NOT NULL,
  resultado_oficial TEXT CHECK (resultado_oficial IN ('L','E','V'))
);
CREATE INDEX idx_partidos_jornada ON partidos(jornada_id);

-- 4. Quinielas registradas (un usuario puede tener varias por jornada)
CREATE TABLE quinielas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  jornada_id UUID REFERENCES jornadas(id) ON DELETE CASCADE,
  alias TEXT,                                  -- "Entrada 1", etc. (para distinguir múltiples)
  estatus_pago TEXT DEFAULT 'pendiente' CHECK (estatus_pago IN ('pendiente','aprobado','rechazado')),
  metodo_pago TEXT CHECK (metodo_pago IN ('transferencia')),  -- solo SPEI en v1
  monto_pagado NUMERIC(10,2),
  comprobante_url TEXT,
  revisado_por UUID REFERENCES perfiles(id),
  revisado_el TIMESTAMPTZ,
  aciertos INT DEFAULT 0,
  creado_el TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_quinielas_jornada ON quinielas(jornada_id);
CREATE INDEX idx_quinielas_usuario ON quinielas(usuario_id);

-- 5. Predicciones por partido
CREATE TABLE predicciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiniela_id UUID REFERENCES quinielas(id) ON DELETE CASCADE,
  partido_id UUID REFERENCES partidos(id) ON DELETE CASCADE,
  pronostico TEXT NOT NULL CHECK (pronostico IN ('L','E','V')),
  UNIQUE(quiniela_id, partido_id)
);

-- 6. Función de cálculo de puntos (invocada explícitamente tras sincronizar resultados)
CREATE OR REPLACE FUNCTION calcular_puntos(p_jornada_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE quinielas q
  SET aciertos = (
    SELECT COUNT(*)
    FROM predicciones p
    JOIN partidos pa ON pa.id = p.partido_id
    WHERE p.quiniela_id = q.id
      AND pa.resultado_oficial IS NOT NULL
      AND pa.resultado_oficial = p.pronostico
  )
  WHERE q.jornada_id = p_jornada_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Vista de ranking (uso interno, usuarios logueados)
CREATE VIEW vista_ranking_jornada AS
SELECT
  q.jornada_id,
  q.id AS quiniela_id,
  q.usuario_id,
  pf.nombre_completo,
  q.alias,
  q.aciertos,
  RANK() OVER (PARTITION BY q.jornada_id ORDER BY q.aciertos DESC) AS posicion
FROM quinielas q
JOIN perfiles pf ON pf.id = q.usuario_id
WHERE q.estatus_pago = 'aprobado';

-- 8. Vista de ranking pública (sin datos sensibles, para /publico/:jornadaId)
CREATE VIEW vista_ranking_publica AS
SELECT
  jornada_id,
  COALESCE(alias, nombre_completo) AS mostrar_como,
  aciertos,
  posicion
FROM vista_ranking_jornada;
```

**Storage:** bucket privado `comprobantes`, estructura `comprobantes/{usuario_id}/{uuid-generado-en-cliente}.{ext}` — el UUID se genera en el frontend antes de subir el archivo, y ese mismo path se guarda como `comprobante_url` al insertar la fila en `quinielas` (evita depender del `quiniela_id`, que aún no existe al momento de subir el archivo).

## 5. Seguridad (RLS)

- `perfiles`: cada quien `SELECT`/`UPDATE` su propia fila (excepto `rol`, que no se expone editable desde el cliente); admin `SELECT` de todas.
- `jornadas`, `partidos`: `SELECT` público (`anon` + `authenticated`) — son datos de partidos, no sensibles. `INSERT`/`UPDATE`/`DELETE` solo admin o desde las funciones serverless (con `SUPABASE_SERVICE_ROLE_KEY`).
- `quinielas`: el usuario `SELECT`/`INSERT` solo las suyas (`usuario_id = auth.uid()`); admin `SELECT`/`UPDATE` todas. No se otorga acceso directo a `anon`.
- `predicciones`: el usuario `INSERT`/`UPDATE`/`DELETE` solo predicciones de sus propias quinielas, y solo mientras `jornadas.fecha_cierre` no haya pasado (validado también server-side vía política con subquery, no solo en el UI).
- `vista_ranking_jornada`: `SELECT` para `authenticated`.
- `vista_ranking_publica`: `SELECT` para `anon` + `authenticated` — es la única superficie pública sobre datos de quinielas.
- Storage `comprobantes`: política de bucket — el usuario solo `INSERT`/`SELECT` dentro de su propia carpeta (`{usuario_id}/...`); el admin no tiene `SELECT` directo por RLS, sino que obtiene una signed URL vía el endpoint serverless `/api/comprobante-url` (con `SUPABASE_SERVICE_ROLE_KEY`, tras verificar `rol = 'admin'`).

## 6. Frontend — módulos y rutas

- **`modules/auth`**: Login, Registro (con paso de código de verificación), Recuperar contraseña. `store/auth.js` reescrito alrededor de `supabase.auth.onAuthStateChange`.
- **`modules/quinielas`** (usuario, `requiresAuth`):
  - `MisQuinielas.vue` — historial + balance resumen.
  - `LlenarQuiniela.vue` — tarjetas de partidos de la jornada activa, selección L/E/V, countdown a `fecha_cierre`, bloqueo automático al vencer, permite crear múltiples entradas (alias).
  - Paso de pago (dentro del mismo flujo) — datos SPEI + subida de comprobante a Storage.
  - `TablaPosiciones.vue` — ranking de la jornada activa (reusado también en la vista pública).
- **`modules/admin`** (`requiresAdmin`):
  - `GestionJornadas.vue` — busca partidos vía `/api/fixtures` (varias ligas), arma la jornada, define costo y `fecha_cierre`.
  - `AutorizacionPagos.vue` — lista de pendientes, preview de comprobante (signed URL), aprobar/rechazar.
  - `SincronizarResultados.vue` — botón manual por jornada → `/api/sync-results`.
  - `EdicionManual.vue` — corrección puntual de una quiniela.
- **`modules/publico`** (sin auth): `TablaPublica.vue` en ruta `/publico/:jornadaId`, consulta `vista_ranking_publica` + `partidos`/`resultado_oficial`, con polling cada 30-60s.

Layouts: `AuthLayout` (login/registro), `AppLayout` (usuario/admin logueados, nav según `rol`), `PublicoLayout` (minimal, sin nav de sesión, pensado para verse bien compartido en móvil).

## 7. Endpoints serverless (`/api`, Vercel Functions Node.js)

Los tres verifican el JWT de Supabase del request y confirman `perfiles.rol = 'admin'` en el servidor antes de proceder (nunca se confía en el rol reportado por el frontend):

1. `GET /api/fixtures?leagues=&season=&from=&to=` — proxy a API-Football, oculta `x-apisports-key`. Admite múltiples ligas para poder armar una jornada mixta.
2. `POST /api/sync-results` `{ jornada_id }` — trae marcadores finales de API-Football para los `partidos` de esa jornada, mapea a `L`/`E`/`V`, actualiza `partidos.resultado_oficial`, y ejecuta `calcular_puntos(jornada_id)` usando `SUPABASE_SERVICE_ROLE_KEY`.
3. `POST /api/comprobante-url` `{ path }` — genera una signed URL temporal del comprobante para que el admin lo revise.

**Variables de entorno:**
- Frontend (`VITE_*`, públicas): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Serverless (privadas, solo en Vercel): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `API_FOOTBALL_KEY`.

## 8. Flujo de pago

1. Usuario llena su(s) pronóstico(s) L/E/V antes de `fecha_cierre`.
2. Ve los datos bancarios SPEI y sube la foto/captura del comprobante → se sube a Storage y se crea la `quiniela` con `estatus_pago = 'pendiente'`.
3. Admin revisa el comprobante (signed URL) en `AutorizacionPagos.vue` y aprueba o rechaza en 1 clic.
4. Solo las quinielas `aprobado` cuentan en `vista_ranking_jornada` / `vista_ranking_publica`.

## 9. Verificación de cuenta

Registro con correo + contraseña vía Supabase Auth; se envía un código de verificación (Email OTP, `signInWithOtp` / `verifyOtp`) que el usuario debe capturar para activar la cuenta. Sin esto, no puede iniciar sesión ni registrar quinielas. No se usa SMS ni WhatsApp en v1 (ver sección 2, backlog).

## 10. Diseño visual (paleta bet365)

`src/theme/quiniela.js`:
```js
export const quinielaColors = Object.freeze({
  verdeOscuro: '#0a3622',   // header/nav, superficies oscuras
  verde: '#0f5132',         // superficies secundarias
  verdeAcento: '#1fae5c',   // estados "en vivo" / éxito / activo
  dorado: '#ffb80c',        // CTA principal (marca bet365)
  doradoOscuro: '#e0a300',  // hover del dorado
  blanco: '#ffffff',
  grisClaro: '#f2f2f2',
  grisTexto: '#1a1a1a',
  error: '#e3212e',
  advertencia: '#fb8c00'
})
```
Reemplaza `theme/corporate.js`; se conecta a `tailwind.config.js` igual que hoy (colores `quiniela.*` en vez de `tracsa.*`).

## 11. Pruebas

- `calcular_puntos()`: verificada con casos de ejemplo (pgTAP o script SQL de verificación) — es la lógica en la que más confían los usuarios.
- Vitest + Vue Test Utils: countdown/bloqueo de `LlenarQuiniela.vue` al vencer `fecha_cierre`; cálculo del resumen de "balance" en `MisQuinielas.vue`.
- Checklist manual de QA para el flujo de pago (subir comprobante → aprobar/rechazar → refleja estatus correctamente en ambas tablas de posiciones).

## 12. Despliegue

- Repositorio: `git init` local (sin remoto todavía; el usuario conecta GitHub cuando lo desee).
- Vercel: un solo proyecto sirve frontend (build de Vite) + funciones de `/api`. `vercel.json` con rewrite SPA.
- Supabase: proyecto Postgres con las tablas/vistas/función de la sección 4, políticas RLS de la sección 5, bucket `comprobantes`, y Email Auth con confirmación por OTP habilitada.
