# Autenticación menos invasiva (modal de login)

## Contexto

Esta es la primera de cinco sub-mejoras solicitadas tras probar la app en producción (las otras cuatro — equipos/escudos, vista pública de resultados, administración de jornadas, y "Mis quinielas" — se diseñarán por separado). El problema a resolver aquí: las páginas que la app comparte con gente que **todavía no tiene cuenta** (Resultados públicos y Llenar quiniela) hoy redirigen de golpe a `/login` en cuanto detectan que no hay sesión, perdiendo el contexto de lo que la persona estaba viendo. Se busca que puedan ver el contenido público y decidir iniciar sesión sin abandonar la pantalla.

## Alcance confirmado

- Aplica **solo** a `Resultados` (`tabla-publica`) y `Jugar` (`llenar-quiniela`). El resto de la app (`Mis quinielas`, `Administración`) sigue redirigiendo a `/login` como hoy — ahí solo se llega estando ya autenticado, no hace falta modal.
- El modal soporta **solo login** (correo + contraseña). "Crear cuenta" y "Olvidé mi contraseña" siguen siendo las páginas completas ya existentes (`/registro`, `/recuperar-password`); el modal solo enlaza a ellas.
- El botón "Registrar" en Resultados manda a `/llenar-quiniela` tal cual, sin parámetro de jornada — la app ya asume una sola jornada activa a la vez (`obtenerJornadaActiva()`), no se cambia esa lógica.
- **Sesión persistente ("recordarme"):** investigado y confirmado que ya funciona sin cambios — el cliente de Supabase usa persistencia de sesión por defecto, y el proyecto no tiene "Time-box user sessions" ni "Inactivity timeout" configurados (ambos en `0 / never`, y de hecho bloqueados por ser plan Free). No hay nada que construir en este punto; no se agrega ningún checkbox "Recordarme" porque no tendría efecto real y sería engañoso.

## Diseño

### Store: `src/store/loginModal.js` (nuevo, Pinia)

Estado mínimo para que cualquier componente pueda pedir que se abra el modal sin importar el layout activo:

```js
state: () => ({ abierto: false })
actions: {
  abrir() { this.abierto = true },
  cerrar() { this.abierto = false },
}
```

### Componente: `src/components/LoginModal.vue` (nuevo)

- Mismo formulario que `src/modules/auth/views/Login.vue` (correo/contraseña, incluyendo el alias `"admin"` → `VITE_ADMIN_ALIAS_EMAIL`), reutilizando `iniciarSesion` de `authService.js`. No se duplica lógica de negocio, solo la presentación en modal.
- Overlay + tarjeta centrada, cerrable con click fuera, `Esc`, o botón "×".
- Al iniciar sesión con éxito: llama a `loginModalStore.cerrar()`. No navega a ningún lado — el llamador se entera solo por la reactividad de `authStore.isLoggedIn`.
- Enlaces "Crear cuenta" y "Olvidé mi contraseña" navegan a `/registro` y `/recuperar-password` (rutas ya existentes, sin tocar) — al navegar, el modal se cierra implícitamente (cambia la ruta, `App.vue` cambia de layout).
- Se monta **una sola vez**, en `src/App.vue`, junto al `<component :is="layout" />`, para que funcione sin importar qué layout esté activo.

### Router: `src/modules/quinielas/router.js`

- Se quita `meta: { requiresAuth: true }` de la ruta `llenar-quiniela`. Pasa a ser una ruta pública (como `tabla-publica`), con su propio control de acceso a nivel de UI (ver abajo), no a nivel de guard.

### `src/components/NavbarComponent.vue`

Hoy asume sesión siempre iniciada (no tiene rama para "sin sesión"). Se agrega:

- Si `!authStore.isLoggedIn`: header minimalista — logo + botón **"Iniciar sesión"** que llama a `loginModalStore.abrir()`. Se ocultan los enlaces "Mis quinielas", "Jugar", "Administración" y el botón "Salir".
- Si `authStore.isLoggedIn`: exactamente el menú actual, sin cambios.
- Aplica igual en la barra desktop y en el menú hamburguesa de móvil.

### `src/layouts/PublicoLayout.vue` (Resultados)

- El botón del header que hoy es `<router-link :to="{ name: authStore.isLoggedIn ? 'mis-quinielas' : 'login' }">` cambia a: si hay sesión, sigue siendo el link a `mis-quinielas`; si no hay sesión, se vuelve un `<button>` que llama a `loginModalStore.abrir()` en vez de navegar.

### `src/modules/publico/views/TablaPublica.vue`

Nueva leyenda junto a "Tabla de posiciones", visible solo si `!bloqueada` (registro todavía abierto):

- Sin sesión: texto *"Inicia sesión para registrar una entrada"* + botón que abre el modal.
- Con sesión: botón **"Registrar"** (`router-link` a `{ name: 'llenar-quiniela' }`).

### `src/modules/quinielas/views/LlenarQuiniela.vue`

- Sigue cargando la jornada activa y sus partidos igual que hoy — ya es lectura pública a nivel de RLS (`jornadas`/`partidos` ya tienen policy `FOR SELECT TO anon, authenticated USING (true)`), no requiere cambios de permisos en Supabase.
- Nuevo computed `necesitaLogin = !authStore.isLoggedIn`.
- Los 9 partidos se muestran siempre, pero `TarjetaPartido` recibe `:deshabilitado="bloqueado || necesitaLogin"` (ya soporta ese prop, solo se amplía la condición).
- El input de "Nombre de tu entrada" (`alias`) también recibe `:disabled="bloqueado || necesitaLogin"` (hoy solo depende de `bloqueado`), por la misma razón: que no se pueda avanzar nada mientras no haya sesión.
- El botón "Continuar al pago" agrega `necesitaLogin` a su condición de `:disabled` (refuerzo, ya que sin selecciones tampoco se completaría `completo`): `:disabled="bloqueado || necesitaLogin || !completo || !alias.trim()"`.
- Banner visible cuando `necesitaLogin`, arriba de la sección de pronósticos: *"Regístrate o inicia sesión para llenar tu quiniela"* con botón que llama a `loginModalStore.abrir()` (no navega).
- Al iniciar sesión desde el modal, `authStore.isLoggedIn` cambia reactivamente → el banner desaparece y los partidos se habilitan solos, sin recargar la página.

## Fuera de alcance (confirmado explícitamente)

- No se toca `Login.vue`, `Registro.vue`, `VerificarCodigo.vue` ni `RecuperarPassword.vue` — siguen siendo las páginas completas de siempre.
- No se agrega ningún control de "recordar sesión" (ver justificación arriba).
- No se modifica el guard de `mis-quinielas` ni de ninguna ruta de `admin/*`.
- No se introduce el concepto de "jornada específica" en `/llenar-quiniela` — sigue asumiendo una sola jornada activa.

## Pruebas a cubrir

- `llenar-quiniela` sin sesión: carga sin redirect, muestra partidos deshabilitados + banner.
- Login exitoso desde el modal en `llenar-quiniela`: banner desaparece, partidos se habilitan, sin recarga de página.
- `tabla-publica` sin sesión, jornada con registro abierto: aparece "Inicia sesión para registrar".
- `tabla-publica` con sesión, jornada con registro abierto: aparece botón "Registrar" → navega a `llenar-quiniela`.
- `tabla-publica`/`llenar-quiniela` con jornada **bloqueada** (registro cerrado): no aparece ninguna leyenda de registro (ya no aplica).
- `mis-quinielas` y rutas `admin/*` sin sesión: siguen redirigiendo a `/login` sin cambios (regresión).
- Menú móvil (hamburguesa) sin sesión: solo muestra "Iniciar sesión".
