# Quinielas JR

Plataforma de quinielas deportivas (Vue 3 + Tailwind + Cloudflare Pages Functions + Supabase).

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

## Despliegue en Cloudflare Pages

La URL pública oficial es [quinielas-jr.pages.dev](https://quinielas-jr.pages.dev).

Cada push a `main` ejecuta las pruebas, compila la aplicación y publica el resultado mediante GitHub Actions.

En Cloudflare Pages deben mantenerse como secretos de Production las variables privadas del servidor: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SPORTSDB_API_KEY`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL` y `BREVO_API_KEY`.

El workflow requiere en GitHub Actions las variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_TITLE` y `VITE_ADMIN_ALIAS_EMAIL`, además de los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.

`quinielasjr.vercel.app` está retirado y responde con HTTP 410. La única URL operativa es Cloudflare Pages.

## PWA

La aplicación se puede instalar desde un navegador compatible cuando está publicada con HTTPS. El modo sin conexión solo muestra el shell visual; autenticación, pagos, comprobantes y pronósticos requieren conexión y nunca se guardan en la caché.

Después de cada despliegue conviene comprobar en el navegador que el manifiesto se cargue, que `/sw.js` esté activo y que una navegación sin conexión muestre la aplicación. En Android se instala desde el menú del navegador; en iPhone, desde Compartir → Añadir a pantalla de inicio.

## Sincronización externa

El job externo usa `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SPORTS_API_KEY`. Actualiza estado (`pendiente`, `en_vivo`, `finalizado`), marcador y resultado; al detectar cambios ejecuta `calcular_puntos`. Las jornadas finalizadas o canceladas quedan fuera de la sincronización. La sección Resultados conserva la actualización manual como respaldo.

## Verificación de correo

El flujo utiliza códigos de seis dígitos en el frontend, la función serverless y Supabase (`otp_length = 6`). En Supabase Cloud deben estar activadas las confirmaciones de correo y la plantilla debe conservar `{{ .Token }}` para mostrar el código completo.

