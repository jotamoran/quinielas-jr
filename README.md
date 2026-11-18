# Quinielas JR

Plataforma de quinielas deportivas de Liga MX (Vue 3 + Pinia + Tailwind + Cloudflare Pages Functions + un Worker de Cloudflare + Supabase). Se puede instalar como app (PWA).

## Desarrollo local

Se necesita Node 22.12 o superior.

1. Copia `.env.example` a `.env.local` y llena las variables `VITE_*`.
2. `npm install`
3. `npm run dev`

Para probar también las funciones del servidor (`functions/`), compila con `npm run build` y corre `npm run pages:dev` (usa Wrangler sobre `dist/`). Las variables del servidor que necesitan esas funciones (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SPORTSDB_API_KEY`, `BREVO_API_KEY`, etc.) están listadas en `.env.example`.

## Estructura

- `src/`: la aplicación web. Cada área vive en `src/modules/` (`admin`, `auth`, `legal`, `publico` y `quinielas`).
- `api/`: la lógica del servidor. Lo compartido está en `api/_lib/` (rutas de cierre y cancelación de jornadas, avisos por correo, proveedores de resultados deportivos).
- `functions/`: las funciones de Cloudflare Pages. Llaman a la lógica de `api/_lib/`.
- `workers/marcadores/`: el Worker que sincroniza marcadores cada 2 minutos (ver más abajo).
- `public/`: manifiesto y service worker de la PWA, e íconos.
- `supabase/`: configuración de Supabase. `vercel.json` y `api/retired.js` solo sirven para que la dirección vieja de Vercel responda 404.

## Base de datos (Supabase)

1. Instala el [Supabase CLI](https://supabase.com/docs/guides/cli).
2. `npx supabase start` (requiere Docker) para el stack local.
3. `npx supabase db reset` aplica todas las migraciones de `supabase/migrations/`.
4. Para un proyecto real en supabase.com: `npx supabase link` y `npx supabase db push`.

Las migraciones (`supabase/migrations/`) no se suben a Git (están en `.gitignore`): viven solo en la copia local de quien las crea. En `supabase/` sí están `config.toml` y `bootstrap-manual.sql`.

## Pruebas

`npm run test` corre las pruebas unitarias con Vitest (countdown, balance, reparto de premios, entre otras).
Las pruebas SQL (`supabase/tests/*.test.sql`) se corren con `psql "$(npx supabase status -o json | jq -r .DB_URL)" -f supabase/tests/<archivo>.sql` tras cada `db reset`.

Las carpetas `tests/` y `supabase/tests/` no se suben a Git (están en `.gitignore`), así que el despliegue no corre las pruebas: hay que correrlas en local antes de subir un cambio.

## Despliegue en Cloudflare Pages

La URL pública oficial es [quinielas-jr.pages.dev](https://quinielas-jr.pages.dev).

Cada push a `main` compila la aplicación y publica el resultado mediante GitHub Actions (`.github/workflows/deploy-cloudflare.yml`). El flujo **no corre las pruebas**; hay que correrlas antes en local.

En Cloudflare Pages deben mantenerse como secretos de Production las variables privadas del servidor: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SPORTSDB_API_KEY`, `CRON_SECRET`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL` y `BREVO_API_KEY`. `API_FOOTBALL_KEY` es opcional (segundo proveedor de resultados).

El workflow requiere en GitHub Actions las variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_TITLE` y `VITE_ADMIN_ALIAS_EMAIL`, además de los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.

`quinielasjr.vercel.app` está retirado y responde con HTTP 404. La única URL operativa es Cloudflare Pages.

## PWA

La aplicación se puede instalar desde un navegador compatible cuando está publicada con HTTPS. El modo sin conexión solo muestra el shell visual; autenticación, pagos, comprobantes y pronósticos requieren conexión y nunca se guardan en la caché.

Después de cada despliegue conviene comprobar en el navegador que el manifiesto se cargue, que `/sw.js` esté activo y que una navegación sin conexión muestre la aplicación. En Android se instala desde el menú del navegador; en iPhone, desde Compartir → Añadir a pantalla de inicio.

## Sincronización externa (Worker de marcadores)

Un Worker de Cloudflare (`workers/marcadores/`, nombre `quinielas-jr-marcadores`) se ejecuta cada 2 minutos. Usa `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SPORTSDB_API_KEY` y `CRON_SECRET` como secretos, y las variables `SITIO_URL` y `CIERRE_AUTOMATICO` de su `wrangler.jsonc`.

- Actualiza estado (`pendiente`, `en_vivo`, `finalizado`), marcador y resultado; al detectar cambios ejecuta `calcular_puntos`. Las jornadas finalizadas o canceladas quedan fuera de la sincronización.
- Le pide al sitio que revise el cierre automático y el recordatorio de premio; los correos los manda el sitio, no el Worker. `CIERRE_AUTOMATICO` acepta `activo` o `simulacro`.
- Reintenta los avisos de cierre que fallaron, cada 10 minutos durante 7 días.

El Worker se despliega con su propio flujo (`.github/workflows/deploy-worker-marcadores.yml`), que solo corre cuando cambian archivos de `workers/marcadores/`. La sección Resultados de la aplicación conserva la actualización manual como respaldo.

## Verificación de correo

El flujo utiliza códigos de seis dígitos en el frontend, la función serverless y Supabase (`otp_length = 6`). En Supabase Cloud deben estar activadas las confirmaciones de correo y la plantilla debe conservar `{{ .Token }}` para mostrar el código completo.

