# Arquitectura — Football Timeline

Este documento recoge las decisiones de arquitectura del proyecto y por qué se tomaron. Se actualiza
a medida que avanzan las fases (ver README.md para el estado actual).

## Stack y versiones relevantes

- **Next.js 16** (App Router, Turbopack por defecto). Diferencias relevantes frente a versiones
  anteriores que afectan a este proyecto:
  - `middleware.ts` está deprecado a favor de `proxy.ts` (función exportada `proxy`, runtime Node.js
    obligatorio). Se añade en la Fase 4, cuando exista lógica de sesión que proteger.
  - `cookies()`, `headers()`, `params` y `searchParams` son siempre asíncronos.
  - `next lint` ha sido eliminado; se usa ESLint directamente (`npm run lint`).
  - `next dev` bloquea por defecto las peticiones (assets y Server Actions) que no vengan de
    `localhost`; se permite explícitamente la IP de red local en `allowedDevOrigins`
    (`next.config.ts`) para poder probar desde un móvil real en la misma red.
- **React 19.2**, **TypeScript 5**, **Tailwind CSS v4** — el tema vive en CSS (`@theme` en
  `src/app/globals.css`), no en `tailwind.config.ts`.
- **Zod v4** — usa formatos top-level (`z.email()`, `z.url()`) en vez de `.string().email()`.
- **Supabase** (Postgres + Auth + RLS) como backend. Sin proyecto todavía: ver README para vincularlo.

## Principio de organización: dominio dentro de features

`src/app/` es un shell delgado de routing. La lógica de negocio pura y testeable (scoring,
verificación de orden, selección del daily challenge, import CSV, streaks) vive en
`src/features/<feature>/domain/`, sin importar nada de Next.js ni Supabase — así se testea con
Vitest sin mocks pesados. Los Server Actions en `actions/` orquestan `domain/` + Supabase.

Esto permite que la lógica más crítica (la fórmula de puntuación, la comparación de órdenes) se
pueda razonar y testear de forma aislada, y que cambie de framework de UI en el futuro sin tocarla.

## Cómo se añade un modo de juego nuevo sin migrar el esquema

`game_modes`, `difficulties`, `subject_types` y `achievements` son **tablas de datos**, no
enums de Postgres ni de TypeScript. Añadir un modo de juego nuevo es:

1. Un `INSERT INTO game_modes` (a mano o desde `/admin` en la Fase 5).
2. Una entrada nueva en `src/features/game-engine/domain/modes-registry.ts` (nombre, icono,
   descripción) — este registro es el que decide cómo se renderiza la tarjeta de ese modo.

Nunca requiere una migración de esquema. Los campos específicos de cada modo (la cuota de un
fichaje, el club de una etapa de carrera, el tipo de logro) viven en la columna `events.metadata
jsonb`, no como columnas nuevas.

## Modelo de datos

Ver el esquema completo y comentado en `supabase/migrations/0001_init_schema.sql` a
`0005_functions_and_triggers.sql`. Puntos de diseño no evidentes a simple lectura:

- **`game_sessions` / `game_attempts` / `scores` están separados a propósito**: `game_sessions` es
  una partida en curso; `game_attempts` es la auditoría de cada "comprobar" (nunca guarda el orden
  correcto, solo qué posiciones acertó); `scores` es el agregado final 1:1 con la sesión, versionado
  por `scoring_version` para poder cambiar la fórmula sin invalidar el histórico.
- **El cliente nunca puede leer `timeline_events.correct_order`**: no hay policy de `SELECT` pública
  sobre esa tabla. El tablero de juego se sirve vía `get_timeline_play_cards()` (función SQL
  `security definer`, mezcla las tarjetas server-side) y la verificación ocurre en `submit_attempt()`
  / `finish_session()`, también `security definer`. Ningún endpoint devuelve el orden correcto.
- **Sin policy de `UPDATE` en `game_sessions`, `game_attempts` ni `scores`**: toda mutación de una
  partida pasa por esas dos funciones RPC, así un cliente no puede escribir directamente su propio
  resultado o falsificar su puntuación llamando a la API REST de Supabase a mano.
- **`daily_results` tiene dos índices únicos parciales** (`(daily_challenge_id, user_id)` y
  `(daily_challenge_id, anon_id)`) que garantizan a nivel de base de datos que no se puede jugar el
  reto diario dos veces, más allá de cualquier chequeo en la UI.
- **Rol admin en `profiles.role`**, no en custom claims del JWT: evita el problema de cache del JWT
  al promover a un usuario (tendría que volver a iniciar sesión) y se administra con un `UPDATE` en
  el SQL editor de Supabase. Un trigger (`protect_role_change`) impide la auto-promoción.
- **Soft-delete** (`deleted_at`) en `events` y `timelines`; `timeline_events.event_id` usa
  `ON DELETE RESTRICT` para que nunca se pueda borrar físicamente un evento en uso.

## Motor de puntuación

`src/features/game-engine/domain/scoring.ts` es la especificación ejecutable de la fórmula (con
tests tabulares en `scoring.test.ts`). La versión autoritativa que realmente se persiste vive en
`calculate_score_v1()` dentro de `0005_functions_and_triggers.sql` — deliberadamente duplicada,
porque el cálculo que cuenta para la puntuación real debe ocurrir en el mismo límite de confianza
que la verificación del orden (el servidor de base de datos), no en un cliente que podría forjar
el tiempo o los intentos. Ambas implementaciones deben mantenerse en sincronía; los tests de
`scoring.test.ts` documentan el comportamiento esperado para revisar la versión SQL contra ellos.

Variables de la fórmula: eventos totales, dificultad (multiplicador creciente), intentos extra
(penalización), tiempo sobre el ideal (penalización con tope), y bonus por resolver a la primera.
El resultado (`points`, `stars`) queda versionado (`scoring_version`) para poder ajustar los pesos
sin invalidar el histórico de partidas ya jugadas.

## Drag & drop

`@dnd-kit` (`core` + `sortable` + `utilities`) en vez de `react-beautiful-dnd` (deprecado, sin
soporte táctil confiable) o `react-dnd` (más boilerplate para touch). Soporta `PointerSensor` /
`TouchSensor` con `activationConstraint`, accesibilidad (`KeyboardSensor`, ARIA) y tiene un bundle
pequeño. Implementado en la Fase 2 (`src/features/game-engine/components/board/`).

La sesión de juego se arranca desde el **cliente** (`play-timeline-client.tsx`, vía `useEffect`),
no desde el Server Component de la página: `startSession` necesita escribir la cookie de
`anon_id`, y Next.js solo permite mutar cookies dentro de una invocación real de Server Action
(disparada por el cliente), no durante el render de una página. Llamar a una función `"use server"`
directamente desde el render de un Server Component la ejecuta, pero sin ese permiso de escritura.

## Daily challenge

Rotación híbrida: el admin puede pre-asignar timelines a fechas (`daily_challenges.challenge_date
unique`); si una fecha no tiene asignación, `ensure_daily_challenge()` (RPC `security definer`,
`supabase/migrations/0008_daily_challenge_selector.sql`) la resuelve con un índice determinista —
**días desde la época Unix, módulo nº de timelines elegibles** — y se autocura con
`ON CONFLICT DO NOTHING`. Se eligió esta fórmula (en vez de un hash) porque es trivial de replicar
exactamente en TypeScript (`src/features/daily-challenge/domain/daily-selector.ts`, con tests) como
documentación ejecutable; un hash opaco de Postgres (`hashtext()`) no se puede reproducir en JS de
forma confiable, así que la "especificación en dos lenguajes" dejaría de ser real. Zona horaria UTC
fija para que todos los jugadores vean el mismo reto sin ambigüedad.

**Idempotencia real, no solo de UI**: `get-today-challenge.ts` comprueba si ya existe un
`daily_results` para `(challenge_id, user_id | anon_id)` antes de arrancar una sesión nueva; si
existe, se muestra ese resultado guardado en vez de un tablero. La garantía de fondo son los índices
únicos parciales de `daily_results` (0004) + `submit_daily_result` con `ON CONFLICT DO NOTHING`.

**Resultado compartible sin espóilers**: `submit_daily_result` calcula el grid de emojis
(🟩/⬜) a partir del último intento y genera un `share_code` corto. `share-encoding.ts` (dominio,
con tests) construye el texto copiable a partir de esos datos — nunca del contenido real del
timeline. `/s/[code]` es una página pública que solo lee de la vista `shared_results_public`, y
`/api/og/[code]` genera la imagen Open Graph con `next/og` a partir de los mismos datos.

## Mejoras incorporadas por diseño (no opcionales)

- Verificación y puntuación siempre server-side, nunca confiando en valores que el cliente pudiera
  enviar directamente (ver sección de modelo de datos).
- Rate limit por sesión (máximo 10 intentos) dentro de `submit_attempt()`, para evitar fuerza bruta
  trivial del orden correcto.
- Testing desde el día 1: Vitest en todo `domain/`; Playwright (Fase 2) para los flujos críticos,
  incluyendo emulación táctil (`hasTouch: true`).

## Bugs reales encontrados y corregidos en la Fase 2

Verificar contra un proyecto Supabase real (no solo tests unitarios) sacó a la luz tres problemas
que ningún test unitario habría detectado, documentados aquí porque son relevantes para quien
toque estas partes del sistema más adelante:

1. **RLS de `SELECT` bloqueaba el propio `INSERT`** (`supabase/migrations/0006_*.sql`). Cuando
   `supabase-js` encadena `.select()` tras `.insert()`, envía `Prefer: return=representation`, y
   Postgres necesita que la fila insertada también sea legible bajo la policy de `SELECT` para
   poder devolverla — no solo que pase el `WITH CHECK` de `INSERT`. La policy de `game_sessions`
   permitía insertar sesiones anónimas (`user_id is null`) pero no leerlas de vuelta, así que el
   alta fallaba con "violates row-level security policy" aunque el `INSERT` en sí fuera válido.
   Corregido en la policy, y además `start-session.ts` genera el `id` en el cliente (servidor) y
   usa `Prefer: return=minimal`, evitando depender de `RETURNING` en absoluto.
2. **Comparación de arrays en `submit_attempt` devolvía `NULL`** (`supabase/migrations/0007_*.sql`).
   La comparación posición a posición usaba un doble `unnest(...) WITH ORDINALITY ... JOIN ... USING
   (idx)`; en la práctica devolvía `NULL` de forma intermitente. Se reemplazó por
   `generate_subscripts(arr, 1)` con indexado directo (`arr[i]`), un idiom más simple y estándar
   para comparar dos arrays del mismo tamaño elemento a elemento.
3. **Los títulos/descripciones del Balón de Oro llevaban el año explícito** (contenido, no código).
   Un test e2e que revisa que ningún año aparezca en pantalla lo detectó: el título de cada evento
   decía literalmente "... Balón de Oro 2015", lo cual permite ordenar la lista sin saber nada de
   fútbol. Regla de contenido derivada de esto: ni el título ni la descripción de un evento pueden
   mencionar una fecha absoluta; las referencias relativas ("su quinto Balón de Oro", "la edición
   anterior no se entregó") sí son válidas porque exigen conocimiento real, no solo leer un número.

## Bugs reales encontrados y corregidos en la Fase 3

1. **`RETURN QUERY` en PL/pgSQL no termina la función** (`supabase/migrations/0009_*.sql`). A
   diferencia de `RETURN` a secas, `RETURN QUERY` solo agrega filas al resultado y sigue
   ejecutando el código siguiente. `submit_daily_result` y `finish_session` tenían código después
   de un `RETURN QUERY` sin un `RETURN;` detrás, produciendo 2 filas (o, en el caso de
   `finish_session` con abandono, 0 filas) cuando se ejecutaba esa rama — y el cliente llama a
   ambos RPCs con `.single()`, que exige exactamente una fila. Lo disparó un test e2e real: React
   (Strict Mode, solo en desarrollo) invoca dos veces el efecto que llama a `submit_daily_result`,
   y la segunda llamada concurrente entraba en la rama de "ya jugado" con el bug.
2. **`useEffect` con guarda anti-doble-llamada + guarda de "isMounted" es una combinación rota.**
   React Strict Mode (dev) simula un ciclo mount → cleanup → mount del *efecto* sin desmontar el
   *componente* de verdad. Si el efecto usa una ref (`hasSubmittedRef`) para no repetir una llamada
   de red, pero también usa una bandera local `isMounted` que el cleanup pone en `false`, la
   respuesta de la única llamada real queda huérfana: llega después de que el cleanup fantasma ya
   marcó `isMounted = false`, y la ref impide que la segunda invocación del efecto la "salve"
   reintentando. La solución (`daily-result.tsx`, `daily-challenge-client.tsx`,
   `play-timeline-client.tsx`) es no combinar ambas guardas: con la ref ya alcanza, y actualizar el
   estado de un componente realmente desmontado es un no-op seguro desde React 18.
3. **Satori (usado por `next/og`) exige `display: flex` explícito en cualquier `<div>` con más de
   un hijo** — no soporta el `display: block` por defecto del HTML normal. `{points} puntos` en JSX
   compila a dos nodos hijos (la expresión y el texto), lo que rompía `/api/og/[code]` con
   "Expected `<div>` to have explicit display...". Se resolvió uniendo el contenido en un solo
   string (`` {`${points} puntos`}` ``) en vez de añadir `display: flex` a cada div hoja.
4. **Un bug de sintaxis en un seed SQL** (`transfers_ibrahimovic.sql`): el alias de una subconsulta
   `VALUES` declaraba 5 columnas pero cada fila solo tenía 4 valores literales — Postgres lo
   rechaza con "table \"v\" has 4 columns available but 5 columns specified". No es un bug de
   arquitectura, pero confirma el valor de aplicar el seed contra una base real y revisar el
   mensaje de error exacto en vez de asumir que "no dio error" significa que insertó algo.

## Identidad visual por modo y animaciones (post-Fase 3)

Cada modo tiene un color de acento propio (`modes-registry.ts` → `accent`, mapeado a clases
Tailwind estáticas en `accent-classes.ts` — nunca se concatena `` `border-${accent}` `` dinámicamente
porque el escáner de Tailwind no detectaría esa clase). Transiciones de estado (tablero → resultado),
entrada de la home y estrellas escalonadas usan `framer-motion` (`AnimatePresence` + `motion.div`).

**Se intentó, y se revirtió, un layout horizontal para Tournament Timeline** (para que se leyera
como una línea de tiempo real). Se retiró por dos motivos, no por estar descartada para siempre:

1. Aplicar `layout` de `framer-motion` directamente sobre el mismo elemento que dnd-kit controla
   (`<motion.li layout>` con el `style.transform` de `useSortable`) rompía el drag de forma real:
   ambas librerías escriben `transform` en el mismo nodo. dnd-kit ya anima el reordenamiento por su
   cuenta (vía su propio `transition`), así que `motion.li` ahí era además innecesario.
2. Un test e2e específico de ese layout en contexto táctil falló de forma consistente (3/3) en un
   momento dado — probablemente contención de recursos de la máquina de desarrollo tras varias
   corridas pesadas seguidas (ver nota de `workers` abajo), no necesariamente un bug del layout en
   sí. No se confirmó cuál de las dos causas era, así que se prefirió no arriesgar antes de
   investigarlo como una tarea dedicada.

**Bug de test real encontrado en el camino** (no de producto): `tournament-timeline.spec.ts`
comprobaba que un primer intento sin reordenar casi seguro fallaría — cierto con 6+ tarjetas
(1/6! ≈ 0.14%), pero con solo 4 tarjetas (1/4! ≈ 4.2%) el shuffle aleatorio del servidor
coincidía con el orden correcto con la frecuencia suficiente para que el test fallara de forma
intermitente sin que hubiera ningún bug real. Se quitó esa comprobación específica para timelines
tan cortos; el comportamiento de "resaltar solo lo incorrecto" ya queda cubierto por
`career-timeline.spec.ts` (6 tarjetas).

**`playwright.config.ts` fija `workers: 3`**: con el paralelismo por defecto (nº de cores de la
máquina), lanzar muchos Chromium a la vez contra un único `next dev` producía páginas en blanco y
timeouts que no eran bugs reales, sino saturación del entorno de desarrollo.

## Modo de interacción "match" (Transfer Timeline)

Career Timeline y Transfer Timeline resultaron ser, en la práctica, el mismo ejercicio ("ordena los
clubes de un jugador") cuando se aplican al mismo tipo de contenido — ambos usan tarjetas de texto
"Fichaje por X" y la misma mecánica de reordenar una lista. Para diferenciarlos de verdad, Transfer
Timeline pasó a un mecanismo distinto: en vez de reordenar, el jugador arrastra cada elemento
(una camiseta genérica, ver `jersey.tsx`/`jersey-colors.ts`) a un casillero fijo. Career, Achievement,
Club y Ballon d'Or siguen usando el ordenamiento en lista; Tournament también, por ahora.

`modes-registry.ts` añade `interaction: "sort" | "match"` por modo. El resto de la arquitectura no
cambia:

- **El año SÍ se revela en los casilleros, a propósito** (única excepción a "nunca mostrar fechas"):
  el reto de este modo es "sabes en qué año exacto fue este fichaje", no el orden relativo. Sigue sin
  revelarse **qué elemento va en cuál casillero** — eso es lo que el jugador debe descubrir, y es
  exactamente lo que `correct_order` sigue protegiendo.
- Dos RPCs nuevas y independientes (`get_timeline_match_cards`, `get_timeline_slot_labels`,
  `supabase/migrations/0011_match_mode_rpcs.sql`) devuelven, por separado, los elementos mezclados
  (sin año) y los años ya ordenados (sin decir de qué elemento son). Ninguna de las dos expone la
  pareja evento↔casillero.
- **La verificación reutiliza `submit_attempt`/`finish_session` sin ningún cambio**: el array que se
  envía es "para cada casillero, en orden, qué `event_id` se colocó ahí" — tiene la misma forma
  exacta que un `submitted_order` de los modos de lista. Un casillero *es*, estructuralmente, una
  posición; no hizo falta ni esquema ni RPCs de verificación nuevos.
- La lógica de colocar/quitar/intercambiar elementos vive en `match-placement.ts`, pura y testeada
  (sin React ni Supabase), igual que `verify-order.ts` en su momento — mismo patrón de diseño.
- **Camisetas genéricas, no oficiales, a propósito**: colores determinados por hash del nombre del
  club (`palette-colors.ts`, paleta genérica de 10 colores — el mismo picker se reutiliza para los
  avatares de entrenador de Club Timeline), no los colores reales de ningún club. Evita cualquier
  problema de marca o trade dress y no requiere mantener una tabla club→color a mano.

## Variante de tarjeta "flags" (Tournament Timeline)

Tournament Timeline sigue usando la mecánica "sort" (TimelineBoard), pero con una tarjeta distinta:
`modes-registry.ts` añade `cardVariant: "text" | "flags"` por modo. Cuando es `"flags"`, `EventCard`
ignora `event.title` y renderiza en su lugar `event.metadata.flags` (un array de 2 emoji) como
"bandera vs bandera" — sin texto ni resultado, para no revelar quién ganó ni la fase del torneo.

El enunciado específico de cada timeline ("Ordena qué partido fue primero en el Mundial de Catar
2022.") vive en `timelines.description` y se muestra como instrucción en `/play/[mode]/[slug]` y en
`/daily` — reemplaza el texto genérico "Ordena las tarjetas..." cuando el timeline lo define. Que la
instrucción nombre el torneo (incluido su año) no es un espóiler: no dice nada sobre el orden de
ningún partido en particular, igual que ya pasaba con el título del timeline.

Las banderas de países son emoji Unicode estándar (`events.metadata.flags`) — sin ningún problema de
derechos, a diferencia de escudos de clubes, que sí necesitarían el mismo tratamiento genérico que
las camisetas de Transfer Timeline si en el futuro se agrega una Champions League.

## Diagrama horizontal con avatares (Club Timeline)

Club Timeline mantiene la mecánica "sort" (sigue siendo ordenar), pero cambia `cardVariant: "avatar"`
(iniciales genéricas sobre color determinista, ver `avatar.tsx` — nunca una foto real de una persona
identificable sin licencia) y `boardLayout: "horizontal"` para leerse como un diagrama de línea de
tiempo en vez de una lista vertical.

**Bug real encontrado y corregido, no solo un artefacto de test**: la primera implementación de
`boardLayout: "horizontal"` usaba `flex gap-3 overflow-x-auto` (una sola fila con scroll horizontal)
y `horizontalListSortingStrategy`. En un viewport angosto (probado con el proyecto Playwright
`mobile-chromium-touch`, ~412px), las 6 tarjetas no caben en una fila y el contenedor necesita hacer
scroll horizontal. Arrastrar una tarjeta cerca del borde dispara el auto-scroll de dnd-kit, que
desplaza el contenedor a mitad del gesto — el punto de destino final queda en una posición de pantalla
distinta a la que tenía cuando arrancó el drag. Se reprodujo de forma consistente (4/5 corridas
fallaban) con drags programáticos hacia coordenadas fijas; un usuario real con feedback visual
continuo lo sufriría en menor medida, pero sigue siendo un gesto frágil en pantallas angostas, así
que se trata como bug de producto, no solo de test.

**Fix**: se cambió el contenedor horizontal a `flex flex-wrap` (sin `overflow-x-auto`) y la estrategia
de dnd-kit a `rectSortingStrategy` (pensada para grillas que envuelven en varias filas, a diferencia
de `horizontalListSortingStrategy` que asume una sola fila). Así la página vuelve a hacer scroll
vertical normal — el mismo mecanismo que ya funciona de forma fiable en todos los demás modos — en
vez de competir con un scroll horizontal anidado durante el drag. Verificado con 5 corridas limpias
consecutivas en aislamiento (`--workers=1`) en ambos proyectos de Playwright tras el cambio.

`tests/e2e/helpers.ts`: `dragCard`/`reorderCardsTo` llaman a `scrollIntoViewIfNeeded()` sobre la
tarjeta destino antes de medir su posición (sigue siendo necesario con `flex-wrap`: con muchas
tarjetas, filas más abajo pueden estar fuera de la vista y su posición de layout no es la misma que
su posición real en pantalla hasta que se desplaza la página). El eje de movimiento ya no se pasa a
mano: `dragCard` lo calcula comparando la geometría real de origen/destino (`dx` vs `dy`) — necesario
para Achievement Timeline (ver siguiente sección), cuya grilla-serpiente mezcla movimientos
horizontales (dentro de una fila) y verticales (al saltar de fila) según el par de tarjetas.

## Grilla en forma de camino (Achievement Timeline)

Achievement Timeline mantiene la mecánica "sort", pero quita los eventos de debut y retiro del seed
de Zidane (`achievements_zidane_remove_biographical.sql`) — eran hechos biográficos, no premios, y
además revelaban trivialmente los dos extremos del orden — dejando solo premios/logros individuales
y colectivos reales (Serie A con Juventus, Mundial y Balón de Oro de 1998, Eurocopa 2000, Champions
League y Copa Intercontinental con el Real Madrid en 2002).

El layout pasa de lista vertical a `boardLayout: "path"`: una grilla tipo serpiente/laberinto de
tablero de juego de mesa, calculada en `snake-grid.ts` (puro, testeado con Vitest, mismo patrón de
diseño que `verify-order.ts`/`match-placement.ts`). `getSnakeLayout(n)` ubica el elemento `index` en
`(row, col)` alternando el sentido de lectura por fila (fila par → izquierda a derecha, fila impar →
derecha a izquierda), así los índices consecutivos siempre son celdas vecinas en pantalla — esa es la
propiedad que hace que se lea como un camino continuo. `EventCard` recibe la celda calculada y aplica
`gridRow`/`gridColumn` inline, más una flecha de dirección (→ ← ↓ 🏁) hacia el siguiente paso.

Se descartó reutilizar el patrón de "casilleros fijos" de `match-placement.ts` (considerado al
diseñar esta sección): ahí cada casillero revela un dato real (el año, en Transfer) y el reto es
"a qué casillero va cada elemento", no un orden secuencial. Achievement Timeline sigue siendo
fundamentalmente "ordena estos N elementos" — cambia la forma en que se dibuja esa lista, no la
mecánica — así que interaction sigue en `"sort"` y no necesitó RPCs nuevas.

Al igual que con el layout horizontal de Club Timeline, se usa `rectSortingStrategy` de dnd-kit (no
asume una sola fila/columna) y `flex-wrap`/`grid` en vez de scroll anidado. Verificado con 5 corridas
limpias consecutivas en aislamiento en ambos proyectos de Playwright.

## Modo "emparejar" invertido (Ballon d'Or Timeline)

Ballon d'Or Timeline pasa de "sort" a "match", igual que Transfer, pero con los lados invertidos:
en Transfer los casilleros revelan el año y los elementos ocultan la identidad; aquí los elementos
(un balón dorado genérico, `ballon-dor-ball.tsx` — nunca el logotipo real del trofeo de France
Football) ya muestran el año, y se arrastran hacia un casillero que revela el nombre/avatar del
jugador. `modes-registry.ts` añade `matchVariant: "year-slots" | "name-slots"` (solo aplica con
`interaction: "match"`) para que `start-match-session.ts` y `MatchBoard` sepan qué par de RPCs y qué
tokens visuales usar por modo, sin duplicar `MatchBoard`/`use-match-session.ts`/`match-placement.ts`
(siguen siendo 100% genéricos: no les importa qué significan los labels que reciben).

**Por qué hicieron falta dos RPCs nuevas y no reutilizar las de Transfer** (`0012_ballon_dor_reverse_match_rpcs.sql`,
mirror de `0011`): en `get_timeline_slot_labels` (Transfer) el slot_index se numera por
`row_number() over (order by te.correct_order)` — es decir, los casilleros se leen en el orden
cronológico real. Para años sueltos eso no es un espóiler (ordenar números en ascendente no exige
saber nada de fútbol), pero para nombres de jugador SÍ lo sería: leer los casilleros de Ballon d'Or
en su `correct_order` real mostraría literalmente "quién ganó antes que quién", que es justo el
conocimiento que este modo evalúa. La nueva `get_timeline_match_slots_by_name` numera los casilleros
por **orden alfabético del nombre** en su lugar — no aporta ninguna pista cronológica.

Esto obliga a resembrar `correct_order` como el **rango alfabético**, no el cronológico, para ese
timeline (`ballon_dor_2004_2007_match.sql`): `submit_attempt` compara `submitted_order[i]` contra el
evento cuyo `correct_order = i+1`, así que tiene que coincidir exactamente con el `slot_index` que
el jugador ve en pantalla. El significado de `correct_order` ("índice de casillero" en vez de
"posición cronológica") es una decisión de contenido por timeline, no un cambio de esquema ni de RPC.

**El seed original de Ballon d'Or no servía para este mecanismo y se archivó**: "ballon-dor-2015-2023"
tiene ganadores repetidos (Messi 4 veces, Ronaldo 2 veces) — con casilleros por nombre, eso produciría
varios casilleros idénticos ("Messi", "Messi", "Messi", "Messi") sin ninguna forma de distinguirlos.
Se marcó `status = 'archived'`, `is_daily_eligible = false`, y se sembró un timeline nuevo con 4
ganadores reales y DISTINTOS (Shevchenko 2004, Ronaldinho 2005, Cannavaro 2006, Kaká 2007).

Archivar un timeline elegible cambia el conjunto sobre el que `ensure_daily_challenge` calcula
`hash(fecha) % nº elegibles` — aunque el conteo total no cambió (uno sale, uno entra), el timeline
que le corresponde a una fecha concreta sí puede cambiar. Se verificó que el reto de hoy sigue
cayendo en un timeline "sort" (regresión completa en verde) tras el resembrado.

## Fusión Career/Transfer y nuevo modo "guess" (adivinar un valor con pistas)

Tras rediseñar Club, Achievement y Ballon d'Or, la evaluación final pedida por el propietario del
producto encontró un solapamiento real que ningún cambio de mecánica anterior había tocado: **Career
Timeline y la Transfer Timeline original exploraban el mismo tema** ("los clubes de un jugador"),
solo que Transfer ya usaba la mecánica "match" y Career seguía en "sort". El fix no era de mecánica
sino de contenido — dos modos distintos preguntando esencialmente lo mismo — y el propietario pidió
explícitamente fusionarlos y usar el hueco libre para un modo con una idea completamente nueva.

**La fusión**: Career Timeline pasa de "sort" a `interaction: "match", matchVariant: "year-slots"`
— exactamente la mecánica que tenía Transfer. Su seed real (Cristiano Ronaldo: 6 clubes, 6 años
distintos, `correct_order` ya ascendente) resultó ser 100% compatible con esa mecánica sin tocar un
solo evento, porque `get_timeline_match_cards`/`get_timeline_slot_labels` (0011) son genéricas por
`timeline_id`, no por modo. El timeline de Zlatan Ibrahimović (antes bajo `mode_id='transfer'`) se
mudó con un simple `update timelines set mode_id = 'career'`
(`career_transfer_merge_and_value_mode.sql`) — sigue siendo el mismo contenido y la misma mecánica,
solo cambia debajo de qué modo vive.

**El modo nuevo, "guess"** (`ModeInteraction`, junto a "sort" y "match"): adivinar un único valor
numérico secreto — el valor real de un fichaje histórico, en euros — con pistas de "más alto"/"más
bajo" tras cada intento, hasta acertar o rendirse. Reutiliza `game_sessions`/`scores` sin cambios
(gracias a la nueva dificultad `difficulties.id = 'single'`, `event_count = 1`: un "timeline" de este
modo tiene exactamente un `timeline_events`), pero necesitó piezas nuevas porque no hay ni lista que
ordenar ni pool que emparejar — solo un valor y un contador de intentos (`0013_guess_mode.sql`):

- **`event_secret_values(event_id, value_eur)`, con RLS admin-only** — el hallazgo de seguridad más
  importante de esta sección: `events.metadata` tiene lectura pública (policy `events_public_read`,
  sin distinguir qué claves del jsonb son "seguras" de cuáles no), así que guardar el valor real ahí
  habría permitido a cualquiera consultarlo directo vía la API de Supabase con la clave `anon`, sin
  jugar. Se guarda en una tabla aparte, con el mismo criterio que ya protege `timeline_events.correct_order`.
- **`guess_attempts`**, análoga a `game_attempts` pero para un valor numérico en vez de un array de
  posiciones — no se reutilizó `game_attempts` porque su forma (`submitted_order uuid[]`,
  `correct_positions boolean[]`) no tiene sentido para un único número.
- **Tres RPCs nuevas**: `get_guess_target` (solo el `event_id`, nunca el valor — ni siquiera hace
  falta en el cliente hoy, pero confirma que el timeline tiene un reto configurado antes de arrancar
  la sesión), `check_guess_attempt` (compara el intento contra el valor real server-side, devuelve
  `'higher' | 'lower' | 'correct'`, nunca el valor salvo que sea exacto), y `finish_guess_session`
  (cierra la sesión y **siempre** revela `actual_value_eur` al terminar — acertado o abandonado — es
  la única forma en que el jugador se entera del valor real si se rinde).
- **Fórmula de puntuación propia** (`guess-scoring.ts` + `finish_guess_session`, mismo patrón de
  "TS puro es la especificación ejecutable, SQL es la versión autoritativa" que `scoring.ts`): sin
  `totalEvents`, la base es fija y la penalización depende directamente de cuántos intentos de
  "más alto/más bajo" hicieron falta, más una bonificación si se acertó al primer intento.
- **`GuessBoard`** (nuevo componente, no reutiliza `TimelineBoard`/`MatchBoard`): input numérico +
  botón "Adivinar", historial de intentos con pista visual (⬆️/⬇️/✅) por intento, y botón "Rendirse".

**Contenido real**: el fichaje de Neymar del FC Barcelona al Paris Saint-Germain en 2017, por
222.000.000 € — la cláusula de rescisión que pagó el PSG, un hecho público y verificable sin
ambigüedad de moneda (a diferencia de fichajes cuya cifra original se pactó en libras o dólares).

**Alcance de esta primera versión, deliberadamente reducido**: el nuevo timeline de Neymar se sembró
con `is_daily_eligible = false`. Integrarlo al reto diario exigiría además adaptar `submit_daily_result`
(hoy construye la cuadrícula compartible a partir de `game_attempts.correct_positions`, que no existe
en modo "guess" — habría que decidir qué cuadrícula tiene sentido para una serie de pistas
más-alto/más-bajo) y la imagen OG dinámica. Se deja como mejora futura explícita en vez de forzarlo
ahora; jugarlo desde `/play/transfer/neymar-psg-transfer-value` funciona igual sin esa integración.

## Mejoras futuras consideradas (no bloqueantes)

- Integrar el modo "guess" al reto diario: decidir la representación de la cuadrícula compartible
  para una serie de pistas más-alto/más-bajo (no hay "posiciones correctas" que colorear) y adaptar
  `submit_daily_result`/la imagen OG en consecuencia.

- `pg_cron` de Supabase para pre-generar el daily challenge con antelación, si se quiere anunciar
  "el reto de mañana" sin exponer su contenido antes de tiempo.
- Esquema Zod por modo para validar la forma de `events.metadata` desde el panel admin, evitando que
  un dato mal formado rompa un renderer de tarjeta en producción.
- `next-intl` si en algún momento se quiere soportar más de un idioma (hoy la UI está solo en español).
- Retomar el layout horizontal para Tournament Timeline (u otros modos con pocos eventos), ahora que
  Club Timeline ya validó el patrón `flex-wrap` + `rectSortingStrategy` (ver sección dedicada arriba)
  como la forma correcta de hacerlo sin el bug de auto-scroll + drag.

## Fases

Ver README.md para el estado actual de cada fase. El detalle de qué incluye cada una y sus criterios
de "hecho" se acordó explícitamente con el propietario del producto antes de empezar a construir.
