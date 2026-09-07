# Quinielas JR — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconvertir el repositorio actual (plantilla corporativa Vue 3 + Vuetify) en Quinielas JR: una plataforma de quinielas deportivas con panel de usuario y panel de administración, sobre Vercel + Supabase + API-Football.

**Architecture:** Frontend Vue 3 + Tailwind (SPA, Vite) servido por Vercel; backend = funciones serverless Node.js en `/api` que actúan como intermediario seguro entre el cliente y API-Football/Supabase (service role); datos y auth en Supabase (Postgres + Auth + Storage) con RLS en todas las tablas de negocio.

**Tech Stack:** Vue 3 (Composition API), Vue Router 4, Pinia, Tailwind CSS, `@supabase/supabase-js`, Vercel Functions (Node.js), `nodemailer`, Vitest (pruebas unitarias de lógica pura), Supabase CLI (migraciones SQL locales).

## Global Constraints

- Solo Tailwind para UI — no Vuetify.
- Backend = funciones serverless Node.js en `/api` de Vercel — no un servidor Node aparte.
- Supabase Postgres/Auth/Storage; RLS obligatorio en toda tabla con datos de negocio.
- Paleta bet365 en `src/theme/quiniela.js`: `verdeOscuro #0a3622`, `verde #0f5132`, `verdeAcento #1fae5c`, `dorado #ffb80c`, `doradoOscuro #e0a300`.
- Nombre de la app: "Quinielas JR". Logo (`src/assets/logo.png`) y favicon (`public/favicon.ico`) ya existen — no se regeneran.
- Solo usuarios logueados registran quinielas; verificación de cuenta por código de correo (Supabase Auth Email OTP) — nunca SMS/WhatsApp.
- Pago con 3 métodos: `transferencia` (comprobante obligatorio, aprobación manual admin), `efectivo` (sin comprobante, aprobación manual admin), `cupon` (aprobación instantánea, sin revisión).
- Sincronización de resultados: solo botón manual — nunca cron.
- Notificaciones por correo: SMTP propio vía `nodemailer` — nunca el servicio `api_notificaciones` de TRACSA ni su branding.
- Una jornada puede combinar partidos de distintas ligas/competiciones (la liga se define por partido, no por jornada).
- Quinielas no `aprobado` nunca aparecen en ninguna tabla de posiciones (interna ni pública).
- Repositorio git ya inicializado localmente (sin remoto) — commits frecuentes, sin push a ningún remoto.
- Spec de referencia: `docs/superpowers/specs/2026-09-07-quinielas-liga-mx-design.md` — toda ambigüedad se resuelve consultando ese documento.

## Prerrequisitos (acción humana, fuera del código)

Antes de poder verificar los tasks de principio a fin, el usuario necesita:
1. Crear un proyecto en [supabase.com](https://supabase.com) y obtener: `Project URL`, `anon public key`, `service_role key`.
2. Cuenta en [api-sports.io](https://api-sports.io) (API-Football) y obtener el `x-apisports-key`.
3. Una cuenta SMTP propia (dominio propio, Zoho, Gmail con contraseña de aplicación, etc.): host, puerto, usuario, password, nombre y correo remitente.
4. Tener el [Supabase CLI](https://supabase.com/docs/guides/cli) instalado (`npm i -g supabase` o vía `npx supabase`) y Docker corriendo, para poder ejecutar `supabase start` (stack local) durante el desarrollo de los Tasks 3-7.

Los Tasks de esquema (3-7) se validan primero contra el stack **local** de Supabase (`supabase start`), que no requiere ninguna de estas cuentas. Las cuentas reales solo se necesitan para desplegar y probar en Vercel al final (Task 27).

---

## Mapa de archivos

**Se elimina:**
- `src/modules/{almacen,cotizador_ia,tracker_proyectos,dashboard_permisos,nuevo_modulo}/`
- `src/api/mainApi.js`, `src/api/externalApi.js`
- `src/store/auth.js` (se reescribe), `src/modules/auth/*` (se reescribe)
- `src/theme/corporate.js`
- `docker-compose.yml`, `docker-compose.dev.yml`, `Dockerfile`, `nginx.conf`, `.gitlab-ci.yml`, `.dockerignore`, `.env.production`

**Se conserva:** `src/assets/logo.png`, `public/favicon.ico`, estructura `src/modules/<nombre>/{views,components,services,router.js}`, alias de Vite, Pinia, Vue Router.

**Se crea:**
```
supabase/
  config.toml
  migrations/
    0001_perfiles.sql
    0002_helpers.sql
    0003_jornadas.sql
    0004_partidos.sql
    0005_quinielas.sql
    0006_predicciones.sql
    0007_cupones.sql
    0008_calcular_puntos.sql
    0009_vistas_ranking.sql
    0010_rls.sql
  tests/
    calcular_puntos.test.sql
    rls_criticas.test.sql

src/
  lib/supabase.js
  theme/quiniela.js
  store/auth.js
  modules/
    auth/{router.js, services/authService.js, views/{Login,Registro,VerificarCodigo,RecuperarPassword}.vue}
    quinielas/
      router.js
      services/quinielasService.js
      utils/{countdown.js, balance.js}
      views/{MisQuinielas,LlenarQuiniela}.vue
      components/{TarjetaPartido,PasoPago,TablaPosiciones}.vue
    admin/
      router.js
      services/adminService.js
      views/{GestionJornadas,AutorizacionPagos,SincronizarResultados,CerrarJornada,EdicionManual}.vue
    publico/{router.js, views/TablaPublica.vue}
  layouts/PublicoLayout.vue (nuevo), AuthLayout.vue / AppLayout.vue (adaptados)

api/
  _lib/{supabaseAdmin.js, auth.js, email.js, premios.js, templates/base.html}
  fixtures.js
  sync-results.js
  comprobante-url.js
  cerrar-jornada.js
  cupones/aplicar.js
  notificaciones/registro.js

tests/unit/{countdown,balance,premios}.test.js

vercel.json
.env.example
```

---

### Task 1: Limpieza del repositorio y dependencias

**Files:**
- Delete: `src/modules/almacen/`, `src/modules/cotizador_ia/`, `src/modules/tracker_proyectos/`, `src/modules/dashboard_permisos/`, `src/modules/nuevo_modulo/`, `src/api/mainApi.js`, `src/api/externalApi.js`, `src/theme/corporate.js`, `docker-compose.yml`, `docker-compose.dev.yml`, `Dockerfile`, `nginx.conf`, `.gitlab-ci.yml`, `.dockerignore`, `.env.production`
- Modify: `package.json`, `.gitignore`
- Create: `.env.example`

**Interfaces:**
- Produces: `package.json` con dependencias finales que los demás tasks asumen instaladas: `@supabase/supabase-js`, `nodemailer`, `pinia`, `vue`, `vue-router`, `vue-i18n`; devDependencies: `vitest`, más las ya existentes de Vite/Tailwind.

- [ ] **Step 1: Borrar módulos y archivos ajenos**

```bash
rm -rf src/modules/almacen src/modules/cotizador_ia src/modules/tracker_proyectos src/modules/dashboard_permisos src/modules/nuevo_modulo
rm -f src/api/mainApi.js src/api/externalApi.js src/theme/corporate.js
rm -f docker-compose.yml docker-compose.dev.yml Dockerfile nginx.conf .gitlab-ci.yml .dockerignore .env.production
```

- [ ] **Step 2: Actualizar `package.json`**

Reemplazar el bloque `dependencies`/`devDependencies` por:

```json
{
  "name": "quinielas-jr",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@mdi/font": "^7.4.47",
    "@supabase/supabase-js": "^2.45.4",
    "@tailwindcss/aspect-ratio": "^0.4.2",
    "@tailwindcss/forms": "^0.5.9",
    "nodemailer": "^6.9.15",
    "pinia": "^3.0.4",
    "sweetalert2": "^11.6.13",
    "vue": "^3.5.10",
    "vue-i18n": "^11.4.6",
    "vue-router": "^4.4.5"
  },
  "devDependencies": {
    "@types/node": "^25.6.0",
    "@vitejs/plugin-vue": "^6.0.7",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "vite": "^6.4.3",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 3: Quitar `node_modules`/lockfile viejos e instalar**

```bash
rm -rf node_modules package-lock.json
npm install
```

Expected: instala sin errores (ya no hay `vuetify`, `jwt-decode`, `openpgp`, `xlsx`, `chart.js`, `pinia-plugin-persistedstate`, `axios`).

- [ ] **Step 4: Agregar variables de entorno a `.gitignore`**

Agregar al final de `.gitignore` (si no están ya cubiertas por el bloque `*.local`):
```
.env
.env.local
```

- [ ] **Step 5: Crear `.env.example`**

```bash
# Frontend (públicas, con prefijo VITE_)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_TITLE=Quinielas JR

# Serverless (privadas, solo en Vercel — nunca en el bundle del frontend)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
API_FOOTBALL_KEY=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_NAME=Quinielas JR
SMTP_FROM_EMAIL=
```

Guardar como `/home/jmoran/desarrollos/quiniela_jr/.env.example`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: limpiar módulos ajenos y dependencias, agregar .env.example

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Corrección de Vite, `index.html` y `vercel.json`

**Files:**
- Modify: `vite.config.js`, `index.html`
- Create: `vercel.json`

**Interfaces:**
- Produces: build a `dist/`, ruteo con `createWebHistory` (Task 8 lo usará en `src/router/index.js`), rewrite SPA para Vercel.

- [ ] **Step 1: Corregir `vite.config.js`**

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@components': path.resolve(__dirname, './src/components'),
      '@services': path.resolve(__dirname, './src/services'),
    },
  },
})
```

- [ ] **Step 2: Corregir `index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Quinielas JR</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

(Se quita el `<script>` de OpenPGP por CDN y el placeholder `%VITE_APP_TITLE%`.)

- [ ] **Step 3: Crear `vercel.json`**

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 4: Verificar build**

Run: `npm run build`
Expected: termina sin errores y genera `dist/index.html` con `<title>Quinielas JR</title>`.

- [ ] **Step 5: Commit**

```bash
git add vite.config.js index.html vercel.json
git commit -m "fix: build estándar a dist/, quitar residuos de otro entorno, agregar vercel.json"
```

---

### Task 3: Migraciones — `perfiles` + trigger de alta automática

**Files:**
- Create: `supabase/config.toml`, `supabase/migrations/0001_perfiles.sql`, `supabase/tests/perfiles.test.sql`

**Interfaces:**
- Produces: tabla `perfiles(id, nombre_completo, rol, creado_el)`; trigger que crea la fila en `perfiles` automáticamente al crear un `auth.users`.

- [ ] **Step 1: Inicializar el proyecto Supabase local**

```bash
npx supabase init
npx supabase start
```

Expected: levanta el stack local (Postgres, Auth, Storage, Studio) y muestra `API URL`, `anon key`, `service_role key` locales.

- [ ] **Step 2: Escribir el script de verificación (falla primero)**

`supabase/tests/perfiles.test.sql`:
```sql
-- Verifica que insertar en auth.users crea automáticamente el perfil
DO $$
DECLARE
  nuevo_id UUID := gen_random_uuid();
  filas INT;
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (nuevo_id, 'test@example.com', '{"nombre_completo":"Test User"}'::jsonb);

  SELECT COUNT(*) INTO filas FROM perfiles WHERE id = nuevo_id;
  IF filas != 1 THEN
    RAISE EXCEPTION 'FALLO: no se creó el perfil automáticamente (filas=%)', filas;
  END IF;

  IF (SELECT rol FROM perfiles WHERE id = nuevo_id) != 'usuario' THEN
    RAISE EXCEPTION 'FALLO: rol por default debería ser usuario';
  END IF;

  IF (SELECT nombre_completo FROM perfiles WHERE id = nuevo_id) != 'Test User' THEN
    RAISE EXCEPTION 'FALLO: nombre_completo no se copió del metadata';
  END IF;

  RAISE NOTICE 'OK: perfiles.test.sql';
END $$;
```

- [ ] **Step 2b: Correr el test contra la base local (debe fallar)**

Run: `npx supabase db reset` seguido de `psql "$(npx supabase status -o json | jq -r .DB_URL)" -f supabase/tests/perfiles.test.sql`
Expected: FALLA porque la tabla `perfiles` no existe todavía.

- [ ] **Step 3: Crear la migración**

`supabase/migrations/0001_perfiles.sql`:
```sql
CREATE TABLE perfiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  nombre_completo TEXT NOT NULL,
  rol TEXT DEFAULT 'usuario' CHECK (rol IN ('usuario', 'admin')),
  creado_el TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO perfiles (id, nombre_completo)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre_completo', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

- [ ] **Step 4: Aplicar y volver a correr el test (debe pasar)**

Run: `npx supabase db reset` y repetir el comando `psql ... -f supabase/tests/perfiles.test.sql`
Expected: `NOTICE: OK: perfiles.test.sql`, sin excepciones.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat(db): tabla perfiles con alta automática vía trigger"
```

---

### Task 4: Migración — función `es_admin()`

**Files:**
- Create: `supabase/migrations/0002_helpers.sql`

**Interfaces:**
- Produces: función `es_admin() RETURNS boolean` (SQL, `SECURITY DEFINER`, `STABLE`) — usada por las políticas RLS de Tasks 7 y 10.

- [ ] **Step 1: Crear la migración**

`supabase/migrations/0002_helpers.sql`:
```sql
CREATE OR REPLACE FUNCTION es_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

- [ ] **Step 2: Verificar que aplica sin error**

Run: `npx supabase db reset`
Expected: termina sin errores (todas las migraciones anteriores + esta se aplican limpio).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_helpers.sql
git commit -m "feat(db): función es_admin() para políticas RLS"
```

---

### Task 5: Migraciones — `jornadas` y `partidos`

**Files:**
- Create: `supabase/migrations/0003_jornadas.sql`, `supabase/migrations/0004_partidos.sql`

**Interfaces:**
- Produces: tablas `jornadas(id, nombre, costo, premio, fecha_cierre, estatus, creado_por, creado_el)` y `partidos(id, jornada_id, api_fixture_id, api_league_id, liga_nombre, equipo_local, logo_local, equipo_visitante, logo_visitante, fecha_partido, resultado_oficial)`.

- [ ] **Step 1: Crear `0003_jornadas.sql`**

```sql
CREATE TABLE jornadas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  costo NUMERIC(10,2) NOT NULL DEFAULT 0,
  premio NUMERIC(10,2),
  fecha_cierre TIMESTAMPTZ NOT NULL,
  estatus TEXT DEFAULT 'activa' CHECK (estatus IN ('activa','cerrada','finalizada')),
  creado_por UUID REFERENCES perfiles(id),
  creado_el TIMESTAMPTZ DEFAULT NOW()
);
```

- [ ] **Step 2: Crear `0004_partidos.sql`**

```sql
CREATE TABLE partidos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jornada_id UUID REFERENCES jornadas(id) ON DELETE CASCADE,
  api_fixture_id INT UNIQUE,
  api_league_id INT NOT NULL,
  liga_nombre TEXT,
  equipo_local TEXT NOT NULL,
  logo_local TEXT,
  equipo_visitante TEXT NOT NULL,
  logo_visitante TEXT,
  fecha_partido TIMESTAMPTZ NOT NULL,
  resultado_oficial TEXT CHECK (resultado_oficial IN ('L','E','V'))
);
CREATE INDEX idx_partidos_jornada ON partidos(jornada_id);
```

- [ ] **Step 3: Verificar**

Run: `npx supabase db reset`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_jornadas.sql supabase/migrations/0004_partidos.sql
git commit -m "feat(db): tablas jornadas y partidos"
```

---

### Task 6: Migraciones — `quinielas`, `predicciones`, `cupones`

**Files:**
- Create: `supabase/migrations/0005_quinielas.sql`, `supabase/migrations/0006_predicciones.sql`, `supabase/migrations/0007_cupones.sql`

**Interfaces:**
- Produces: tablas `quinielas`, `predicciones` (con `UNIQUE(quiniela_id, partido_id)`), `cupones`.

- [ ] **Step 1: Crear `0005_quinielas.sql`**

```sql
CREATE TABLE quinielas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  jornada_id UUID REFERENCES jornadas(id) ON DELETE CASCADE,
  alias TEXT,
  estatus_pago TEXT DEFAULT 'pendiente' CHECK (estatus_pago IN ('pendiente','aprobado','rechazado')),
  metodo_pago TEXT CHECK (metodo_pago IN ('transferencia','efectivo','cupon')),
  monto_pagado NUMERIC(10,2),
  comprobante_url TEXT,
  revisado_por UUID REFERENCES perfiles(id),
  revisado_el TIMESTAMPTZ,
  aciertos INT DEFAULT 0,
  creado_el TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_quinielas_jornada ON quinielas(jornada_id);
CREATE INDEX idx_quinielas_usuario ON quinielas(usuario_id);
```

- [ ] **Step 2: Crear `0006_predicciones.sql`**

```sql
CREATE TABLE predicciones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiniela_id UUID REFERENCES quinielas(id) ON DELETE CASCADE,
  partido_id UUID REFERENCES partidos(id) ON DELETE CASCADE,
  pronostico TEXT NOT NULL CHECK (pronostico IN ('L','E','V')),
  UNIQUE(quiniela_id, partido_id)
);
```

- [ ] **Step 3: Crear `0007_cupones.sql`**

```sql
CREATE TABLE cupones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  usuario_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  jornada_origen_id UUID REFERENCES jornadas(id),
  estatus TEXT DEFAULT 'activo' CHECK (estatus IN ('activo','usado','cancelado')),
  usado_en_quiniela_id UUID REFERENCES quinielas(id),
  creado_el TIMESTAMPTZ DEFAULT NOW(),
  usado_el TIMESTAMPTZ
);
```

- [ ] **Step 4: Verificar**

Run: `npx supabase db reset`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_quinielas.sql supabase/migrations/0006_predicciones.sql supabase/migrations/0007_cupones.sql
git commit -m "feat(db): tablas quinielas, predicciones y cupones"
```

---

### Task 7: Migración — `calcular_puntos()` (TDD)

**Files:**
- Create: `supabase/migrations/0008_calcular_puntos.sql`, `supabase/tests/calcular_puntos.test.sql`

**Interfaces:**
- Consumes: `jornadas`, `partidos`, `quinielas`, `predicciones` (Tasks 5-6).
- Produces: función `calcular_puntos(p_jornada_id UUID) RETURNS void` — usada por Task 15 (`api/sync-results.js`) y Task 17 (`api/cerrar-jornada.js`).

- [ ] **Step 1: Escribir el script de verificación (falla primero)**

`supabase/tests/calcular_puntos.test.sql`:
```sql
DO $$
DECLARE
  v_jornada UUID;
  v_usuario UUID := gen_random_uuid();
  v_p1 UUID; v_p2 UUID; v_p3 UUID;
  v_q1 UUID; v_q2 UUID;
  v_aciertos_q1 INT; v_aciertos_q2 INT;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_usuario, 'jugador@example.com');

  INSERT INTO jornadas (nombre, costo, fecha_cierre)
  VALUES ('Jornada de prueba', 50, NOW() + interval '1 day')
  RETURNING id INTO v_jornada;

  INSERT INTO partidos (jornada_id, api_league_id, equipo_local, equipo_visitante, fecha_partido, resultado_oficial)
  VALUES
    (v_jornada, 262, 'América', 'Chivas', NOW(), 'L') RETURNING id INTO v_p1;
  INSERT INTO partidos (jornada_id, api_league_id, equipo_local, equipo_visitante, fecha_partido, resultado_oficial)
  VALUES
    (v_jornada, 262, 'Cruz Azul', 'Pumas', NOW(), 'E') RETURNING id INTO v_p2;
  INSERT INTO partidos (jornada_id, api_league_id, equipo_local, equipo_visitante, fecha_partido, resultado_oficial)
  VALUES
    (v_jornada, 262, 'Monterrey', 'Tigres', NOW(), NULL) RETURNING id INTO v_p3; -- aún sin resultado

  -- Quiniela 1: acierta p1 y p2, p3 sin resultado aún -> 2 aciertos
  INSERT INTO quinielas (usuario_id, jornada_id, estatus_pago) VALUES (v_usuario, v_jornada, 'aprobado') RETURNING id INTO v_q1;
  INSERT INTO predicciones (quiniela_id, partido_id, pronostico) VALUES (v_q1, v_p1, 'L'), (v_q1, v_p2, 'E'), (v_q1, v_p3, 'V');

  -- Quiniela 2: solo acierta p1 -> 1 acierto
  INSERT INTO quinielas (usuario_id, jornada_id, estatus_pago) VALUES (v_usuario, v_jornada, 'aprobado') RETURNING id INTO v_q2;
  INSERT INTO predicciones (quiniela_id, partido_id, pronostico) VALUES (v_q2, v_p1, 'L'), (v_q2, v_p2, 'V'), (v_q2, v_p3, 'L');

  PERFORM calcular_puntos(v_jornada);

  SELECT aciertos INTO v_aciertos_q1 FROM quinielas WHERE id = v_q1;
  SELECT aciertos INTO v_aciertos_q2 FROM quinielas WHERE id = v_q2;

  IF v_aciertos_q1 != 2 THEN
    RAISE EXCEPTION 'FALLO: quiniela 1 debería tener 2 aciertos, tiene %', v_aciertos_q1;
  END IF;
  IF v_aciertos_q2 != 1 THEN
    RAISE EXCEPTION 'FALLO: quiniela 2 debería tener 1 acierto, tiene %', v_aciertos_q2;
  END IF;

  RAISE NOTICE 'OK: calcular_puntos.test.sql';
END $$;
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `npx supabase db reset` y luego `psql "$(npx supabase status -o json | jq -r .DB_URL)" -f supabase/tests/calcular_puntos.test.sql`
Expected: FALLA con `function calcular_puntos(uuid) does not exist`.

- [ ] **Step 3: Crear la migración**

`supabase/migrations/0008_calcular_puntos.sql`:
```sql
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
```

- [ ] **Step 4: Aplicar y volver a correr el test (debe pasar)**

Run: `npx supabase db reset` y repetir el `psql ... -f supabase/tests/calcular_puntos.test.sql`
Expected: `NOTICE: OK: calcular_puntos.test.sql`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0008_calcular_puntos.sql supabase/tests/calcular_puntos.test.sql
git commit -m "feat(db): función calcular_puntos con test SQL"
```

---

### Task 8: Migración — vistas de ranking

**Files:**
- Create: `supabase/migrations/0009_vistas_ranking.sql`

**Interfaces:**
- Produces: vistas `vista_ranking_jornada(jornada_id, quiniela_id, usuario_id, nombre_completo, alias, aciertos, posicion)` y `vista_ranking_publica(jornada_id, mostrar_como, aciertos, posicion)` — usadas por Task 21 (`quinielasService.js`) y Task 25 (`TablaPublica.vue`).

- [ ] **Step 1: Crear la migración**

`supabase/migrations/0009_vistas_ranking.sql`:
```sql
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

CREATE VIEW vista_ranking_publica AS
SELECT
  jornada_id,
  COALESCE(alias, nombre_completo) AS mostrar_como,
  aciertos,
  posicion
FROM vista_ranking_jornada;
```

- [ ] **Step 2: Verificar**

Run: `npx supabase db reset`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0009_vistas_ranking.sql
git commit -m "feat(db): vistas de ranking interna y pública"
```

---

### Task 9: Migración — RLS completo + política de Storage

**Files:**
- Create: `supabase/migrations/0010_rls.sql`, `supabase/tests/rls_criticas.test.sql`

**Interfaces:**
- Consumes: `es_admin()` (Task 4), todas las tablas anteriores.
- Produces: RLS habilitado y con políticas en `perfiles`, `jornadas`, `partidos`, `quinielas`, `predicciones`, `cupones`; bucket de Storage `comprobantes` con sus políticas.

- [ ] **Step 1: Escribir el script de verificación de las políticas más críticas (falla primero)**

`supabase/tests/rls_criticas.test.sql`:
```sql
DO $$
DECLARE
  v_usuario_a UUID := gen_random_uuid();
  v_usuario_b UUID := gen_random_uuid();
  v_jornada_abierta UUID;
  v_jornada_cerrada UUID;
  v_partido UUID;
  v_quiniela UUID;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_usuario_a, 'a@example.com'), (v_usuario_b, 'b@example.com');

  INSERT INTO jornadas (nombre, costo, fecha_cierre) VALUES ('Abierta', 50, NOW() + interval '1 day') RETURNING id INTO v_jornada_abierta;
  INSERT INTO jornadas (nombre, costo, fecha_cierre) VALUES ('Cerrada', 50, NOW() - interval '1 day') RETURNING id INTO v_jornada_cerrada;
  INSERT INTO partidos (jornada_id, api_league_id, equipo_local, equipo_visitante, fecha_partido)
  VALUES (v_jornada_abierta, 262, 'A', 'B', NOW()) RETURNING id INTO v_partido;

  INSERT INTO quinielas (usuario_id, jornada_id) VALUES (v_usuario_a, v_jornada_abierta) RETURNING id INTO v_quiniela;

  -- Simular request del usuario A
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usuario_a::text)::text, true);

  -- Debe poder insertar su propia predicción en jornada abierta
  BEGIN
    INSERT INTO predicciones (quiniela_id, partido_id, pronostico) VALUES (v_quiniela, v_partido, 'L');
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FALLO: usuario A debería poder registrar su predicción en jornada abierta';
  END;

  -- Simular request del usuario B: no debe poder ver la quiniela de A
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_usuario_b::text)::text, true);
  IF EXISTS (SELECT 1 FROM quinielas WHERE id = v_quiniela) THEN
    RAISE EXCEPTION 'FALLO: usuario B no debería poder ver la quiniela de A';
  END IF;

  RESET ROLE;
  RAISE NOTICE 'OK: rls_criticas.test.sql';
END $$;
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `npx supabase db reset` y `psql "$(npx supabase status -o json | jq -r .DB_URL)" -f supabase/tests/rls_criticas.test.sql`
Expected: FALLA (sin RLS, el `INSERT` de A funciona pero B **sí** puede ver la quiniela de A — la segunda validación dispara la excepción).

- [ ] **Step 3: Crear la migración de RLS**

`supabase/migrations/0010_rls.sql`:
```sql
-- perfiles
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select propio o admin" ON perfiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR es_admin());
CREATE POLICY "update solo propio" ON perfiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- jornadas
ALTER TABLE jornadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura publica jornadas" ON jornadas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "solo admin escribe jornadas" ON jornadas FOR ALL TO authenticated
  USING (es_admin()) WITH CHECK (es_admin());

-- partidos
ALTER TABLE partidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lectura publica partidos" ON partidos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "solo admin escribe partidos" ON partidos FOR ALL TO authenticated
  USING (es_admin()) WITH CHECK (es_admin());

-- quinielas
ALTER TABLE quinielas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuario ve las suyas o admin ve todas" ON quinielas FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR es_admin());
CREATE POLICY "usuario inserta las suyas" ON quinielas FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "solo admin actualiza" ON quinielas FOR UPDATE TO authenticated
  USING (es_admin()) WITH CHECK (es_admin());

-- predicciones
ALTER TABLE predicciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver predicciones propias o admin" ON predicciones FOR SELECT TO authenticated
  USING (
    es_admin() OR EXISTS (SELECT 1 FROM quinielas q WHERE q.id = predicciones.quiniela_id AND q.usuario_id = auth.uid())
  );
CREATE POLICY "insertar antes del cierre" ON predicciones FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quinielas q JOIN jornadas j ON j.id = q.jornada_id
      WHERE q.id = predicciones.quiniela_id AND q.usuario_id = auth.uid() AND j.fecha_cierre > NOW()
    )
  );
CREATE POLICY "actualizar antes del cierre" ON predicciones FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quinielas q JOIN jornadas j ON j.id = q.jornada_id
      WHERE q.id = predicciones.quiniela_id AND q.usuario_id = auth.uid() AND j.fecha_cierre > NOW()
    )
  );

-- cupones
ALTER TABLE cupones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuario ve sus cupones o admin ve todos" ON cupones FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR es_admin());

-- vistas: se exponen explícitamente para el ranking (ver nota debajo sobre RLS)
GRANT SELECT ON vista_ranking_jornada TO authenticated;
GRANT SELECT ON vista_ranking_publica TO anon, authenticated;

-- Storage: bucket privado de comprobantes
INSERT INTO storage.buckets (id, name, public) VALUES ('comprobantes', 'comprobantes', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "usuario sube su comprobante" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comprobantes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "usuario lee su comprobante" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'comprobantes' AND (storage.foldername(name))[1] = auth.uid()::text);
```

Nota: las vistas en Postgres, por default, consultan las tablas base con los permisos de quien **creó** la vista (no de quien la consulta) — es decir, **no** heredan automáticamente el RLS de `quinielas`/`perfiles` fila por fila. Esto es justo lo que queremos aquí: el ranking necesita mostrar los aciertos de **todos** los participantes de la jornada, no solo los del usuario que consulta, algo que el RLS de `quinielas` (cada quien ve solo las suyas) impediría si la vista fuera "invoker". El `GRANT SELECT` es lo que controla quién puede consultar la vista (`authenticated` para la interna, `anon` + `authenticated` para la pública) — y la vista misma ya limita las columnas expuestas (nunca correos ni montos).

- [ ] **Step 4: Aplicar y volver a correr el test (debe pasar)**

Run: `npx supabase db reset` y repetir `psql ... -f supabase/tests/rls_criticas.test.sql`
Expected: `NOTICE: OK: rls_criticas.test.sql`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0010_rls.sql supabase/tests/rls_criticas.test.sql
git commit -m "feat(db): RLS completo en tablas de negocio + políticas de storage comprobantes"
```

---

### Task 10: Cliente Supabase y paleta de tema en el frontend

**Files:**
- Create: `src/lib/supabase.js`, `src/theme/quiniela.js`
- Modify: `tailwind.config.js`

**Interfaces:**
- Produces: `supabase` (cliente exportado por default desde `src/lib/supabase.js`) — usado por todos los `services/*.js` de aquí en adelante; `quinielaColors` (export nombrado desde `src/theme/quiniela.js`).

- [ ] **Step 1: Crear `src/lib/supabase.js`**

```js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

- [ ] **Step 2: Crear `src/theme/quiniela.js`**

```js
export const quinielaColors = Object.freeze({
  verdeOscuro: '#0a3622',
  verde: '#0f5132',
  verdeAcento: '#1fae5c',
  dorado: '#ffb80c',
  doradoOscuro: '#e0a300',
  blanco: '#ffffff',
  grisClaro: '#f2f2f2',
  grisTexto: '#1a1a1a',
  error: '#e3212e',
  advertencia: '#fb8c00'
})
```

- [ ] **Step 3: Actualizar `tailwind.config.js`**

```js
import aspectRatio from '@tailwindcss/aspect-ratio';
import forms from '@tailwindcss/forms';
import { quinielaColors } from './src/theme/quiniela.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        quiniela: {
          verdeOscuro: quinielaColors.verdeOscuro,
          verde: quinielaColors.verde,
          verdeAcento: quinielaColors.verdeAcento,
          dorado: quinielaColors.dorado,
          doradoOscuro: quinielaColors.doradoOscuro,
          grisClaro: quinielaColors.grisClaro,
          grisTexto: quinielaColors.grisTexto,
          error: quinielaColors.error,
          advertencia: quinielaColors.advertencia,
        }
      }
    },
  },
  plugins: [aspectRatio, forms],
}
```

- [ ] **Step 4: Verificar**

Run: `npm run build`
Expected: build exitoso (confirma que `tailwind.config.js` importa y usa `quinielaColors` sin errores).

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase.js src/theme/quiniela.js tailwind.config.js
git commit -m "feat(frontend): cliente Supabase y paleta bet365 de Quinielas JR"
```

---

### Task 11: Store de auth y guards del router

**Files:**
- Modify: `src/store/auth.js` (reescribir por completo), `src/router/index.js` (reescribir por completo)

**Interfaces:**
- Consumes: `supabase` (Task 10).
- Produces: `useAuthStore()` con estado `{session, user, perfil}`, getters `isLoggedIn`, `isAdmin`, acciones `init()`, `cerrarSesion()` — usado por Task 12 (`authService.js`) y todos los módulos de vistas.

- [ ] **Step 1: Reescribir `src/store/auth.js`**

```js
import { defineStore } from 'pinia';
import { supabase } from '@/lib/supabase';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    session: null,
    user: null,
    perfil: null,
    listo: false,
  }),

  getters: {
    isLoggedIn: (state) => !!state.session,
    isAdmin: (state) => state.perfil?.rol === 'admin',
  },

  actions: {
    async cargarPerfil() {
      if (!this.user) {
        this.perfil = null;
        return;
      }
      const { data } = await supabase
        .from('perfiles')
        .select('id, nombre_completo, rol')
        .eq('id', this.user.id)
        .single();
      this.perfil = data ?? null;
    },

    async init() {
      const { data: { session } } = await supabase.auth.getSession();
      this.session = session;
      this.user = session?.user ?? null;
      await this.cargarPerfil();
      this.listo = true;

      supabase.auth.onAuthStateChange(async (_event, session) => {
        this.session = session;
        this.user = session?.user ?? null;
        await this.cargarPerfil();
      });
    },

    async cerrarSesion() {
      await supabase.auth.signOut();
      this.session = null;
      this.user = null;
      this.perfil = null;
    },
  },
});
```

- [ ] **Step 2: Reescribir `src/router/index.js`**

```js
import { createWebHistory, createRouter } from "vue-router";
import { useAuthStore } from "@/store/auth";

import authRoutes from "@/modules/auth/router.js";
import quinielasRoutes from "@/modules/quinielas/router.js";
import adminRoutes from "@/modules/admin/router.js";
import publicoRoutes from "@/modules/publico/router.js";

const routes = [
  ...authRoutes,
  ...quinielasRoutes,
  ...adminRoutes,
  ...publicoRoutes,
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  if (!authStore.listo) {
    await authStore.init();
  }

  const isAuthenticated = authStore.isLoggedIn;

  if (to.meta.requiresAuth && !isAuthenticated) {
    return next({ name: 'login', replace: true });
  }

  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return next({ name: 'mis-quinielas', replace: true });
  }

  if (to.meta.guestOnly && isAuthenticated) {
    return next({ name: 'mis-quinielas', replace: true });
  }

  next();
});

export default router;
```

Nota: este task deja `router/index.js` importando los `router.js` de los módulos (`auth`, `quinielas`, `admin`, `publico`) que se crean en los Tasks 12, 21/23, 22 y 25 — hasta entonces el build fallará por imports faltantes, lo cual es esperado y se resuelve en esos tasks.

- [ ] **Step 3: Commit**

```bash
git add src/store/auth.js src/router/index.js
git commit -m "feat(frontend): store de auth sincronizado con Supabase y guards del router"
```

---

### Task 12: Módulo `auth` — servicio y vistas

**Files:**
- Create: `src/modules/auth/router.js`, `src/modules/auth/services/authService.js`, `src/modules/auth/views/Login.vue`, `src/modules/auth/views/Registro.vue`, `src/modules/auth/views/VerificarCodigo.vue`, `src/modules/auth/views/RecuperarPassword.vue`

**Interfaces:**
- Consumes: `supabase` (Task 10).
- Produces: rutas con `name: 'login'`, `'registro'`, `'verificar-codigo'`, `'recuperar-password'`; `authService.js` exporta `registrar`, `verificarCodigo`, `iniciarSesion`, `recuperarPassword`.

- [ ] **Step 1: Crear `src/modules/auth/services/authService.js`**

```js
import { supabase } from '@/lib/supabase';

export async function registrar({ email, password, nombreCompleto }) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre_completo: nombreCompleto } },
  });
  if (error) throw error;
}

export async function verificarCodigo({ email, codigo }) {
  const { error } = await supabase.auth.verifyOtp({ email, token: codigo, type: 'signup' });
  if (error) throw error;
}

export async function iniciarSesion({ email, password }) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function recuperarPassword({ email }) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}
```

- [ ] **Step 2: Crear `src/modules/auth/views/Login.vue`**

```vue
<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { iniciarSesion } from '../services/authService';

const email = ref('');
const password = ref('');
const error = ref('');
const cargando = ref(false);
const router = useRouter();

async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    await iniciarSesion({ email: email.value, password: password.value });
    router.push({ name: 'mis-quinielas' });
  } catch (e) {
    error.value = e.message;
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-quiniela-grisClaro">
    <form @submit.prevent="onSubmit" class="bg-white p-8 rounded-lg shadow-md w-full max-w-sm space-y-4">
      <h1 class="text-2xl font-bold text-quiniela-verdeOscuro text-center">Quinielas JR</h1>
      <input v-model="email" type="email" placeholder="Correo" required
        class="w-full border rounded px-3 py-2" />
      <input v-model="password" type="password" placeholder="Contraseña" required
        class="w-full border rounded px-3 py-2" />
      <p v-if="error" class="text-quiniela-error text-sm">{{ error }}</p>
      <button type="submit" :disabled="cargando"
        class="w-full bg-quiniela-dorado hover:bg-quiniela-doradoOscuro text-quiniela-grisTexto font-semibold py-2 rounded">
        {{ cargando ? 'Entrando...' : 'Iniciar sesión' }}
      </button>
      <div class="text-center text-sm space-x-2">
        <router-link :to="{ name: 'registro' }" class="text-quiniela-verde">Crear cuenta</router-link>
        <router-link :to="{ name: 'recuperar-password' }" class="text-quiniela-verde">Olvidé mi contraseña</router-link>
      </div>
    </form>
  </div>
</template>
```

- [ ] **Step 3: Crear `src/modules/auth/views/Registro.vue`**

```vue
<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { registrar } from '../services/authService';

const nombreCompleto = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const cargando = ref(false);
const router = useRouter();

async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    await registrar({ email: email.value, password: password.value, nombreCompleto: nombreCompleto.value });
    router.push({ name: 'verificar-codigo', query: { email: email.value } });
  } catch (e) {
    error.value = e.message;
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-quiniela-grisClaro">
    <form @submit.prevent="onSubmit" class="bg-white p-8 rounded-lg shadow-md w-full max-w-sm space-y-4">
      <h1 class="text-2xl font-bold text-quiniela-verdeOscuro text-center">Crear cuenta</h1>
      <input v-model="nombreCompleto" type="text" placeholder="Nombre completo" required
        class="w-full border rounded px-3 py-2" />
      <input v-model="email" type="email" placeholder="Correo" required
        class="w-full border rounded px-3 py-2" />
      <input v-model="password" type="password" placeholder="Contraseña" required minlength="6"
        class="w-full border rounded px-3 py-2" />
      <p v-if="error" class="text-quiniela-error text-sm">{{ error }}</p>
      <button type="submit" :disabled="cargando"
        class="w-full bg-quiniela-dorado hover:bg-quiniela-doradoOscuro text-quiniela-grisTexto font-semibold py-2 rounded">
        {{ cargando ? 'Creando...' : 'Registrarme' }}
      </button>
    </form>
  </div>
</template>
```

- [ ] **Step 4: Crear `src/modules/auth/views/VerificarCodigo.vue`**

```vue
<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { verificarCodigo } from '../services/authService';

const route = useRoute();
const router = useRouter();
const email = ref(route.query.email ?? '');
const codigo = ref('');
const error = ref('');
const cargando = ref(false);

async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    await verificarCodigo({ email: email.value, codigo: codigo.value });
    router.push({ name: 'mis-quinielas' });
  } catch (e) {
    error.value = e.message;
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-quiniela-grisClaro">
    <form @submit.prevent="onSubmit" class="bg-white p-8 rounded-lg shadow-md w-full max-w-sm space-y-4">
      <h1 class="text-2xl font-bold text-quiniela-verdeOscuro text-center">Verifica tu correo</h1>
      <p class="text-sm text-gray-600">Enviamos un código a {{ email }}</p>
      <input v-model="codigo" type="text" placeholder="Código de 6 dígitos" required
        class="w-full border rounded px-3 py-2" />
      <p v-if="error" class="text-quiniela-error text-sm">{{ error }}</p>
      <button type="submit" :disabled="cargando"
        class="w-full bg-quiniela-dorado hover:bg-quiniela-doradoOscuro text-quiniela-grisTexto font-semibold py-2 rounded">
        {{ cargando ? 'Verificando...' : 'Verificar' }}
      </button>
    </form>
  </div>
</template>
```

- [ ] **Step 5: Crear `src/modules/auth/views/RecuperarPassword.vue`**

```vue
<script setup>
import { ref } from 'vue';
import { recuperarPassword } from '../services/authService';

const email = ref('');
const enviado = ref(false);
const error = ref('');
const cargando = ref(false);

async function onSubmit() {
  error.value = '';
  cargando.value = true;
  try {
    await recuperarPassword({ email: email.value });
    enviado.value = true;
  } catch (e) {
    error.value = e.message;
  } finally {
    cargando.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-quiniela-grisClaro">
    <form @submit.prevent="onSubmit" class="bg-white p-8 rounded-lg shadow-md w-full max-w-sm space-y-4">
      <h1 class="text-2xl font-bold text-quiniela-verdeOscuro text-center">Recuperar contraseña</h1>
      <template v-if="!enviado">
        <input v-model="email" type="email" placeholder="Correo" required
          class="w-full border rounded px-3 py-2" />
        <p v-if="error" class="text-quiniela-error text-sm">{{ error }}</p>
        <button type="submit" :disabled="cargando"
          class="w-full bg-quiniela-dorado hover:bg-quiniela-doradoOscuro text-quiniela-grisTexto font-semibold py-2 rounded">
          {{ cargando ? 'Enviando...' : 'Enviar enlace' }}
        </button>
      </template>
      <p v-else class="text-quiniela-verdeAcento text-sm">Revisa tu correo para continuar.</p>
    </form>
  </div>
</template>
```

- [ ] **Step 6: Crear `src/modules/auth/router.js`**

```js
export default [
  { path: '/login', name: 'login', component: () => import('./views/Login.vue'), meta: { guestOnly: true } },
  { path: '/registro', name: 'registro', component: () => import('./views/Registro.vue'), meta: { guestOnly: true } },
  { path: '/verificar-codigo', name: 'verificar-codigo', component: () => import('./views/VerificarCodigo.vue'), meta: { guestOnly: true } },
  { path: '/recuperar-password', name: 'recuperar-password', component: () => import('./views/RecuperarPassword.vue'), meta: { guestOnly: true } },
];
```

- [ ] **Step 7: Commit**

```bash
git add src/modules/auth/
git commit -m "feat(auth): login, registro con verificación por código, recuperar contraseña"
```

---

### Task 13: Lógica pura — countdown/bloqueo de jornada (TDD)

**Files:**
- Create: `src/modules/quinielas/utils/countdown.js`, `tests/unit/countdown.test.js`

**Interfaces:**
- Produces: `calcularTiempoRestante(fechaCierre, ahora = new Date())` → `{ dias, horas, minutos, segundos, vencido }`; `estaBloqueado(fechaCierre, ahora = new Date())` → `boolean` — usado por Task 23 (`LlenarQuiniela.vue`).

- [ ] **Step 1: Escribir el test (falla primero)**

`tests/unit/countdown.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { calcularTiempoRestante, estaBloqueado } from '@/modules/quinielas/utils/countdown';

describe('calcularTiempoRestante', () => {
  it('calcula días, horas, minutos y segundos restantes', () => {
    const ahora = new Date('2026-09-07T00:00:00Z');
    const cierre = new Date('2026-09-08T01:02:03Z');
    const r = calcularTiempoRestante(cierre, ahora);
    expect(r).toEqual({ dias: 1, horas: 1, minutos: 2, segundos: 3, vencido: false });
  });

  it('marca vencido cuando ya pasó la fecha de cierre', () => {
    const ahora = new Date('2026-09-08T00:00:01Z');
    const cierre = new Date('2026-09-08T00:00:00Z');
    const r = calcularTiempoRestante(cierre, ahora);
    expect(r.vencido).toBe(true);
    expect(r).toMatchObject({ dias: 0, horas: 0, minutos: 0, segundos: 0 });
  });
});

describe('estaBloqueado', () => {
  it('es false antes del cierre y true después', () => {
    const cierre = new Date('2026-09-08T00:00:00Z');
    expect(estaBloqueado(cierre, new Date('2026-09-07T23:59:59Z'))).toBe(false);
    expect(estaBloqueado(cierre, new Date('2026-09-08T00:00:01Z'))).toBe(true);
  });
});
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `npx vitest run tests/unit/countdown.test.js`
Expected: FALLA, no existe el módulo `countdown.js`.

- [ ] **Step 3: Implementar**

`src/modules/quinielas/utils/countdown.js`:
```js
export function calcularTiempoRestante(fechaCierre, ahora = new Date()) {
  const diffMs = new Date(fechaCierre).getTime() - ahora.getTime();
  if (diffMs <= 0) {
    return { dias: 0, horas: 0, minutos: 0, segundos: 0, vencido: true };
  }
  const totalSegundos = Math.floor(diffMs / 1000);
  const dias = Math.floor(totalSegundos / 86400);
  const horas = Math.floor((totalSegundos % 86400) / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;
  return { dias, horas, minutos, segundos, vencido: false };
}

export function estaBloqueado(fechaCierre, ahora = new Date()) {
  return new Date(fechaCierre).getTime() <= ahora.getTime();
}
```

- [ ] **Step 4: Correr el test (debe pasar)**

Run: `npx vitest run tests/unit/countdown.test.js`
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/quinielas/utils/countdown.js tests/unit/countdown.test.js
git commit -m "feat(quinielas): lógica de countdown y bloqueo de jornada con tests"
```

---

### Task 14: Lógica pura — resumen de balance (TDD)

**Files:**
- Create: `src/modules/quinielas/utils/balance.js`, `tests/unit/balance.test.js`

**Interfaces:**
- Produces: `calcularResumenBalance(quinielas)` → `{ totalGastado, jornadasJugadas, aciertosTotales, aciertosPromedio, mejorPosicion }` — usado por Task 24 (`MisQuinielas.vue`). Recibe un arreglo de `{ jornada_id, estatus_pago, monto_pagado, aciertos, posicion }` (posicion puede ser `null` si aún no hay ranking).

- [ ] **Step 1: Escribir el test (falla primero)**

`tests/unit/balance.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { calcularResumenBalance } from '@/modules/quinielas/utils/balance';

describe('calcularResumenBalance', () => {
  it('solo cuenta quinielas aprobadas para el gasto y las estadísticas', () => {
    const quinielas = [
      { jornada_id: 'j1', estatus_pago: 'aprobado', monto_pagado: 50, aciertos: 6, posicion: 2 },
      { jornada_id: 'j1', estatus_pago: 'aprobado', monto_pagado: 50, aciertos: 4, posicion: 5 },
      { jornada_id: 'j2', estatus_pago: 'aprobado', monto_pagado: 100, aciertos: 8, posicion: 1 },
      { jornada_id: 'j3', estatus_pago: 'rechazado', monto_pagado: 50, aciertos: 0, posicion: null },
      { jornada_id: 'j4', estatus_pago: 'pendiente', monto_pagado: null, aciertos: 0, posicion: null },
    ];

    expect(calcularResumenBalance(quinielas)).toEqual({
      totalGastado: 200,
      jornadasJugadas: 3,
      aciertosTotales: 18,
      aciertosPromedio: 6,
      mejorPosicion: 1,
    });
  });

  it('devuelve ceros y mejorPosicion null si no hay quinielas aprobadas', () => {
    expect(calcularResumenBalance([])).toEqual({
      totalGastado: 0,
      jornadasJugadas: 0,
      aciertosTotales: 0,
      aciertosPromedio: 0,
      mejorPosicion: null,
    });
  });
});
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `npx vitest run tests/unit/balance.test.js`
Expected: FALLA, no existe el módulo.

- [ ] **Step 3: Implementar**

`src/modules/quinielas/utils/balance.js`:
```js
export function calcularResumenBalance(quinielas) {
  const aprobadas = quinielas.filter((q) => q.estatus_pago === 'aprobado');

  if (aprobadas.length === 0) {
    return { totalGastado: 0, jornadasJugadas: 0, aciertosTotales: 0, aciertosPromedio: 0, mejorPosicion: null };
  }

  const totalGastado = aprobadas.reduce((suma, q) => suma + Number(q.monto_pagado ?? 0), 0);
  const aciertosTotales = aprobadas.reduce((suma, q) => suma + Number(q.aciertos ?? 0), 0);
  const posiciones = aprobadas.map((q) => q.posicion).filter((p) => p != null);

  return {
    totalGastado,
    jornadasJugadas: aprobadas.length,
    aciertosTotales,
    aciertosPromedio: Math.round((aciertosTotales / aprobadas.length) * 100) / 100,
    mejorPosicion: posiciones.length ? Math.min(...posiciones) : null,
  };
}
```

- [ ] **Step 4: Correr el test (debe pasar)**

Run: `npx vitest run tests/unit/balance.test.js`
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/quinielas/utils/balance.js tests/unit/balance.test.js
git commit -m "feat(quinielas): cálculo de resumen de balance con tests"
```

---

### Task 15: Helpers serverless — auth y cliente admin de Supabase

**Files:**
- Create: `api/_lib/supabaseAdmin.js`, `api/_lib/auth.js`

**Interfaces:**
- Produces: `getSupabaseAdmin()` → cliente `@supabase/supabase-js` con `SUPABASE_SERVICE_ROLE_KEY`; `requireUser(req)` → `{ user, perfil }` o lanza `{status, message}`; `requireAdmin(req)` → igual, además valida `perfil.rol === 'admin'`. Usado por Tasks 16-19.

- [ ] **Step 1: Crear `api/_lib/supabaseAdmin.js`**

```js
import { createClient } from '@supabase/supabase-js';

let cliente;

export function getSupabaseAdmin() {
  if (!cliente) {
    cliente = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return cliente;
}
```

- [ ] **Step 2: Crear `api/_lib/auth.js`**

```js
import { getSupabaseAdmin } from './supabaseAdmin.js';

export class ErrorHttp extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(req) {
  const encabezado = req.headers['authorization'] || '';
  const token = encabezado.replace('Bearer ', '');
  if (!token) throw new ErrorHttp(401, 'Falta el token de autenticación');

  const supabaseAdmin = getSupabaseAdmin();
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) throw new ErrorHttp(401, 'Token inválido o expirado');

  const { data: perfil } = await supabaseAdmin
    .from('perfiles')
    .select('id, nombre_completo, rol')
    .eq('id', user.id)
    .single();

  return { user, perfil };
}

export async function requireAdmin(req) {
  const { user, perfil } = await requireUser(req);
  if (perfil?.rol !== 'admin') throw new ErrorHttp(403, 'Requiere rol de administrador');
  return { user, perfil };
}
```

- [ ] **Step 2: Verificar que compila**

Run: `node --input-type=module -e "import('./api/_lib/auth.js').then(() => console.log('OK'))"`
Expected: imprime `OK` (confirma que no hay errores de sintaxis/import).

- [ ] **Step 3: Commit**

```bash
git add api/_lib/supabaseAdmin.js api/_lib/auth.js
git commit -m "feat(api): helpers de autenticación y cliente admin de Supabase para funciones serverless"
```

---

### Task 16: Helper serverless — envío de correo propio

**Files:**
- Create: `api/_lib/email.js`, `api/_lib/templates/base.html`

**Interfaces:**
- Produces: `enviarCorreo({ to, subject, heading, bodyHtml })` (async) — usado por Tasks 18 y 19.

- [ ] **Step 1: Crear `api/_lib/templates/base.html`**

```html
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f2f2f2;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;padding:24px 0;">
      <tr>
        <td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#0a3622;padding:20px;text-align:center;">
                <span style="color:#ffb80c;font-size:22px;font-weight:bold;">Quinielas JR</span>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;color:#1a1a1a;">
                <h2 style="color:#0f5132;margin-top:0;">{{HEADING}}</h2>
                {{BODY}}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;background:#f2f2f2;color:#666;font-size:12px;">
                Quinielas JR — este correo se generó automáticamente, no respondas a este mensaje.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

- [ ] **Step 2: Crear `api/_lib/email.js`**

```js
import nodemailer from 'nodemailer';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const plantillaBase = readFileSync(path.join(__dirname, 'templates', 'base.html'), 'utf-8');

let transportador;

function getTransportador() {
  if (!transportador) {
    transportador = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
  }
  return transportador;
}

export function renderizarCorreo({ heading, bodyHtml }) {
  return plantillaBase.replace('{{HEADING}}', heading).replace('{{BODY}}', bodyHtml);
}

export async function enviarCorreo({ to, subject, heading, bodyHtml }) {
  const html = renderizarCorreo({ heading, bodyHtml });
  await getTransportador().sendMail({
    from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
    to,
    subject,
    html,
  });
}
```

- [ ] **Step 3: Verificar que compila**

Run: `node --input-type=module -e "import('./api/_lib/email.js').then(() => console.log('OK'))"`
Expected: imprime `OK`.

- [ ] **Step 4: Commit**

```bash
git add api/_lib/email.js api/_lib/templates/base.html
git commit -m "feat(api): envío de correo propio (nodemailer + plantilla Quinielas JR)"
```

---

### Task 17: Lógica pura — cálculo de ganadores/peor de la jornada (TDD)

**Files:**
- Create: `api/_lib/premios.js`, `tests/unit/premios.test.js`

**Interfaces:**
- Produces: `calcularGanadoresYPeor(entradas, premioTotal)` donde `entradas: [{ quinielaId, usuarioId, aciertos }]` → `{ ganadores: [{ quinielaId, usuarioId, montoPremio }], peor: { quinielaId, usuarioId } | null }` — usado por Task 19 (`api/cerrar-jornada.js`).

- [ ] **Step 1: Escribir el test (falla primero)**

`tests/unit/premios.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { calcularGanadoresYPeor } from '../../api/_lib/premios.js';

describe('calcularGanadoresYPeor', () => {
  it('un solo ganador y un solo peor (sin empates) reciben premio y cupón respectivamente', () => {
    const entradas = [
      { quinielaId: 'q1', usuarioId: 'u1', aciertos: 8 },
      { quinielaId: 'q2', usuarioId: 'u2', aciertos: 5 },
      { quinielaId: 'q3', usuarioId: 'u3', aciertos: 2 },
    ];
    const resultado = calcularGanadoresYPeor(entradas, 300);
    expect(resultado.ganadores).toEqual([{ quinielaId: 'q1', usuarioId: 'u1', montoPremio: 300 }]);
    expect(resultado.peor).toEqual({ quinielaId: 'q3', usuarioId: 'u3' });
  });

  it('empate en primer lugar reparte el premio en partes iguales', () => {
    const entradas = [
      { quinielaId: 'q1', usuarioId: 'u1', aciertos: 7 },
      { quinielaId: 'q2', usuarioId: 'u2', aciertos: 7 },
      { quinielaId: 'q3', usuarioId: 'u3', aciertos: 3 },
    ];
    const resultado = calcularGanadoresYPeor(entradas, 300);
    expect(resultado.ganadores).toEqual([
      { quinielaId: 'q1', usuarioId: 'u1', montoPremio: 150 },
      { quinielaId: 'q2', usuarioId: 'u2', montoPremio: 150 },
    ]);
    expect(resultado.peor).toEqual({ quinielaId: 'q3', usuarioId: 'u3' });
  });

  it('empate en el último lugar no genera cupón (peor debe ser null)', () => {
    const entradas = [
      { quinielaId: 'q1', usuarioId: 'u1', aciertos: 8 },
      { quinielaId: 'q2', usuarioId: 'u2', aciertos: 2 },
      { quinielaId: 'q3', usuarioId: 'u3', aciertos: 2 },
    ];
    const resultado = calcularGanadoresYPeor(entradas, 300);
    expect(resultado.peor).toBeNull();
  });

  it('sin premio definido, los ganadores no llevan monto', () => {
    const entradas = [
      { quinielaId: 'q1', usuarioId: 'u1', aciertos: 5 },
      { quinielaId: 'q2', usuarioId: 'u2', aciertos: 1 },
    ];
    const resultado = calcularGanadoresYPeor(entradas, null);
    expect(resultado.ganadores).toEqual([{ quinielaId: 'q1', usuarioId: 'u1', montoPremio: 0 }]);
  });
});
```

- [ ] **Step 2: Correr el test (debe fallar)**

Run: `npx vitest run tests/unit/premios.test.js`
Expected: FALLA, no existe el módulo.

- [ ] **Step 3: Implementar**

`api/_lib/premios.js`:
```js
export function calcularGanadoresYPeor(entradas, premioTotal) {
  if (entradas.length === 0) return { ganadores: [], peor: null };

  const maxAciertos = Math.max(...entradas.map((e) => e.aciertos));
  const minAciertos = Math.min(...entradas.map((e) => e.aciertos));

  const primerosLugares = entradas.filter((e) => e.aciertos === maxAciertos);
  const ultimosLugares = entradas.filter((e) => e.aciertos === minAciertos);

  const montoPorGanador = premioTotal ? Number(premioTotal) / primerosLugares.length : 0;
  const ganadores = primerosLugares.map((e) => ({
    quinielaId: e.quinielaId,
    usuarioId: e.usuarioId,
    montoPremio: montoPorGanador,
  }));

  const peor = ultimosLugares.length === 1
    ? { quinielaId: ultimosLugares[0].quinielaId, usuarioId: ultimosLugares[0].usuarioId }
    : null;

  return { ganadores, peor };
}
```

- [ ] **Step 4: Correr el test (debe pasar)**

Run: `npx vitest run tests/unit/premios.test.js`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/premios.js tests/unit/premios.test.js
git commit -m "feat(api): lógica de reparto de premio y cupón al cierre de jornada, con tests"
```

---

### Task 18: Endpoints serverless — `fixtures`, `sync-results`, `comprobante-url`

**Files:**
- Create: `api/fixtures.js`, `api/sync-results.js`, `api/comprobante-url.js`

**Interfaces:**
- Consumes: `requireAdmin` (Task 15), `getSupabaseAdmin` (Task 15).
- Produces: 3 endpoints HTTP consumidos por Task 20 (`adminService.js`).

- [ ] **Step 1: Crear `api/fixtures.js`**

```js
import { requireAdmin, ErrorHttp } from './_lib/auth.js';

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

    const { leagues, season, from, to } = req.query;
    const ligas = String(leagues ?? '').split(',').filter(Boolean);
    if (ligas.length === 0) return res.status(400).json({ error: 'Debes indicar al menos una liga' });

    const resultados = await Promise.all(ligas.map(async (liga) => {
      const url = new URL('https://v3.football.api-sports.io/fixtures');
      url.searchParams.set('league', liga);
      url.searchParams.set('season', season);
      url.searchParams.set('from', from);
      url.searchParams.set('to', to);

      const respuesta = await fetch(url, { headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY } });
      const datos = await respuesta.json();
      return datos.response ?? [];
    }));

    return res.status(200).json({ fixtures: resultados.flat() });
  } catch (e) {
    const status = e instanceof ErrorHttp ? e.status : 500;
    return res.status(status).json({ error: e.message });
  }
}
```

- [ ] **Step 2: Crear `api/sync-results.js`**

```js
import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

function mapearResultado(golesLocal, golesVisitante) {
  if (golesLocal > golesVisitante) return 'L';
  if (golesLocal < golesVisitante) return 'V';
  return 'E';
}

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { jornada_id } = req.body;
    if (!jornada_id) return res.status(400).json({ error: 'Falta jornada_id' });

    const supabaseAdmin = getSupabaseAdmin();
    const { data: partidos, error } = await supabaseAdmin
      .from('partidos')
      .select('id, api_fixture_id')
      .eq('jornada_id', jornada_id)
      .not('api_fixture_id', 'is', null);
    if (error) throw error;

    for (const partido of partidos) {
      const url = new URL('https://v3.football.api-sports.io/fixtures');
      url.searchParams.set('id', partido.api_fixture_id);
      const respuesta = await fetch(url, { headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY } });
      const datos = await respuesta.json();
      const fixture = datos.response?.[0];
      if (!fixture || fixture.fixture.status.short !== 'FT') continue;

      const resultado = mapearResultado(fixture.goals.home, fixture.goals.away);
      await supabaseAdmin.from('partidos').update({ resultado_oficial: resultado }).eq('id', partido.id);
    }

    await supabaseAdmin.rpc('calcular_puntos', { p_jornada_id: jornada_id });

    return res.status(200).json({ status: 'ok' });
  } catch (e) {
    const status = e instanceof ErrorHttp ? e.status : 500;
    return res.status(status).json({ error: e.message });
  }
}
```

- [ ] **Step 3: Crear `api/comprobante-url.js`**

```js
import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { path } = req.body;
    if (!path) return res.status(400).json({ error: 'Falta path' });

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.storage
      .from('comprobantes')
      .createSignedUrl(path, 300);
    if (error) throw error;

    return res.status(200).json({ url: data.signedUrl });
  } catch (e) {
    const status = e instanceof ErrorHttp ? e.status : 500;
    return res.status(status).json({ error: e.message });
  }
}
```

- [ ] **Step 4: Verificar que compilan**

Run: `node --input-type=module -e "Promise.all(['./api/fixtures.js','./api/sync-results.js','./api/comprobante-url.js'].map(m => import(m))).then(() => console.log('OK'))"`
Expected: imprime `OK`.

- [ ] **Step 5: Commit**

```bash
git add api/fixtures.js api/sync-results.js api/comprobante-url.js
git commit -m "feat(api): endpoints de fixtures, sincronización de resultados y signed URL de comprobantes"
```

---

### Task 19: Endpoints serverless — `cerrar-jornada`, `cupones/aplicar`, `notificaciones/registro`

**Files:**
- Create: `api/cerrar-jornada.js`, `api/cupones/aplicar.js`, `api/notificaciones/registro.js`

**Interfaces:**
- Consumes: `requireAdmin`/`requireUser` (Task 15), `getSupabaseAdmin` (Task 15), `enviarCorreo` (Task 16), `calcularGanadoresYPeor` (Task 17).
- Produces: 3 endpoints consumidos por Task 20 (`adminService.js`) y Task 21/23 (`quinielasService.js`).

- [ ] **Step 1: Crear `api/cerrar-jornada.js`**

```js
import { requireAdmin, ErrorHttp } from './_lib/auth.js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { calcularGanadoresYPeor } from './_lib/premios.js';
import { enviarCorreo } from './_lib/email.js';

function generarCodigoCupon() {
  return 'QNL-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default async function handler(req, res) {
  try {
    await requireAdmin(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { jornada_id } = req.body;
    if (!jornada_id) return res.status(400).json({ error: 'Falta jornada_id' });

    const supabaseAdmin = getSupabaseAdmin();

    const { data: jornada } = await supabaseAdmin.from('jornadas').select('nombre, premio').eq('id', jornada_id).single();
    const { data: ranking, error } = await supabaseAdmin
      .from('vista_ranking_jornada')
      .select('quiniela_id, usuario_id, nombre_completo, alias, aciertos, posicion')
      .eq('jornada_id', jornada_id);
    if (error) throw error;
    if (!ranking || ranking.length === 0) return res.status(400).json({ error: 'No hay quinielas aprobadas en esta jornada' });

    const entradas = ranking.map((r) => ({ quinielaId: r.quiniela_id, usuarioId: r.usuario_id, aciertos: r.aciertos }));
    const { ganadores, peor } = calcularGanadoresYPeor(entradas, jornada?.premio ?? null);

    if (peor) {
      await supabaseAdmin.from('cupones').insert({
        codigo: generarCodigoCupon(),
        usuario_id: peor.usuarioId,
        jornada_origen_id: jornada_id,
      });
    }

    await supabaseAdmin.from('jornadas').update({ estatus: 'finalizada' }).eq('id', jornada_id);

    for (const participante of ranking) {
      const { data: perfil } = await supabaseAdmin.from('perfiles').select('nombre_completo').eq('id', participante.usuario_id).single();
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(participante.usuario_id);
      const correo = authUser?.user?.email;
      if (!correo) continue;

      const gano = ganadores.find((g) => g.quinielaId === participante.quiniela_id);
      const esPeor = peor?.quinielaId === participante.quiniela_id;

      let extra = '';
      if (gano) extra += `<p>🏆 ¡Felicidades! Ganaste $${gano.montoPremio.toFixed(2)} de premio.</p>`;
      if (esPeor) extra += `<p>🎟️ Te regalamos un cupón de quiniela gratis para tu próximo registro.</p>`;

      await enviarCorreo({
        to: correo,
        subject: `Resultado final: ${jornada?.nombre ?? 'tu jornada'}`,
        heading: `Resultado de ${jornada?.nombre ?? 'la jornada'}`,
        bodyHtml: `<p>Hola ${perfil?.nombre_completo ?? ''}, tu quiniela "${participante.alias ?? 'Entrada'}" obtuvo <b>${participante.aciertos} aciertos</b> y quedó en la posición <b>${participante.posicion}</b>.</p>${extra}`,
      });
    }

    return res.status(200).json({ status: 'ok', ganadores, peor });
  } catch (e) {
    const status = e instanceof ErrorHttp ? e.status : 500;
    return res.status(status).json({ error: e.message });
  }
}
```

- [ ] **Step 2: Crear `api/cupones/aplicar.js`**

```js
import { requireUser, ErrorHttp } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';

export default async function handler(req, res) {
  try {
    const { user } = await requireUser(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { codigo, quiniela_id } = req.body;
    if (!codigo || !quiniela_id) return res.status(400).json({ error: 'Faltan codigo o quiniela_id' });

    const supabaseAdmin = getSupabaseAdmin();

    const { data: cupon } = await supabaseAdmin
      .from('cupones')
      .select('id, estatus, usuario_id')
      .eq('codigo', codigo)
      .single();

    if (!cupon || cupon.usuario_id !== user.id || cupon.estatus !== 'activo') {
      return res.status(400).json({ error: 'Cupón inválido o ya utilizado' });
    }

    const { data: quiniela } = await supabaseAdmin.from('quinielas').select('usuario_id').eq('id', quiniela_id).single();
    if (!quiniela || quiniela.usuario_id !== user.id) {
      return res.status(403).json({ error: 'La quiniela no te pertenece' });
    }

    await supabaseAdmin.from('quinielas').update({
      estatus_pago: 'aprobado',
      metodo_pago: 'cupon',
      monto_pagado: 0,
    }).eq('id', quiniela_id);

    await supabaseAdmin.from('cupones').update({
      estatus: 'usado',
      usado_en_quiniela_id: quiniela_id,
      usado_el: new Date().toISOString(),
    }).eq('id', cupon.id);

    return res.status(200).json({ status: 'ok' });
  } catch (e) {
    const status = e instanceof ErrorHttp ? e.status : 500;
    return res.status(status).json({ error: e.message });
  }
}
```

- [ ] **Step 3: Crear `api/notificaciones/registro.js`**

```js
import { requireUser, ErrorHttp } from '../_lib/auth.js';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { enviarCorreo } from '../_lib/email.js';

export default async function handler(req, res) {
  try {
    const { user, perfil } = await requireUser(req);
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { quiniela_id } = req.body;
    if (!quiniela_id) return res.status(400).json({ error: 'Falta quiniela_id' });

    const supabaseAdmin = getSupabaseAdmin();
    const { data: quiniela } = await supabaseAdmin
      .from('quinielas')
      .select('usuario_id, alias, metodo_pago, monto_pagado, estatus_pago, jornada_id, jornadas(nombre)')
      .eq('id', quiniela_id)
      .single();

    if (!quiniela || (quiniela.usuario_id !== user.id && perfil?.rol !== 'admin')) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    await enviarCorreo({
      to: user.email,
      subject: `Quiniela registrada: ${quiniela.jornadas?.nombre ?? ''}`,
      heading: '¡Tu quiniela quedó registrada!',
      bodyHtml: `<p>Jornada: <b>${quiniela.jornadas?.nombre ?? ''}</b></p>
        <p>Entrada: ${quiniela.alias ?? 'Entrada'}</p>
        <p>Método de pago: ${quiniela.metodo_pago}</p>
        <p>Monto: $${Number(quiniela.monto_pagado ?? 0).toFixed(2)}</p>
        <p>Estatus: ${quiniela.estatus_pago}</p>`,
    });

    return res.status(200).json({ status: 'ok' });
  } catch (e) {
    const status = e instanceof ErrorHttp ? e.status : 500;
    return res.status(status).json({ error: e.message });
  }
}
```

- [ ] **Step 4: Verificar que compilan**

Run: `node --input-type=module -e "Promise.all(['./api/cerrar-jornada.js','./api/cupones/aplicar.js','./api/notificaciones/registro.js'].map(m => import(m))).then(() => console.log('OK'))"`
Expected: imprime `OK`.

- [ ] **Step 5: Commit**

```bash
git add api/cerrar-jornada.js api/cupones/ api/notificaciones/
git commit -m "feat(api): cierre de jornada (premio/cupón + correos), aplicar cupón y notificación de registro"
```

---

### Task 20: Módulo `admin` — servicio y router

**Files:**
- Create: `src/modules/admin/services/adminService.js`, `src/modules/admin/router.js`

**Interfaces:**
- Consumes: `supabase` (Task 10), endpoints de Tasks 18-19.
- Produces: funciones usadas por las vistas de Tasks 21-22: `buscarFixtures`, `crearJornada`, `listarPagosPendientes`, `aprobarPago`, `rechazarPago`, `registrarPagoEfectivo`, `obtenerComprobanteUrl`, `sincronizarResultados`, `cerrarJornada`, `editarQuinielaManual`.

- [ ] **Step 1: Crear `src/modules/admin/services/adminService.js`**

```js
import { supabase } from '@/lib/supabase';

async function llamarApi(ruta, opciones = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const respuesta = await fetch(`/api/${ruta}`, {
    ...opciones,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
      ...opciones.headers,
    },
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error ?? 'Error inesperado');
  return datos;
}

export async function buscarFixtures({ leagues, season, from, to }) {
  const query = new URLSearchParams({ leagues: leagues.join(','), season, from, to });
  return llamarApi(`fixtures?${query}`);
}

export async function crearJornada({ nombre, costo, premio, fechaCierre, partidosSeleccionados }) {
  const { data: jornada, error } = await supabase
    .from('jornadas')
    .insert({ nombre, costo, premio, fecha_cierre: fechaCierre })
    .select()
    .single();
  if (error) throw error;

  const partidos = partidosSeleccionados.map((p) => ({
    jornada_id: jornada.id,
    api_fixture_id: p.fixture.id,
    api_league_id: p.league.id,
    liga_nombre: p.league.name,
    equipo_local: p.teams.home.name,
    logo_local: p.teams.home.logo,
    equipo_visitante: p.teams.away.name,
    logo_visitante: p.teams.away.logo,
    fecha_partido: p.fixture.date,
  }));
  const { error: errorPartidos } = await supabase.from('partidos').insert(partidos);
  if (errorPartidos) throw errorPartidos;

  return jornada;
}

export async function listarPagosPendientes() {
  const { data, error } = await supabase
    .from('quinielas')
    .select('id, alias, monto_pagado, metodo_pago, comprobante_url, creado_el, jornadas(nombre), perfiles(nombre_completo)')
    .eq('estatus_pago', 'pendiente')
    .order('creado_el', { ascending: true });
  if (error) throw error;
  return data;
}

export async function aprobarPago(quinielaId) {
  const { error } = await supabase.from('quinielas').update({ estatus_pago: 'aprobado', revisado_el: new Date().toISOString() }).eq('id', quinielaId);
  if (error) throw error;
}

export async function rechazarPago(quinielaId) {
  const { error } = await supabase.from('quinielas').update({ estatus_pago: 'rechazado', revisado_el: new Date().toISOString() }).eq('id', quinielaId);
  if (error) throw error;
}

export async function registrarPagoEfectivo(quinielaId, monto) {
  const { error } = await supabase.from('quinielas').update({
    estatus_pago: 'aprobado',
    metodo_pago: 'efectivo',
    monto_pagado: monto,
    revisado_el: new Date().toISOString(),
  }).eq('id', quinielaId);
  if (error) throw error;
}

export async function obtenerComprobanteUrl(path) {
  const { url } = await llamarApi('comprobante-url', { method: 'POST', body: JSON.stringify({ path }) });
  return url;
}

export async function sincronizarResultados(jornadaId) {
  return llamarApi('sync-results', { method: 'POST', body: JSON.stringify({ jornada_id: jornadaId }) });
}

export async function cerrarJornada(jornadaId) {
  return llamarApi('cerrar-jornada', { method: 'POST', body: JSON.stringify({ jornada_id: jornadaId }) });
}

export async function editarQuinielaManual(quinielaId, cambios) {
  const { error } = await supabase.from('quinielas').update(cambios).eq('id', quinielaId);
  if (error) throw error;
}
```

- [ ] **Step 2: Crear `src/modules/admin/router.js`**

```js
export default [
  { path: '/admin/jornadas', name: 'admin-jornadas', component: () => import('./views/GestionJornadas.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/admin/pagos', name: 'admin-pagos', component: () => import('./views/AutorizacionPagos.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/admin/sincronizar', name: 'admin-sincronizar', component: () => import('./views/SincronizarResultados.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/admin/cerrar-jornada', name: 'admin-cerrar-jornada', component: () => import('./views/CerrarJornada.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/admin/edicion-manual', name: 'admin-edicion-manual', component: () => import('./views/EdicionManual.vue'), meta: { requiresAuth: true, requiresAdmin: true } },
];
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/admin/services/adminService.js src/modules/admin/router.js
git commit -m "feat(admin): servicio y rutas del panel de administración"
```

---

### Task 21: Vistas admin — `GestionJornadas` y `AutorizacionPagos`

**Files:**
- Create: `src/modules/admin/views/GestionJornadas.vue`, `src/modules/admin/views/AutorizacionPagos.vue`

**Interfaces:**
- Consumes: `adminService.js` (Task 20).

- [ ] **Step 1: Crear `src/modules/admin/views/GestionJornadas.vue`**

```vue
<script setup>
import { ref } from 'vue';
import { buscarFixtures, crearJornada } from '../services/adminService';

const ligas = ref('262');
const temporada = ref(new Date().getFullYear());
const desde = ref('');
const hasta = ref('');
const fixtures = ref([]);
const seleccionados = ref([]);
const nombreJornada = ref('');
const costo = ref(50);
const premio = ref(0);
const fechaCierre = ref('');
const mensaje = ref('');

async function buscar() {
  const { fixtures: encontrados } = await buscarFixtures({
    leagues: ligas.value.split(',').map((l) => l.trim()),
    season: temporada.value,
    from: desde.value,
    to: hasta.value,
  });
  fixtures.value = encontrados;
}

function alternarSeleccion(fixture) {
  const index = seleccionados.value.findIndex((f) => f.fixture.id === fixture.fixture.id);
  if (index >= 0) seleccionados.value.splice(index, 1);
  else seleccionados.value.push(fixture);
}

async function guardarJornada() {
  await crearJornada({
    nombre: nombreJornada.value,
    costo: costo.value,
    premio: premio.value,
    fechaCierre: fechaCierre.value,
    partidosSeleccionados: seleccionados.value,
  });
  mensaje.value = 'Jornada creada correctamente.';
  seleccionados.value = [];
}
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto space-y-6">
    <h1 class="text-2xl font-bold text-quiniela-verdeOscuro">Gestión de jornadas</h1>

    <section class="bg-white rounded-lg shadow p-4 space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <input v-model="ligas" placeholder="IDs de liga separados por coma (ej. 262,2)" class="border rounded px-3 py-2" />
        <input v-model="temporada" type="number" placeholder="Temporada" class="border rounded px-3 py-2" />
        <input v-model="desde" type="date" class="border rounded px-3 py-2" />
        <input v-model="hasta" type="date" class="border rounded px-3 py-2" />
      </div>
      <button @click="buscar" class="bg-quiniela-verde text-white px-4 py-2 rounded">Buscar partidos</button>
    </section>

    <section v-if="fixtures.length" class="bg-white rounded-lg shadow p-4 space-y-2">
      <label v-for="f in fixtures" :key="f.fixture.id" class="flex items-center gap-2 border-b py-2">
        <input type="checkbox" :checked="seleccionados.some(s => s.fixture.id === f.fixture.id)" @change="alternarSeleccion(f)" />
        <span>{{ f.league.name }} — {{ f.teams.home.name }} vs {{ f.teams.away.name }}</span>
      </label>
    </section>

    <section v-if="seleccionados.length" class="bg-white rounded-lg shadow p-4 space-y-3">
      <h2 class="font-semibold text-quiniela-verde">Datos de la jornada ({{ seleccionados.length }} partidos)</h2>
      <input v-model="nombreJornada" placeholder="Nombre de la jornada" class="w-full border rounded px-3 py-2" />
      <div class="grid grid-cols-3 gap-3">
        <input v-model="costo" type="number" placeholder="Costo" class="border rounded px-3 py-2" />
        <input v-model="premio" type="number" placeholder="Premio (opcional)" class="border rounded px-3 py-2" />
        <input v-model="fechaCierre" type="datetime-local" class="border rounded px-3 py-2" />
      </div>
      <button @click="guardarJornada" class="bg-quiniela-dorado text-quiniela-grisTexto font-semibold px-4 py-2 rounded">
        Publicar jornada
      </button>
      <p v-if="mensaje" class="text-quiniela-verdeAcento">{{ mensaje }}</p>
    </section>
  </div>
</template>
```

- [ ] **Step 2: Crear `src/modules/admin/views/AutorizacionPagos.vue`**

```vue
<script setup>
import { ref, onMounted } from 'vue';
import { listarPagosPendientes, aprobarPago, rechazarPago, registrarPagoEfectivo, obtenerComprobanteUrl } from '../services/adminService';

const pendientes = ref([]);

async function cargar() {
  pendientes.value = await listarPagosPendientes();
}

async function verComprobante(path) {
  const url = await obtenerComprobanteUrl(path);
  window.open(url, '_blank');
}

async function aprobar(id) {
  await aprobarPago(id);
  await cargar();
}

async function rechazar(id) {
  await rechazarPago(id);
  await cargar();
}

async function marcarEfectivo(id, monto) {
  await registrarPagoEfectivo(id, monto);
  await cargar();
}

onMounted(cargar);
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto space-y-4">
    <h1 class="text-2xl font-bold text-quiniela-verdeOscuro">Autorización de pagos</h1>
    <div v-for="q in pendientes" :key="q.id" class="bg-white rounded-lg shadow p-4 flex justify-between items-center">
      <div>
        <p class="font-semibold">{{ q.perfiles?.nombre_completo }} — {{ q.jornadas?.nombre }}</p>
        <p class="text-sm text-gray-600">{{ q.alias }} · {{ q.metodo_pago }} · ${{ q.monto_pagado ?? '—' }}</p>
      </div>
      <div class="flex gap-2">
        <button v-if="q.comprobante_url" @click="verComprobante(q.comprobante_url)" class="text-quiniela-verde underline text-sm">Ver comprobante</button>
        <button v-if="q.metodo_pago === 'efectivo'" @click="marcarEfectivo(q.id, q.monto_pagado)" class="bg-quiniela-dorado text-quiniela-grisTexto px-3 py-1 rounded text-sm">Marcar pagado</button>
        <button @click="aprobar(q.id)" class="bg-quiniela-verdeAcento text-white px-3 py-1 rounded text-sm">Aprobar</button>
        <button @click="rechazar(q.id)" class="bg-quiniela-error text-white px-3 py-1 rounded text-sm">Rechazar</button>
      </div>
    </div>
    <p v-if="!pendientes.length" class="text-gray-500">No hay pagos pendientes.</p>
  </div>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/admin/views/GestionJornadas.vue src/modules/admin/views/AutorizacionPagos.vue
git commit -m "feat(admin): vistas de gestión de jornadas y autorización de pagos"
```

---

### Task 22: Vistas admin — `SincronizarResultados`, `CerrarJornada`, `EdicionManual`

**Files:**
- Create: `src/modules/admin/views/SincronizarResultados.vue`, `src/modules/admin/views/CerrarJornada.vue`, `src/modules/admin/views/EdicionManual.vue`

**Interfaces:**
- Consumes: `adminService.js` (Task 20).

- [ ] **Step 1: Crear `src/modules/admin/views/SincronizarResultados.vue`**

```vue
<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '@/lib/supabase';
import { sincronizarResultados } from '../services/adminService';

const jornadas = ref([]);
const mensaje = ref('');
const cargando = ref(false);

async function cargar() {
  const { data } = await supabase.from('jornadas').select('id, nombre, estatus').neq('estatus', 'finalizada');
  jornadas.value = data ?? [];
}

async function sincronizar(id) {
  cargando.value = true;
  mensaje.value = '';
  try {
    await sincronizarResultados(id);
    mensaje.value = 'Resultados sincronizados.';
  } finally {
    cargando.value = false;
  }
}

onMounted(cargar);
</script>

<template>
  <div class="p-6 max-w-2xl mx-auto space-y-4">
    <h1 class="text-2xl font-bold text-quiniela-verdeOscuro">Sincronizar resultados</h1>
    <div v-for="j in jornadas" :key="j.id" class="bg-white rounded-lg shadow p-4 flex justify-between items-center">
      <span>{{ j.nombre }} ({{ j.estatus }})</span>
      <button @click="sincronizar(j.id)" :disabled="cargando" class="bg-quiniela-verde text-white px-4 py-2 rounded">
        Sincronizar marcadores
      </button>
    </div>
    <p v-if="mensaje" class="text-quiniela-verdeAcento">{{ mensaje }}</p>
  </div>
</template>
```

- [ ] **Step 2: Crear `src/modules/admin/views/CerrarJornada.vue`**

```vue
<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '@/lib/supabase';
import { cerrarJornada } from '../services/adminService';

const jornadas = ref([]);
const resultado = ref(null);
const cargando = ref(false);

async function cargar() {
  const { data } = await supabase.from('jornadas').select('id, nombre, estatus').neq('estatus', 'finalizada');
  jornadas.value = data ?? [];
}

async function cerrar(id) {
  cargando.value = true;
  try {
    resultado.value = await cerrarJornada(id);
    await cargar();
  } finally {
    cargando.value = false;
  }
}

onMounted(cargar);
</script>

<template>
  <div class="p-6 max-w-2xl mx-auto space-y-4">
    <h1 class="text-2xl font-bold text-quiniela-verdeOscuro">Cerrar jornada</h1>
    <p class="text-sm text-gray-600">Sincroniza los resultados antes de cerrar la jornada.</p>
    <div v-for="j in jornadas" :key="j.id" class="bg-white rounded-lg shadow p-4 flex justify-between items-center">
      <span>{{ j.nombre }} ({{ j.estatus }})</span>
      <button @click="cerrar(j.id)" :disabled="cargando" class="bg-quiniela-dorado text-quiniela-grisTexto font-semibold px-4 py-2 rounded">
        Cerrar jornada y enviar resultados
      </button>
    </div>
    <pre v-if="resultado" class="bg-white rounded p-4 text-sm overflow-auto">{{ resultado }}</pre>
  </div>
</template>
```

- [ ] **Step 3: Crear `src/modules/admin/views/EdicionManual.vue`**

```vue
<script setup>
import { ref } from 'vue';
import { supabase } from '@/lib/supabase';
import { editarQuinielaManual } from '../services/adminService';

const quinielaId = ref('');
const quiniela = ref(null);
const mensaje = ref('');

async function buscar() {
  const { data } = await supabase.from('quinielas').select('*').eq('id', quinielaId.value).single();
  quiniela.value = data;
}

async function guardar() {
  await editarQuinielaManual(quiniela.value.id, {
    alias: quiniela.value.alias,
    estatus_pago: quiniela.value.estatus_pago,
    metodo_pago: quiniela.value.metodo_pago,
    monto_pagado: quiniela.value.monto_pagado,
  });
  mensaje.value = 'Quiniela actualizada.';
}
</script>

<template>
  <div class="p-6 max-w-xl mx-auto space-y-4">
    <h1 class="text-2xl font-bold text-quiniela-verdeOscuro">Edición manual de quiniela</h1>
    <div class="flex gap-2">
      <input v-model="quinielaId" placeholder="ID de la quiniela" class="flex-1 border rounded px-3 py-2" />
      <button @click="buscar" class="bg-quiniela-verde text-white px-4 py-2 rounded">Buscar</button>
    </div>
    <div v-if="quiniela" class="bg-white rounded-lg shadow p-4 space-y-3">
      <input v-model="quiniela.alias" placeholder="Alias" class="w-full border rounded px-3 py-2" />
      <select v-model="quiniela.estatus_pago" class="w-full border rounded px-3 py-2">
        <option value="pendiente">pendiente</option>
        <option value="aprobado">aprobado</option>
        <option value="rechazado">rechazado</option>
      </select>
      <select v-model="quiniela.metodo_pago" class="w-full border rounded px-3 py-2">
        <option value="transferencia">transferencia</option>
        <option value="efectivo">efectivo</option>
        <option value="cupon">cupon</option>
      </select>
      <input v-model="quiniela.monto_pagado" type="number" placeholder="Monto pagado" class="w-full border rounded px-3 py-2" />
      <button @click="guardar" class="bg-quiniela-dorado text-quiniela-grisTexto font-semibold px-4 py-2 rounded">Guardar</button>
      <p v-if="mensaje" class="text-quiniela-verdeAcento">{{ mensaje }}</p>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Commit**

```bash
git add src/modules/admin/views/SincronizarResultados.vue src/modules/admin/views/CerrarJornada.vue src/modules/admin/views/EdicionManual.vue
git commit -m "feat(admin): vistas de sincronización, cierre de jornada y edición manual"
```

---

### Task 23: Módulo `quinielas` — servicio y componentes compartidos

**Files:**
- Create: `src/modules/quinielas/services/quinielasService.js`, `src/modules/quinielas/components/TablaPosiciones.vue`

**Interfaces:**
- Consumes: `supabase` (Task 10), vistas de ranking (Task 8).
- Produces: funciones usadas por Tasks 24-25: `obtenerJornadaActiva`, `obtenerPartidos`, `crearQuiniela`, `guardarPredicciones`, `subirComprobante`, `notificarRegistro`, `aplicarCupon`, `obtenerMisQuinielas`, `obtenerRanking`; componente `<TablaPosiciones :jornadaId>`.

- [ ] **Step 1: Crear `src/modules/quinielas/services/quinielasService.js`**

```js
import { supabase } from '@/lib/supabase';

async function llamarApi(ruta, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const respuesta = await fetch(`/api/${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify(body),
  });
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error ?? 'Error inesperado');
  return datos;
}

export async function obtenerJornadaActiva() {
  const { data, error } = await supabase.from('jornadas').select('*').eq('estatus', 'activa').order('fecha_cierre', { ascending: true }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function obtenerPartidos(jornadaId) {
  const { data, error } = await supabase.from('partidos').select('*').eq('jornada_id', jornadaId).order('fecha_partido');
  if (error) throw error;
  return data;
}

export async function crearQuiniela({ jornadaId, alias, metodoPago, montoPagado, comprobanteUrl }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('quinielas').insert({
    usuario_id: user.id,
    jornada_id: jornadaId,
    alias,
    metodo_pago: metodoPago,
    monto_pagado: montoPagado,
    comprobante_url: comprobanteUrl,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function guardarPredicciones(quinielaId, predicciones) {
  const filas = predicciones.map(({ partidoId, pronostico }) => ({ quiniela_id: quinielaId, partido_id: partidoId, pronostico }));
  const { error } = await supabase.from('predicciones').insert(filas);
  if (error) throw error;
}

export async function subirComprobante(archivo) {
  const { data: { user } } = await supabase.auth.getUser();
  const extension = archivo.name.split('.').pop();
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from('comprobantes').upload(path, archivo);
  if (error) throw error;
  return path;
}

export async function notificarRegistro(quinielaId) {
  return llamarApi('notificaciones/registro', { quiniela_id: quinielaId });
}

export async function aplicarCupon(codigo, quinielaId) {
  return llamarApi('cupones/aplicar', { codigo, quiniela_id: quinielaId });
}

export async function obtenerMisQuinielas() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('quinielas')
    .select('id, jornada_id, alias, estatus_pago, metodo_pago, monto_pagado, aciertos, creado_el, jornadas(nombre)')
    .eq('usuario_id', user.id)
    .order('creado_el', { ascending: false });
  if (error) throw error;
  return data;
}

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

- [ ] **Step 2: Crear `src/modules/quinielas/components/TablaPosiciones.vue`**

```vue
<script setup>
import { ref, onMounted, watch } from 'vue';

const props = defineProps({
  jornadaId: { type: String, required: true },
  obtenerRankingFn: { type: Function, required: true },
});

const filas = ref([]);

async function cargar() {
  if (!props.jornadaId) return;
  filas.value = await props.obtenerRankingFn(props.jornadaId);
}

onMounted(cargar);
watch(() => props.jornadaId, cargar);

defineExpose({ recargar: cargar });
</script>

<template>
  <table class="w-full bg-white rounded-lg shadow overflow-hidden">
    <thead class="bg-quiniela-verdeOscuro text-white">
      <tr>
        <th class="px-4 py-2 text-left">Pos.</th>
        <th class="px-4 py-2 text-left">Participante</th>
        <th class="px-4 py-2 text-right">Aciertos</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="fila in filas" :key="fila.quiniela_id ?? fila.mostrar_como" class="border-b">
        <td class="px-4 py-2">{{ fila.posicion }}</td>
        <td class="px-4 py-2">{{ fila.alias ?? fila.mostrar_como ?? fila.nombre_completo }}</td>
        <td class="px-4 py-2 text-right font-semibold text-quiniela-verde">{{ fila.aciertos }}</td>
      </tr>
    </tbody>
  </table>
</template>
```

Nota: `TablaPosiciones` recibe `obtenerRankingFn` como prop para poder reusarse tanto con `obtenerRanking` (Task 23, usuarios logueados) como con la consulta pública a `vista_ranking_publica` (Task 25), sin acoplarse a un único servicio.

- [ ] **Step 3: Commit**

```bash
git add src/modules/quinielas/services/quinielasService.js src/modules/quinielas/components/TablaPosiciones.vue
git commit -m "feat(quinielas): servicio de quinielas y componente compartido de tabla de posiciones"
```

---

### Task 24: Vistas usuario — `LlenarQuiniela` con `TarjetaPartido` y `PasoPago`

**Files:**
- Create: `src/modules/quinielas/components/TarjetaPartido.vue`, `src/modules/quinielas/components/PasoPago.vue`, `src/modules/quinielas/views/LlenarQuiniela.vue`

**Interfaces:**
- Consumes: `quinielasService.js` (Task 23), `countdown.js` (Task 13).

- [ ] **Step 1: Crear `src/modules/quinielas/components/TarjetaPartido.vue`**

```vue
<script setup>
defineProps({
  partido: { type: Object, required: true },
  modelValue: { type: String, default: null },
  deshabilitado: { type: Boolean, default: false },
});
defineEmits(['update:modelValue']);
</script>

<template>
  <div class="bg-white rounded-lg shadow p-4">
    <p class="text-xs text-quiniela-verde font-semibold mb-2">{{ partido.liga_nombre }}</p>
    <p class="text-center font-semibold mb-3">{{ partido.equipo_local }} vs {{ partido.equipo_visitante }}</p>
    <div class="grid grid-cols-3 gap-2">
      <button v-for="opcion in ['L', 'E', 'V']" :key="opcion"
        :disabled="deshabilitado"
        @click="$emit('update:modelValue', opcion)"
        :class="[
          'py-2 rounded font-semibold border',
          modelValue === opcion ? 'bg-quiniela-dorado border-quiniela-doradoOscuro text-quiniela-grisTexto' : 'border-gray-300 text-gray-600',
          deshabilitado ? 'opacity-50 cursor-not-allowed' : 'hover:border-quiniela-verde'
        ]">
        {{ opcion }}
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Crear `src/modules/quinielas/components/PasoPago.vue`**

```vue
<script setup>
import { ref } from 'vue';

const emit = defineEmits(['confirmar']);
const metodo = ref('transferencia');
const archivo = ref(null);
const codigoCupon = ref('');

function onArchivo(evento) {
  archivo.value = evento.target.files[0] ?? null;
}

function confirmar() {
  emit('confirmar', { metodo: metodo.value, archivo: archivo.value, codigoCupon: codigoCupon.value });
}
</script>

<template>
  <div class="bg-white rounded-lg shadow p-4 space-y-4">
    <h2 class="font-semibold text-quiniela-verde">Método de pago</h2>
    <div class="flex gap-4">
      <label class="flex items-center gap-1"><input type="radio" value="transferencia" v-model="metodo" /> Transferencia SPEI</label>
      <label class="flex items-center gap-1"><input type="radio" value="efectivo" v-model="metodo" /> Efectivo</label>
      <label class="flex items-center gap-1"><input type="radio" value="cupon" v-model="metodo" /> Cupón</label>
    </div>

    <div v-if="metodo === 'transferencia'" class="space-y-2">
      <p class="text-sm bg-quiniela-grisClaro p-3 rounded">CLABE: 000000000000000000 · Banco: Ejemplo · Beneficiario: Quinielas JR</p>
      <input type="file" accept="image/*,application/pdf" @change="onArchivo" />
    </div>

    <p v-else-if="metodo === 'efectivo'" class="text-sm text-gray-600">
      Contacta al administrador para pagar en persona; tu quiniela quedará pendiente hasta que confirme el pago.
    </p>

    <div v-else class="space-y-2">
      <input v-model="codigoCupon" placeholder="Código de cupón" class="w-full border rounded px-3 py-2" />
    </div>

    <button @click="confirmar" class="w-full bg-quiniela-dorado text-quiniela-grisTexto font-semibold py-2 rounded">
      Confirmar quiniela
    </button>
  </div>
</template>
```

- [ ] **Step 3: Crear `src/modules/quinielas/views/LlenarQuiniela.vue`**

```vue
<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import TarjetaPartido from '../components/TarjetaPartido.vue';
import PasoPago from '../components/PasoPago.vue';
import { calcularTiempoRestante, estaBloqueado } from '../utils/countdown';
import {
  obtenerJornadaActiva, obtenerPartidos, crearQuiniela, guardarPredicciones,
  subirComprobante, notificarRegistro, aplicarCupon,
} from '../services/quinielasService';

const jornada = ref(null);
const partidos = ref([]);
const pronosticos = ref({});
const alias = ref('Entrada 1');
const mostrarPago = ref(false);
const mensaje = ref('');
const tiempoRestante = ref(null);
let intervalo;

const bloqueado = computed(() => jornada.value && estaBloqueado(jornada.value.fecha_cierre));
const completo = computed(() => partidos.value.length > 0 && partidos.value.every((p) => pronosticos.value[p.id]));

async function cargar() {
  jornada.value = await obtenerJornadaActiva();
  if (jornada.value) partidos.value = await obtenerPartidos(jornada.value.id);
}

function actualizarTiempo() {
  if (jornada.value) tiempoRestante.value = calcularTiempoRestante(jornada.value.fecha_cierre);
}

async function confirmarPago({ metodo, archivo, codigoCupon }) {
  mensaje.value = '';
  let comprobanteUrl = null;
  if (metodo === 'transferencia' && archivo) {
    comprobanteUrl = await subirComprobante(archivo);
  }

  const quiniela = await crearQuiniela({
    jornadaId: jornada.value.id,
    alias: alias.value,
    metodoPago: metodo,
    montoPagado: metodo === 'cupon' ? 0 : jornada.value.costo,
    comprobanteUrl,
  });

  await guardarPredicciones(quiniela.id, Object.entries(pronosticos.value).map(([partidoId, pronostico]) => ({ partidoId, pronostico })));

  if (metodo === 'cupon') {
    await aplicarCupon(codigoCupon, quiniela.id);
  }

  await notificarRegistro(quiniela.id);
  mensaje.value = 'Quiniela registrada. Revisa tu correo para la confirmación.';
  mostrarPago.value = false;
  pronosticos.value = {};
}

onMounted(async () => {
  await cargar();
  actualizarTiempo();
  intervalo = setInterval(actualizarTiempo, 1000);
});
onUnmounted(() => clearInterval(intervalo));
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto space-y-4">
    <h1 class="text-2xl font-bold text-quiniela-verdeOscuro">Llenar quiniela</h1>

    <div v-if="!jornada" class="text-gray-500">No hay una jornada activa en este momento.</div>

    <template v-else>
      <div class="bg-quiniela-verdeOscuro text-white rounded-lg p-4 flex justify-between items-center">
        <span class="font-semibold">{{ jornada.nombre }}</span>
        <span v-if="tiempoRestante && !tiempoRestante.vencido">
          Cierra en {{ tiempoRestante.dias }}d {{ tiempoRestante.horas }}h {{ tiempoRestante.minutos }}m {{ tiempoRestante.segundos }}s
        </span>
        <span v-else class="text-quiniela-error font-semibold">Cerrada</span>
      </div>

      <input v-model="alias" placeholder="Nombre de tu entrada" class="w-full border rounded px-3 py-2" :disabled="bloqueado" />

      <div class="grid gap-3">
        <TarjetaPartido
          v-for="p in partidos" :key="p.id"
          :partido="p"
          v-model="pronosticos[p.id]"
          :deshabilitado="bloqueado"
        />
      </div>

      <button v-if="!mostrarPago" :disabled="bloqueado || !completo" @click="mostrarPago = true"
        class="w-full bg-quiniela-verde text-white font-semibold py-2 rounded disabled:opacity-50">
        Continuar al pago
      </button>

      <PasoPago v-if="mostrarPago" @confirmar="confirmarPago" />

      <p v-if="mensaje" class="text-quiniela-verdeAcento">{{ mensaje }}</p>
    </template>
  </div>
</template>
```

- [ ] **Step 4: Verificar**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 5: Commit**

```bash
git add src/modules/quinielas/components/TarjetaPartido.vue src/modules/quinielas/components/PasoPago.vue src/modules/quinielas/views/LlenarQuiniela.vue
git commit -m "feat(quinielas): vista de llenado con tarjetas, countdown y los 3 métodos de pago"
```

---

### Task 25: Vista usuario — `MisQuinielas` + router del módulo `quinielas`

**Files:**
- Create: `src/modules/quinielas/views/MisQuinielas.vue`, `src/modules/quinielas/router.js`

**Interfaces:**
- Consumes: `quinielasService.js` (Task 23), `balance.js` (Task 14), `TablaPosiciones.vue` (Task 23).
- Produces: rutas `name: 'mis-quinielas'`, `'llenar-quiniela'` — usadas por Task 11 (`router/index.js`, ya importado) y por los redirects post-login del store de auth.

- [ ] **Step 1: Crear `src/modules/quinielas/views/MisQuinielas.vue`**

```vue
<script setup>
import { ref, onMounted } from 'vue';
import { obtenerMisQuinielas, obtenerRanking } from '../services/quinielasService';
import { calcularResumenBalance } from '../utils/balance';
import TablaPosiciones from '../components/TablaPosiciones.vue';

const quinielas = ref([]);
const resumen = ref(null);
const jornadaActivaId = ref(null);

async function cargar() {
  quinielas.value = await obtenerMisQuinielas();
  resumen.value = calcularResumenBalance(quinielas.value);
  jornadaActivaId.value = quinielas.value[0]?.jornada_id ?? null;
}

onMounted(cargar);
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto space-y-6">
    <h1 class="text-2xl font-bold text-quiniela-verdeOscuro">Mis quinielas</h1>

    <div v-if="resumen" class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="bg-white rounded-lg shadow p-4 text-center">
        <p class="text-xs text-gray-500">Gastado</p>
        <p class="text-xl font-bold text-quiniela-verde">${{ resumen.totalGastado }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4 text-center">
        <p class="text-xs text-gray-500">Jornadas jugadas</p>
        <p class="text-xl font-bold text-quiniela-verde">{{ resumen.jornadasJugadas }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4 text-center">
        <p class="text-xs text-gray-500">Aciertos promedio</p>
        <p class="text-xl font-bold text-quiniela-verde">{{ resumen.aciertosPromedio }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4 text-center">
        <p class="text-xs text-gray-500">Mejor posición</p>
        <p class="text-xl font-bold text-quiniela-dorado">{{ resumen.mejorPosicion ?? '—' }}</p>
      </div>
    </div>

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
          <td class="px-4 py-2">{{ q.estatus_pago }} ({{ q.metodo_pago }})</td>
          <td class="px-4 py-2 text-right">{{ q.aciertos }}</td>
        </tr>
      </tbody>
    </table>

    <div v-if="jornadaActivaId">
      <h2 class="font-semibold text-quiniela-verde mb-2">Tabla de posiciones</h2>
      <TablaPosiciones :jornadaId="jornadaActivaId" :obtenerRankingFn="obtenerRanking" />
    </div>
  </div>
</template>
```

- [ ] **Step 2: Crear `src/modules/quinielas/router.js`**

```js
export default [
  { path: '/', redirect: { name: 'mis-quinielas' } },
  { path: '/mis-quinielas', name: 'mis-quinielas', component: () => import('./views/MisQuinielas.vue'), meta: { requiresAuth: true } },
  { path: '/llenar-quiniela', name: 'llenar-quiniela', component: () => import('./views/LlenarQuiniela.vue'), meta: { requiresAuth: true } },
];
```

- [ ] **Step 3: Verificar**

Run: `npm run build`
Expected: build exitoso — con esto ya están resueltos todos los imports de `router/index.js` salvo `publico` (Task 26).

- [ ] **Step 4: Commit**

```bash
git add src/modules/quinielas/views/MisQuinielas.vue src/modules/quinielas/router.js
git commit -m "feat(quinielas): vista de historial/balance y router del módulo"
```

---

### Task 26: Módulo `publico` — tabla pública sin login

**Files:**
- Create: `src/modules/publico/views/TablaPublica.vue`, `src/modules/publico/router.js`, `src/layouts/PublicoLayout.vue`

**Interfaces:**
- Consumes: `supabase` (Task 10), `TablaPosiciones.vue` (Task 23).
- Produces: ruta `name: 'tabla-publica'`, `path: '/publico/:jornadaId'`, sin `requiresAuth`.

- [ ] **Step 1: Crear `src/layouts/PublicoLayout.vue`**

```vue
<template>
  <div class="min-h-screen bg-quiniela-grisClaro">
    <header class="bg-quiniela-verdeOscuro text-white py-4 text-center font-bold text-xl">
      Quinielas JR
    </header>
    <main>
      <router-view />
    </main>
  </div>
</template>
```

- [ ] **Step 2: Crear `src/modules/publico/views/TablaPublica.vue`**

```vue
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { supabase } from '@/lib/supabase';
import TablaPosiciones from '@/modules/quinielas/components/TablaPosiciones.vue';

const route = useRoute();
const jornadaId = route.params.jornadaId;
const jornada = ref(null);
const partidos = ref([]);
let intervalo;

async function obtenerRankingPublico(jId) {
  const { data, error } = await supabase
    .from('vista_ranking_publica')
    .select('*')
    .eq('jornada_id', jId)
    .order('posicion');
  if (error) throw error;
  return data;
}

async function cargar() {
  const { data: j } = await supabase.from('jornadas').select('nombre').eq('id', jornadaId).single();
  jornada.value = j;
  const { data: p } = await supabase.from('partidos').select('*').eq('jornada_id', jornadaId).order('fecha_partido');
  partidos.value = p ?? [];
}

onMounted(() => {
  cargar();
  intervalo = setInterval(cargar, 30000);
});
onUnmounted(() => clearInterval(intervalo));
</script>

<template>
  <div class="p-6 max-w-2xl mx-auto space-y-6">
    <h1 class="text-2xl font-bold text-quiniela-verdeOscuro text-center">{{ jornada?.nombre }}</h1>

    <div class="grid gap-2">
      <div v-for="p in partidos" :key="p.id" class="bg-white rounded-lg shadow p-3 flex justify-between items-center">
        <span>{{ p.liga_nombre }}: {{ p.equipo_local }} vs {{ p.equipo_visitante }}</span>
        <span class="font-bold text-quiniela-verde">{{ p.resultado_oficial ?? '—' }}</span>
      </div>
    </div>

    <div>
      <h2 class="font-semibold text-quiniela-verde mb-2">Tabla de posiciones</h2>
      <TablaPosiciones :jornadaId="jornadaId" :obtenerRankingFn="obtenerRankingPublico" />
    </div>
  </div>
</template>
```

- [ ] **Step 3: Crear `src/modules/publico/router.js`**

```js
export default [
  {
    path: '/publico/:jornadaId',
    name: 'tabla-publica',
    component: () => import('./views/TablaPublica.vue'),
  },
];
```

- [ ] **Step 4: Verificar**

Run: `npm run build`
Expected: build exitoso — con esto todos los imports de `router/index.js` (Task 11) quedan resueltos.

- [ ] **Step 5: Commit**

```bash
git add src/modules/publico/ src/layouts/PublicoLayout.vue
git commit -m "feat(publico): tabla de resultados en vivo sin login, para compartir por WhatsApp"
```

---

### Task 27: Ensamblaje final — layouts, nav y `main.js`

**Files:**
- Modify: `src/layouts/AppLayout.vue`, `src/layouts/AuthLayout.vue`, `src/components/NavbarComponent.vue`, `src/App.vue`, `src/main.js`

**Interfaces:**
- Consumes: `useAuthStore` (Task 11), todas las rutas anteriores.

- [ ] **Step 1: Adaptar `src/components/NavbarComponent.vue`**

```vue
<script setup>
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const router = useRouter();

async function salir() {
  await authStore.cerrarSesion();
  router.push({ name: 'login' });
}
</script>

<template>
  <nav class="bg-quiniela-verdeOscuro text-white px-6 py-3 flex justify-between items-center">
    <div class="flex items-center gap-2">
      <img src="@assets/logo.png" alt="Quinielas JR" class="h-8 w-8 rounded-full" />
      <span class="font-bold">Quinielas JR</span>
    </div>
    <div class="flex gap-4 text-sm items-center">
      <router-link :to="{ name: 'mis-quinielas' }">Mis quinielas</router-link>
      <router-link :to="{ name: 'llenar-quiniela' }">Llenar quiniela</router-link>
      <template v-if="authStore.isAdmin">
        <router-link :to="{ name: 'admin-jornadas' }">Jornadas</router-link>
        <router-link :to="{ name: 'admin-pagos' }">Pagos</router-link>
        <router-link :to="{ name: 'admin-sincronizar' }">Sincronizar</router-link>
        <router-link :to="{ name: 'admin-cerrar-jornada' }">Cerrar jornada</router-link>
        <router-link :to="{ name: 'admin-edicion-manual' }">Edición manual</router-link>
      </template>
      <button @click="salir" class="bg-quiniela-dorado text-quiniela-grisTexto px-3 py-1 rounded font-semibold">Salir</button>
    </div>
  </nav>
</template>
```

- [ ] **Step 2: Adaptar `src/layouts/AppLayout.vue`**

```vue
<script setup>
import NavbarComponent from '@/components/NavbarComponent.vue';
</script>

<template>
  <div class="min-h-screen bg-quiniela-grisClaro">
    <NavbarComponent />
    <router-view />
  </div>
</template>
```

- [ ] **Step 3: Adaptar `src/layouts/AuthLayout.vue`**

```vue
<template>
  <router-view />
</template>
```

- [ ] **Step 4: Adaptar `src/App.vue`**

```vue
<script setup>
import { onMounted } from 'vue';
import { useAuthStore } from '@/store/auth';

const authStore = useAuthStore();
onMounted(() => authStore.init());
</script>

<template>
  <router-view />
</template>
```

- [ ] **Step 5: Verificar `src/main.js`**

Confirmar que crea la app con Pinia y el router, y monta en `#app` (ajustar imports rotos si el archivo original referenciaba Vuetify/i18n eliminados):

```js
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './style.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
```

- [ ] **Step 6: Verificación final de build y pruebas**

Run: `npm run build && npx vitest run`
Expected: build exitoso y todos los tests unitarios (`countdown`, `balance`, `premios`) en PASS.

- [ ] **Step 7: Commit**

```bash
git add src/layouts/ src/components/NavbarComponent.vue src/App.vue src/main.js
git commit -m "feat(frontend): navegación por rol y ensamblaje final de la app"
```

---

### Task 28: Documentación de despliegue

**Files:**
- Modify: `README.md`

**Interfaces:** ninguna (task de documentación).

- [ ] **Step 1: Reescribir `README.md`**

```markdown
# Quinielas JR

Plataforma de quinielas deportivas (Vue 3 + Tailwind + Vercel Functions + Supabase + API-Football).

## Desarrollo local

1. Copia `.env.example` a `.env.local` y llena las variables `VITE_*`.
2. `npm install`
3. `npm run dev`

## Base de datos (Supabase)

1. Instala el [Supabase CLI](https://supabase.com/docs/guides/cli).
2. `npx supabase start` (requiere Docker) para el stack local.
3. `npx supabase db reset` aplica todas las migraciones de `supabase/migrations/`.
4. Para un proyecto real en supabase.com: `npx supabase link` y `npx supabase db push`.

## Pruebas

`npm run test` corre las pruebas unitarias (countdown, balance, reparto de premios).
Las pruebas SQL (`supabase/tests/*.test.sql`) se corren con `psql "$(npx supabase status -o json | jq -r .DB_URL)" -f supabase/tests/<archivo>.sql` tras cada `db reset`.

## Despliegue en Vercel

1. Importa el repo en Vercel.
2. Configura las variables de entorno de `.env.example` (las `VITE_*` y las privadas del servidor) en el proyecto de Vercel.
3. Deploy — `vercel.json` ya define el rewrite SPA y las funciones de `/api`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README de desarrollo local, pruebas y despliegue"
```

---

## Self-Review (registro)

- **Cobertura del spec:** cada sección del spec (`2026-09-07-quinielas-liga-mx-design.md`) tiene tarea(s) que la implementan — limpieza (T1-2), esquema+RLS (T3-9), auth/OTP (T10-12), pagos con 3 métodos (T18-19, T20-24), premio/cupón/cierre de jornada (T17, T19, T21-22), notificaciones por correo propias (T16, T19), tabla pública (T26), branding/paleta (T2, T10, T27).
- **Placeholders:** ninguno — todo step de código trae su contenido completo, sin "TBD" ni "similar a".
- **Consistencia de tipos/nombres:** verificado que `metodo_pago` (`transferencia|efectivo|cupon`), `calcular_puntos(p_jornada_id)`, `calcularGanadoresYPeor(entradas, premioTotal)`, `calcularTiempoRestante`/`estaBloqueado`, `calcularResumenBalance`, `useAuthStore` (`isLoggedIn`/`isAdmin`) y los nombres de rutas (`mis-quinielas`, `llenar-quiniela`, `admin-*`, `tabla-publica`) se usan igual en todas las tareas que los consumen.
