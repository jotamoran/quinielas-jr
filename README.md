# Quinielas JR

Plataforma de quinielas deportivas (Vue 3 + Tailwind + Vercel Functions + Supabase).

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
3. Deploy — `vercel.json` define el rewrite SPA y las funciones de `/api`. Los resultados se sincronizan desde el servicio externo; el administrador puede ejecutar una actualización manual desde la sección Resultados como respaldo.

## PWA

La aplicación se puede instalar desde un navegador compatible cuando está publicada con HTTPS. El modo sin conexión solo muestra el shell visual; autenticación, pagos, comprobantes y pronósticos requieren conexión y nunca se guardan en la caché.

Después de cada despliegue conviene comprobar en el navegador que el manifiesto se cargue, que `/sw.js` esté activo y que una navegación sin conexión muestre la aplicación. En Android se instala desde el menú del navegador; en iPhone, desde Compartir → Añadir a pantalla de inicio.

## Sincronización externa

El job externo usa `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SPORTS_API_KEY`. Actualiza estado (`pendiente`, `en_vivo`, `finalizado`), marcador y resultado; al detectar cambios ejecuta `calcular_puntos`. Las jornadas finalizadas o canceladas quedan fuera de la sincronización. La sección Resultados conserva la actualización manual como respaldo.

## Verificación de correo

El flujo utiliza códigos de seis dígitos en el frontend, la función serverless y Supabase (`otp_length = 6`). En Supabase Cloud deben estar activadas las confirmaciones de correo y la plantilla debe conservar `{{ .Token }}` para mostrar el código completo.

