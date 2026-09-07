# UI/UX, Responsive y Alias de Admin — Diseño

**Fecha:** 2026-09-07
**Estado:** Aprobado, listo para implementación

## 1. Resumen

Ajuste enfocado (no rediseño) sobre puntos concretos de quiebre encontrados en una revisión de UI/UX y responsive de Quinielas JR, más dos pedidos explícitos del usuario: logo en las pantallas de autenticación, y un alias de login (`admin`) para la cuenta de administrador.

## 2. Alcance

1. **Logo en auth**: agregar `src/assets/logo.png` arriba del título en `Login.vue`, `Registro.vue`, `VerificarCodigo.vue`, `RecuperarPassword.vue`.
2. **Alias de login admin**: nueva variable `VITE_ADMIN_ALIAS_EMAIL`. En `Login.vue`, si el campo correo (trim + lowercase) es exactamente `admin`, se sustituye por el valor de esa variable antes de llamar a `iniciarSesion`. Solo funciona para ese único alias fijo, no es un sistema de usernames general.
3. **Navbar responsive**: `NavbarComponent.vue` pasa de una fila fija sin wrap a: menú hamburguesa + panel desplegable vertical por debajo de `md`, layout horizontal actual (con `flex-wrap` de respaldo) desde `md` en adelante.
4. **Tablas con scroll horizontal**: envolver `TablaPosiciones.vue` y la tabla de `MisQuinielas.vue` en un contenedor `overflow-x-auto`.
5. **Formularios de admin apilables**: `GestionJornadas.vue` — los grids de búsqueda (`grid-cols-2`) y de datos de jornada (`grid-cols-3`) pasan a `grid-cols-1` en móvil, con el grid actual aplicado desde `sm:`.
6. **Barra de info de jornada**: en `LlenarQuiniela.vue`, el contenedor `flex justify-between items-center` (nombre de jornada + countdown) pasa a `flex-col sm:flex-row sm:justify-between sm:items-center gap-2`.

## 3. Fuera de alcance

- Rediseño visual completo de cualquier vista.
- Sistema de alias/username general para usuarios regulares (solo aplica a la cuenta admin).
- Cambios a la lógica de negocio, RLS, o endpoints serverless.

## 4. Detalle por archivo

**Auth (4 vistas + servicio):**
- Cada vista de auth agrega antes del `<h1>`:
  ```html
  <img src="@assets/logo.png" alt="Quinielas JR" class="h-16 w-16 mx-auto rounded-full mb-2" />
  ```
- `Login.vue`: antes de `iniciarSesion({ email: email.value, password: password.value })`, se resuelve:
  ```js
  const correoFinal = email.value.trim().toLowerCase() === 'admin'
    ? import.meta.env.VITE_ADMIN_ALIAS_EMAIL
    : email.value;
  ```
  y se usa `correoFinal` en la llamada.
- `.env.example` y `.env.local` agregan `VITE_ADMIN_ALIAS_EMAIL=`.

**NavbarComponent.vue:**
- Nuevo estado local `menuAbierto` (ref boolean).
- Botón hamburguesa visible solo `md:hidden`, alterna `menuAbierto`.
- Contenedor de links: oculto por default en móvil, visible como panel vertical (`flex-col`) cuando `menuAbierto` es `true` y el viewport es menor a `md`; siempre visible en horizontal desde `md:flex` en adelante (ignora `menuAbierto` en desktop).
- Al hacer clic en cualquier link dentro del menú móvil, `menuAbierto` vuelve a `false` (cierre automático tras navegar).

**TablaPosiciones.vue / MisQuinielas.vue:**
- La tabla existente se envuelve en `<div class="overflow-x-auto">...</div>`, sin cambios en columnas ni datos.

**GestionJornadas.vue:**
- `grid-cols-2` (form de búsqueda) → `grid-cols-1 sm:grid-cols-2`.
- `grid-cols-3` (datos de jornada) → `grid-cols-1 sm:grid-cols-3`.

**LlenarQuiniela.vue:**
- Barra de jornada: `flex justify-between items-center` → `flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2`.

## 5. Pruebas

Cambios puramente de plantilla/estilo (sin lógica de negocio nueva salvo el alias de login). Verificación:
- `npm run build` y `npx vitest run` (9/9) deben seguir pasando sin cambios.
- Verificación manual en navegador (el usuario ya tiene `npm run dev` corriendo) en al menos dos anchos: desktop (~1440px) y móvil (~390px), confirmando que el navbar colapsa a hamburguesa y el login de admin con alias funciona.
