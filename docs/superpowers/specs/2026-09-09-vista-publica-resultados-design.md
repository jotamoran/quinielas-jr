# Vista pública de resultados (ocultar premio y destacados hasta que corresponda)

## Contexto

Tercera de cinco sub-mejoras solicitadas tras probar la app en producción (las dos primeras — autenticación menos invasiva, y equipos/escudos — ya están implementadas y en `main`). Dos pedidos sobre la vista pública de resultados (`TablaPublica.vue`):

1. El premio no debe mostrarse hasta que el registro esté bloqueado (cerrado).
2. El resaltado de "quién va ganando el premio" / "quién va ganando el cupón Por tarugo" no debe mostrarse hasta que ya empezaron los partidos — hoy se muestra siempre que haya al menos una quiniela registrada, sin importar si el registro sigue abierto o si los partidos ni siquiera han arrancado.

## Investigación previa (ya confirmada)

- El archivo afectado es únicamente `src/modules/publico/views/TablaPublica.vue`. No se toca `TablaPosiciones.vue` — ya recibe el prop `resaltarExtremos` (booleano) y decide internamente si pinta amarillo/rojo y muestra la leyenda; solo cambia el **valor** que le llega desde `TablaPublica.vue`, no su lógica interna.
- Ya existe `bloqueada = computed(() => jornada.value && new Date(jornada.value.fecha_cierre) <= new Date())` — representa "registro cerrado".
- `partidos.value` ya se carga completo (`select('*')`) en `cargar()`, incluyendo `fecha_partido` de cada uno de los 9 partidos — no hace falta ninguna consulta nueva para saber si ya empezaron.
- El premio se muestra hoy en una sola línea del header: `<strong class="text-xl text-quiniela-dorado">{{ formatoMoneda(jornada?.premio) }}</strong>`, dentro de un contenedor junto a la etiqueta "Premio".

## Decisiones confirmadas

- **Premio oculto:** mientras `!bloqueada`, en vez del monto se muestra el texto "Se revela al cierre del registro" (la etiqueta "Premio" se queda visible, solo cambia lo que va después).
- **"Ya empezaron los partidos"** = al menos uno de los 9 partidos tiene `fecha_partido` en el pasado (el primero en arrancar, no hace falta que todos hayan empezado ni que tengan resultado oficial).
- **Condición para mostrar el resaltado (`resaltarExtremos`):** `bloqueada` **O** `empezaronPartidos` — basta con que se cumpla cualquiera de las dos. En el caso normal (el cierre de registro siempre es antes de que arranque el primer partido) esto no cambia nada respecto a hoy; cubre el caso raro de que un partido arranque sin que el registro haya cerrado todavía.

## Diseño

Todo el cambio vive en `src/modules/publico/views/TablaPublica.vue`.

### Nuevo computed

Inmediatamente después de la línea existente `const bloqueada = computed(...)`:

```js
const empezaronPartidos = computed(() => partidos.value.some((p) => new Date(p.fecha_partido) <= new Date()));
const mostrarDestacados = computed(() => bloqueada.value || empezaronPartidos.value);
```

### Premio oculto en el header

Localizar:

```html
      <div class="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
        <span class="text-sm text-green-100">Premio</span>
        <strong class="text-xl text-quiniela-dorado">{{ formatoMoneda(jornada?.premio) }}</strong>
      </div>
```

Reemplazar por:

```html
      <div class="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
        <span class="text-sm text-green-100">Premio</span>
        <strong v-if="bloqueada" class="text-xl text-quiniela-dorado">{{ formatoMoneda(jornada?.premio) }}</strong>
        <span v-else class="text-sm italic text-green-100">Se revela al cierre del registro</span>
      </div>
```

### Resaltado condicional

Localizar (dentro del `<TablaPosiciones>`):

```html
      <TablaPosiciones ref="tablaPosiciones" :jornadaId="jornadaId" :obtenerRankingFn="obtenerRankingPublico" :obtenerPronosticosFn="obtenerPronosticosPublicos" :bloqueada="bloqueada" resaltarExtremos />
```

Reemplazar el atributo estático `resaltarExtremos` por el binding al nuevo computed:

```html
      <TablaPosiciones ref="tablaPosiciones" :jornadaId="jornadaId" :obtenerRankingFn="obtenerRankingPublico" :obtenerPronosticosFn="obtenerPronosticosPublicos" :bloqueada="bloqueada" :resaltarExtremos="mostrarDestacados" />
```

## Fuera de alcance (confirmado explícitamente)

- No se toca `TablaPosiciones.vue` — su lógica interna de qué pintar cuándo `resaltarExtremos` es `true` no cambia.
- No se agrega ningún indicador visual nuevo de "los partidos ya empezaron" — es una condición interna, no se muestra al usuario como tal.
- No se toca `MisQuinielas.vue` ni ningún otro consumidor de `TablaPosiciones` — solo `TablaPublica.vue` le pasa `resaltarExtremos`, y solo ahí cambia el valor.
- No se agrega ninguna animación ni transición al aparecer/desaparecer el premio o el resaltado — simplemente aparecen o no según la condición, como el resto de los `v-if` ya existentes en este archivo.

## Pruebas a cubrir

- Jornada con registro abierto (`!bloqueada`) y ningún partido ha arrancado: premio oculto (muestra el texto alternativo), sin resaltado amarillo/rojo ni leyenda en la tabla de posiciones.
- Jornada con registro cerrado (`bloqueada`): premio visible con el monto real, resaltado visible.
- Jornada con registro todavía abierto pero con `fecha_partido` de al menos un partido ya en el pasado (caso raro): premio sigue oculto (no depende de partidos), pero el resaltado SÍ aparece.
- Jornada finalizada (siempre `bloqueada`): sin cambios respecto al comportamiento actual — premio y resaltado visibles como siempre.
