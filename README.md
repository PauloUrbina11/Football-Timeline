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
- [ ] **Fase 4** — Autenticación + perfil + estadísticas + ranking + logros + racha.
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
3. Aplica, **en orden**, todos los archivos de `supabase/migrations/` (numerados 0001 a 0009) y
   luego los de `supabase/seed/` — vía el SQL Editor del dashboard (copiar/pegar cada archivo y
   ejecutar) o con la CLI si tienes conectividad IPv6 o el connection string del pooler:

   ```bash
   npx supabase link --project-ref <tu-project-ref>
   npx supabase db push
   ```

   > Los archivos `0006_*`, `0007_*` y `0009_*` son parches sobre bugs reales encontrados durante
   > las Fases 2 y 3 (ver `docs/architecture.md`); en una base nueva se aplican igual que cualquier
   > otra migración.

4. (Opcional) Regenera los tipos de la base de datos:

   ```bash
   npx supabase gen types typescript --project-id <tu-project-id> --schema public > src/types/database.types.ts
   ```

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
  features/       Lógica por dominio: game-engine, daily-challenge, admin, auth, profile-stats
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
