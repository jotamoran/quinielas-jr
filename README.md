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

