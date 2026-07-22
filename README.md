# Football Timeline ⚽

Juego diario de ordenar cronológicamente eventos de fútbol (estilo Wordle/Futbol11/7-0), construido
con Next.js (App Router) + TypeScript + Tailwind CSS + Supabase (Postgres + Auth + RLS).

## Estado del proyecto

Construcción por fases, con checkpoint de revisión entre cada una. Ver el detalle completo de la
arquitectura y del desglose fase por fase en `docs/architecture.md`.

- [x] **Fase 1 — Fundación**: proyecto Next.js, estructura de carpetas, esquema SQL completo, design
      system base en modo oscuro.
- [x] **Fase 2 — Motor de juego**: Career Timeline y Ballon d'Or Timeline jugables de principio a fin
      (drag & drop, verificación server-side, puntuación real), contra un proyecto Supabase real.
- [x] **Fase 3 — Los 6 modos + daily challenge**: Achievement, Club, Tournament y Transfer Timeline
      jugables; reto diario idéntico para todos, idempotente, con resultado compartible (texto +
      imagen Open Graph) sin espóilers.
- [x] **Rediseño de modos post-Fase 3**: Club (diagrama horizontal de entrenadores), Achievement
      (grilla en forma de camino), Career/Transfer fusionados con un modo "adivinar" (adivina el
      valor de un fichaje, con pistas de más alto/más bajo) y Ballon d'Or convertido en modo
      "emparejar" invertido (balón de un año → jugador que lo ganó).
- [x] **Ballon d'Or Timeline con historial completo**: los 69 Balones de Oro reales (1956-2025, sin
      contar 2020) están cargados como datos históricos. Cada partida elige al azar 4 ediciones
      consecutivas de las 66 ventanas posibles (repetidos incluidos) — cuanto más antigua la
      ventana, mayor la dificultad y el multiplicador de puntos. Si un jugador aparece dos veces en
      la misma ventana, su casillero se etiqueta con el ordinal real de ese título en su carrera
      (p. ej. "Messi (5)") para eliminar la ambigüedad sin inventar datos.
- [x] **Autenticación mínima**: registro/login por email+contraseña (`@supabase/ssr`), como
      prerrequisito del módulo PvP — sigue sin ser obligatoria para jugar ningún modo individual.
- [x] **PvP Online**: duelos 1v1 en tiempo real (Supabase Realtime), 3 juegos elegidos al azar sin
      repetir modo, Oficial (Rating ELO/MMR) si ambos jugadores están registrados o Amistosa en
      cualquier otro caso. Reutiliza exactamente los boards/hooks/RPCs de los modos individuales —
      el Match Engine solo orquesta matchmaking, sincronización y puntajes ya calculados por cada
      modo, nunca reimplementa reglas. Ver detalle en la sección "Módulo PvP" más abajo.
- [ ] **Fase 4** — Perfil + estadísticas + ranking (UI) + logros + racha.
- [ ] **Fase 5** — Panel admin + importación CSV.

## Requisitos

- Node.js 20.9+ (usado en desarrollo: Node 22)
- Un proyecto de [Supabase](https://supabase.com) con las migraciones aplicadas (ver abajo) —
  ya requerido desde la Fase 2, el motor de juego necesita una base de datos real.

## Puesta en marcha local

```bash
npm install
cp .env.example .env.local   # y completa las claves, ver "Conectar Supabase" abajo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) — usa `localhost`, no la IP de red que también
imprime `next dev`: Next.js bloquea por defecto las peticiones al servidor de desarrollo que no
vengan de un origen permitido (ver `allowedDevOrigins` en `next.config.ts` si necesitas probar
desde otro dispositivo de tu red, por ejemplo un móvil real para drag & drop táctil).

## Conectar Supabase

1. Crea un proyecto en [supabase.com/dashboard](https://supabase.com/dashboard).
2. Completa `.env.local` con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
   `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API).
3. Aplica, **en orden**, todos los archivos de `supabase/migrations/` (numerados 0001 a 0024) y
   luego los de `supabase/seed/` — vía el SQL Editor del dashboard (copiar/pegar cada archivo y
   ejecutar) o con la CLI si tienes conectividad IPv6 o el connection string del pooler:

   ```bash
   npx supabase link --project-ref <tu-project-ref>
   npx supabase db push
   ```

   > Los archivos `0006_*`, `0007_*`, `0009_*` y `0015_*` son parches sobre bugs reales encontrados
   > durante el desarrollo (ver `docs/architecture.md`); en una base nueva se aplican igual que
   > cualquier otra migración, en orden numérico.
   >
   > Dentro de `supabase/seed/`, `ballon_dor_full_history.sql` carga los 69 Balones de Oro reales y
   > debe aplicarse **después** de las migraciones 0011-0016 (dependen de las funciones de esa
   > migración); `ballon_dor_backfill_missing_editions.sql` es un parche de datos que corrige 10
   > ediciones que quedaron sin etiquetar por un seed anterior y se aplica justo después.
   >
   > Las migraciones `0017`-`0022` son el módulo PvP (ver siguiente sección) — `0018` reescribe
   > `finish_session`/`finish_guess_session` sin cambiar su comportamiento público, así que es
   > seguro aplicarla aunque no vayas a usar PvP. `0019` incluye `alter publication
   > supabase_realtime add table ...`: si tu proyecto de Supabase no tiene la publicación
   > `supabase_realtime` por defecto (poco común), créala antes con `create publication
   > supabase_realtime;`.

4. (Opcional) Regenera los tipos de la base de datos:

   ```bash
   npx supabase gen types typescript --project-id <tu-project-id> --schema public > src/types/database.types.ts
   ```

## Módulo PvP

Duelos 1v1 en `/pvp`. Piezas clave:

- **Cero duplicación de lógica de juego**: el Match Engine (`src/features/pvp/`) nunca reimplementa
  reglas, puntuación ni animaciones. `PvpMatchClient` monta exactamente `TimelineBoard`/
  `MatchBoard`/`GuessBoard` (los mismos de siempre, elegidos por `getGameMode(modeId).interaction`,
  igual que ya hace `DailyChallengeClient`) y usa su prop `renderResult` para reportar el puntaje
  que el propio modo ya calculó — jamás lo recalcula. Cualquier cambio futuro en un modo (regla,
  puntuación, UI) se hereda automáticamente en PvP sin tocar este módulo.
- **Oficial vs. Amistosa**: se decide en el servidor (`try_match_players`, 0021) según si ambos
  jugadores tienen `user_id` (registrados) — nunca en el cliente. Amistosa se juega igual pero no
  toca Rating/estadísticas competitivas.
- **Rating ELO/MMR**: `src/features/pvp/domain/elo.ts` (puro, testeado) es la especificación
  ejecutable de `calculate_elo_delta` en `0020_pvp_rating_and_stats.sql` — mismo patrón que
  `scoring.ts` ↔ `calculate_score_v1`.
- **Tiempo real sin polling**: Supabase Realtime sobre `pvp_queue`/`pvp_matches`/
  `pvp_match_games`/`pvp_match_players` (públicas); `pvp_match_game_results` (el puntaje de cada
  jugador en cada juego) no tiene policy de lectura pública a propósito — la única forma de leerlo
  es `get_pvp_match_state`, que solo revela el resultado del rival en un juego si el tuyo para ese
  mismo juego ya existe (evita espiar el puntaje del rival a mitad de partida).
- **Sin servidor persistente**: como el hosting es serverless, nadie "vigila" el reloj de cada
  juego — `advance_pvp_game` es idempotente y cualquiera de los 2 clientes la dispara justo al
  vencer el plazo (`ends_at`, calculado por el servidor); fuerza el cierre de quien no terminó a
  tiempo reutilizando el `p_abandon=true` que `finish_session`/`finish_guess_session` ya soportaban.
- **Salas privadas por código**: además de "Buscar partida" (FIFO al azar), se puede "Crear sala"
  (genera un código de 6 caracteres para compartir) o "Unirse" con el código de otro — reutiliza la
  misma cola (`pvp_queue`) y la misma función de creación de match que el emparejamiento aleatorio
  (`create_pvp_match_for_pair`, 0024), cero lógica duplicada.
- **Rankings**: mundial e histórico ya tienen página (`get_pvp_leaderboard_world`/`_historical`);
  por país y semanal/mensual tienen su RPC lista (`get_pvp_leaderboard_country`/`_period`) pero sin
  UI todavía — quedan como siguiente paso natural, no requieren esquema nuevo.

## Scripts

| Comando               | Qué hace                                                    |
| ---------------------- | ------------------------------------------------------------ |
| `npm run dev`          | Servidor de desarrollo (Turbopack)                           |
| `npm run build`        | Build de producción                                          |
| `npm start`            | Sirve el build de producción                                 |
| `npm run lint`         | ESLint                                                        |
| `npm test`             | Tests unitarios (Vitest, una sola pasada)                     |
| `npm run test:watch`   | Tests unitarios en modo watch                                 |
| `npm run test:e2e`     | Tests end-to-end (Playwright, contra Supabase real; requiere `.env.local`) |

## Estructura del proyecto

```
src/
  app/            Rutas (App Router) — shell delgado, sin lógica de negocio
  features/       Lógica por dominio: game-engine, daily-challenge, pvp, auth, admin, profile-stats
    <feature>/domain/      Funciones puras y testeables (sin Next.js ni Supabase)
    <feature>/actions/     Server Actions que orquestan domain/ + Supabase
    <feature>/components/  UI específica de esa feature
  components/ui/  Design system compartido (Button, Card, Badge...)
  lib/            Supabase (client/server/admin), validación de entorno, utilidades
  types/          Tipos generados de la base de datos
supabase/
  migrations/     Esquema SQL versionado (se aplica con `supabase db push`)
  seed/           Timelines reales curados, listos para importar
```

Cada carpeta de una fase futura tiene un `README.md` explicando qué llega y en qué fase.
