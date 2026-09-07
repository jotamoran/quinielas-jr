# Plantilla para proyectos de Vuejs para nuevas apps OyL

Se instalaron los siguientes paquetes:
- Vuetify
- VueRouter
- TailwindCSS
- MDI Icons
- Axios
- Sweetalert 2
- Pinia

## Alias de rutas
Para evitar el uso de rutas relativas complejas (../../), utiliza los siguientes alias:
@/: Carpeta raíz src.
@assets/: Recursos estáticos (imágenes, logos).
@components/: Componentes globales/reutilizables (Navbar, Footer).

## Estructura de Carpetas
- src/modules/: Aquí reside la lógica de negocio. Cada módulo (ej. auth, dashboard) es independiente y contiene sus propias vistas, componentes locales y su router.js.
- src/components/: Reservado para componentes globales que se pueden usar en diferentes modulos.
- src/layouts/: Plantillas genericas (AuthLayout para login, AppLayout para el resto de apps/modulos).
- src/services/: Aquí se crean los archivos que hablan con el backend.
- src/utils/: Funciones que son logica pura (Ejemplo, formato fecha, formato moneda, etc).

## Enrutamiento y Seguridad
El proyecto utiliza Lazy Loading para cargar módulos bajo demanda.
- Se verifica automaticamente el token en Pinia.
Meta tags:
- requiresAuth: true: Protege rutas que requieren login.
- guestOnly: true: Evita que usuarios logueados regresen al login.

### Capa de Configuración (@api)
Ubicada en `src/api/`. Aquí se crean las instancias de Axios.
- mainApi.js: Conexión principal al backend. Ya incluye interceptores que adjuntan automáticamente el Token de Pinia y manejan errores 401.
- externalApi.js: Para consumir otras apis (url ejemplo flask, spring, laravel, etc).

## Para agregar nuevos desarollos
- Crea una carpeta nueva dentro de modules/. De preferencia no mesclar logica de un modulo con otro.
- Las pantallas principales de tu módulo van en modules/tu-modulo/views/.
- Si un componente solo se usa en tu módulo, guárdalo en modules/tu-modulo/components. Si es genérico, muévelo a src/components.
- Registra las rutas de tu módulo en su propio router.js y luego impórtalo en el router maestro (src/router/index.js).

