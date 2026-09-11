# Pendientes conocidos

Hallazgos reales, ya evaluados, que se dejaron sin resolver a propósito (bajo riesgo para el tamaño/uso actual de la app, o requieren una decisión de arquitectura). No son bugs desconocidos — cada uno fue encontrado y considerado en un code review; se documentan aquí para no perder el rastro ni re-descubrirlos.

## Seguridad

- **Rate-limiting de login debilitado por compartir la IP de Vercel** (`api/auth/iniciar-sesion.js`). Desde que el login se resuelve en el servidor (para nunca exponer el correo real al navegador), todos los intentos de login le llegan a Supabase Auth desde las mismas IPs compartidas de Vercel, no desde la IP real de quien inicia sesión. Esto debilita el límite de intentos por IP que Supabase aplica: en teoría, alguien podría agotar ese límite compartido y bloquear temporalmente el login de todos los demás. La mitigación obvia (reenviar `X-Forwarded-For` del cliente) es arriesgada de implementar mal — cualquiera puede falsificar ese header, así que reenviarlo sin validar podría anular el límite por completo en vez de arreglarlo. Dado que esta app es un grupo cerrado de amigos/familia (no pública), se dejó documentado en vez de improvisar un arreglo. Si algún día se vuelve pública o hay indicios de abuso, resolver con: (a) un throttle propio dentro del endpoint (por username+IP real, usando algo persistente ya que las funciones serverless no comparten memoria entre invocaciones), o (b) confirmar si Vercel expone un header de IP real no falsificable (`x-vercel-forwarded-for` o similar) y usarlo con cuidado.
- **Cambiar la contraseña desde "Mi cuenta" no pide la contraseña actual ni revoca otras sesiones activas** — depende de la configuración del proyecto en Supabase ("Require reauthentication for password change", desactivada por defecto). Si alguien deja su sesión abierta en un dispositivo compartido, quien la encuentre puede cambiar correo y contraseña y dejar fuera al dueño real de la cuenta. Aceptable para un grupo cerrado de amigos/familia; revisar la configuración de Supabase si esto se vuelve una preocupación real.

## Funcionalidad menor

- **`api/fixtures.js`**: el orden de validación cambió — ahora "liga no permitida" se revisa antes que "rango de fechas inválido". Si alguien manda ambos errores a la vez (liga desconocida + fechas inválidas, sin `numeroJornada`), el mensaje que ve es distinto al de antes. Ningún test depende del orden viejo.
- **Búsqueda por jornada usa la fecha de hoy para calcular la temporada** (`seasonRangeForDate(hoy)` en `api/fixtures.js`), no la temporada real de la jornada que se está pidiendo. Podría fallar justo en el límite de una temporada (ej. buscar una jornada vieja poco después de que arrancó la siguiente temporada).
- **Apertura y Clausura de Liga MX comparten el mismo string de temporada en TheSportsDB** (ej. `"2026-2027"`). `getFixtures` ahora se queda con los 9 partidos más cercanos a hoy si `eventsround.php` regresa más de 9 — es una mitigación razonable pero **no verificada en vivo todavía**, porque el Clausura no ha empezado. Revisar cuando arranque.

(Resueltos en esta pasada: `notificarAdmin` ya aísla fallos por admin; `numeroJornada` ya se valida como entero positivo; `username-disponible` ya no se confunde con "ya está en uso" gracias a la validación de formato en `Registro.vue` antes de consultar el servidor.)

- **`handle_new_user()` no normaliza el username** que le llega en los metadatos — confía en que el cliente ya lo mandó en minúsculas. `Registro.vue` sí normaliza antes de enviarlo, así que no afecta el flujo normal de la app; solo importa si alguna vez se crea un usuario por otro camino (ej. Supabase Dashboard, un script).
- **Buscador de partidos por rango de fechas** (`GestionJornadas.vue`, el flujo original sin ronda) sigue usando `eventsnextleague.php` de TheSportsDB, que con la llave de prueba gratuita (`123`) solo regresa 1-2 partidos futuros — no sirve para buscar más de unos días adelante. La búsqueda por ronda (agregada en esta sesión) es la alternativa para Liga MX; las otras 9 ligas configuradas siguen con esta limitación.

## Otros

- **`supabase/bootstrap-manual.sql`**: archivo del usuario, sin trackear en git, quedó desactualizado (no incluye las migraciones más recientes). Se deja tal cual por instrucción explícita del usuario — no tocar.
