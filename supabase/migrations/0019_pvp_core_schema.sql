-- Football Timeline — 0019: esquema del módulo PvP Online (solo DDL — las RPCs del Match Engine
-- viven en 0020-0022). Ver el plan de arquitectura del módulo para la justificación completa de
-- cada tabla; resumen rápido:
--   pvp_seasons            temporadas competitivas (soft reset documentado, sin perder histórico).
--   pvp_matches            un duelo (2 jugadores, 3 juegos).
--   pvp_match_players      los 2 asientos de un match (puede ser invitado: sin fila en profiles).
--   pvp_match_games        los 3 juegos del match — mismo timeline para ambos jugadores, justo.
--   pvp_match_game_results el puntaje de CADA jugador en CADA juego (copia de `scores`, nunca lo
--                           recalcula) — sin policy de SELECT pública a propósito, ver más abajo.
--   pvp_ratings             Rating (ELO/MMR) actual de cada usuario registrado.
--   pvp_rating_history      ledger append-only de cada cambio de Rating — de aquí salen los
--                           rankings semanal/mensual/histórico, sin resetear ni duplicar nada.
--   pvp_player_stats        agregados de por vida (partidas, victorias, rachas...).
--   pvp_player_mode_stats   puntos/partidas por modo, para derivar "mejor/peor modo" sin guardar
--                           un campo derivado que pueda quedar desincronizado.
--   pvp_queue               pool de espera de matchmaking (efímero).
-- Deliberadamente NO hay una tabla `Leaderboards`: los 5 rankings pedidos se sirven con RPCs de
-- solo lectura sobre pvp_ratings/pvp_rating_history (ver 0022) — evita datos derivados obsoletos.

create table pvp_seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_current boolean not null default false,
  -- Fracción del Rating por encima de 1000 que se conserva al iniciar la siguiente temporada
  -- (soft reset): p.ej. 0.5 = un jugador en 1400 empieza la nueva temporada en 1200.
  soft_reset_factor numeric not null default 0.5 check (soft_reset_factor between 0 and 1),
  created_at timestamptz not null default now()
);

create unique index uq_pvp_seasons_current on pvp_seasons(is_current) where is_current;

insert into pvp_seasons (name, is_current) values ('Temporada 1', true);

create table pvp_matches (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'countdown' check (status in ('countdown', 'in_progress', 'completed', 'cancelled', 'abandoned')),
  -- Oficial únicamente si AMBOS jugadores están autenticados — se decide en el servidor al crear
  -- el match (try_match_players, 0021), nunca en el cliente.
  is_official boolean not null default false,
  season_id uuid not null references pvp_seasons(id),
  time_limit_seconds int not null default 60 check (time_limit_seconds > 0),
  total_games smallint not null default 3 check (total_games > 0),
  current_game_index smallint not null default 0 check (current_game_index >= 0),
  winner_match_player_id uuid,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index idx_pvp_matches_status on pvp_matches(status);

create table pvp_match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references pvp_matches(id) on delete cascade,
  seat smallint not null check (seat in (1, 2)),
  user_id uuid references auth.users(id),
  anon_id uuid,
  guest_alias text,
  rating_before int,
  rating_after int,
  rating_delta int,
  total_points int not null default 0,
  is_connected boolean not null default true,
  last_seen_at timestamptz not null default now(),
  left_at timestamptz,
  unique (match_id, seat),
  constraint pvp_match_players_owner_check check (user_id is not null or anon_id is not null)
);

create index idx_pvp_match_players_match on pvp_match_players(match_id);
create index idx_pvp_match_players_user on pvp_match_players(user_id);
create index idx_pvp_match_players_anon on pvp_match_players(anon_id);

alter table pvp_matches
  add constraint pvp_matches_winner_fk foreign key (winner_match_player_id) references pvp_match_players(id);

create table pvp_match_games (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references pvp_matches(id) on delete cascade,
  game_index smallint not null check (game_index >= 0),
  mode_id text not null references game_modes(id),
  timeline_id uuid not null references timelines(id),
  status text not null default 'pending' check (status in ('pending', 'active', 'completed')),
  started_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  unique (match_id, game_index)
);

create index idx_pvp_match_games_match on pvp_match_games(match_id);

-- El puntaje de cada jugador en cada juego — copia liviana de `scores`/`game_attempts` (nunca
-- recalculada), necesaria porque esas tablas no saben nada de "match" ni de "rival".
create table pvp_match_game_results (
  id uuid primary key default gen_random_uuid(),
  match_game_id uuid not null references pvp_match_games(id) on delete cascade,
  match_player_id uuid not null references pvp_match_players(id) on delete cascade,
  -- Nullable a propósito: un jugador que nunca llegó a crear sesión para este juego (cerró la
  -- pestaña antes de que le tocara) igual necesita una fila con 0 puntos para poder cerrar el
  -- juego sin esperarlo — ver advance_pvp_game (0021).
  session_id uuid unique references game_sessions(id),
  points int not null default 0,
  stars smallint,
  time_ms int not null default 0,
  created_at timestamptz not null default now(),
  unique (match_game_id, match_player_id)
);

-- La sesión de juego (game_sessions, tabla ya existente) queda enlazada a su juego de PvP, igual
-- que ya se enlaza a un daily_challenge_id — mismo patrón, columna nueva opcional.
alter table game_sessions add column pvp_match_game_id uuid references pvp_match_games(id);
create index idx_sessions_pvp_match_game on game_sessions(pvp_match_game_id);

create table pvp_ratings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_rating int not null default 1000,
  peak_rating int not null default 1000,
  season_id uuid not null references pvp_seasons(id),
  updated_at timestamptz not null default now()
);

create trigger trg_pvp_ratings_updated_at
  before update on pvp_ratings
  for each row execute function set_updated_at();

create table pvp_rating_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid references pvp_matches(id),
  season_id uuid not null references pvp_seasons(id),
  rating_before int not null,
  rating_after int not null,
  delta int not null,
  created_at timestamptz not null default now()
);

create index idx_pvp_rating_history_user on pvp_rating_history(user_id, created_at desc);
create index idx_pvp_rating_history_created on pvp_rating_history(created_at desc);

create table pvp_player_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  matches_played int not null default 0,
  official_matches int not null default 0,
  friendly_matches int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  draws int not null default 0,
  current_streak int not null default 0,
  best_streak int not null default 0,
  total_points bigint not null default 0,
  total_time_ms bigint not null default 0,
  updated_at timestamptz not null default now()
);

create trigger trg_pvp_player_stats_updated_at
  before update on pvp_player_stats
  for each row execute function set_updated_at();

-- Puntos/partidas por modo — de aquí se deriva "mejor/peor modo" en la lectura (evita guardar un
-- campo derivado en pvp_player_stats que pueda quedar desincronizado).
create table pvp_player_mode_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  mode_id text not null references game_modes(id),
  games_played int not null default 0,
  total_points bigint not null default 0,
  primary key (user_id, mode_id)
);

create table pvp_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anon_id uuid,
  guest_alias text,
  rating int not null default 1000,
  status text not null default 'waiting' check (status in ('waiting', 'matched', 'cancelled')),
  matched_match_id uuid references pvp_matches(id),
  queued_at timestamptz not null default now(),
  constraint pvp_queue_owner_check check (user_id is not null or anon_id is not null),
  constraint pvp_queue_alias_check check (user_id is not null or guest_alias is not null)
);

-- Un jugador no puede tener dos filas "waiting" a la vez (protección contra doble clic en "Buscar").
create unique index uq_pvp_queue_waiting_user on pvp_queue(user_id) where status = 'waiting' and user_id is not null;
create unique index uq_pvp_queue_waiting_anon on pvp_queue(anon_id) where status = 'waiting' and anon_id is not null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table pvp_seasons enable row level security;
alter table pvp_matches enable row level security;
alter table pvp_match_players enable row level security;
alter table pvp_match_games enable row level security;
alter table pvp_match_game_results enable row level security;
alter table pvp_ratings enable row level security;
alter table pvp_rating_history enable row level security;
alter table pvp_player_stats enable row level security;
alter table pvp_player_mode_stats enable row level security;
alter table pvp_queue enable row level security;

create policy "pvp_seasons_read" on pvp_seasons for select using (true);
create policy "pvp_seasons_admin_write" on pvp_seasons for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- pvp_matches / pvp_match_players / pvp_match_games: nada de esto es secreto (mismo criterio que
-- ya usa `scores_public_read` y `timelines_public_read`) — lo único que debe permanecer oculto es
-- el PUNTAJE de un juego todavía no revelado, que vive aparte en pvp_match_game_results.
create policy "pvp_matches_read" on pvp_matches for select using (true);
create policy "pvp_matches_admin_write" on pvp_matches for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy "pvp_match_players_read" on pvp_match_players for select using (true);
create policy "pvp_match_players_admin_write" on pvp_match_players for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy "pvp_match_games_read" on pvp_match_games for select using (true);
create policy "pvp_match_games_admin_write" on pvp_match_games for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- pvp_match_game_results: SIN policy de lectura pública/de participante a propósito. Un jugador
-- podría ver el puntaje del rival en un juego que el rival ya terminó pero él todavía no — le daría
-- información para ajustar su estrategia. La única forma de leer un resultado es a través de
-- `get_pvp_match_state` (security definer, 0021), que aplica esa regla en SQL antes de revelar
-- nada: "solo se puede ver el resultado del rival en un juego si tu propio resultado para ese mismo
-- juego ya existe". Mismo criterio que ya protege `timeline_events.correct_order` (0002).
create policy "pvp_match_game_results_admin_read" on pvp_match_game_results for select using (is_admin(auth.uid()));
create policy "pvp_match_game_results_admin_write" on pvp_match_game_results for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- pvp_ratings / pvp_rating_history / pvp_player_stats / pvp_player_mode_stats: públicos de lectura
-- (leaderboards y perfiles públicos), sin PII — mismo criterio que `scores_public_read`. Nunca se
-- escriben desde el cliente, solo desde `apply_pvp_rating_change`/`finalize_pvp_match` (0020-0021).
create policy "pvp_ratings_read" on pvp_ratings for select using (true);
create policy "pvp_rating_history_read" on pvp_rating_history for select using (true);
create policy "pvp_player_stats_read" on pvp_player_stats for select using (true);
create policy "pvp_player_mode_stats_read" on pvp_player_mode_stats for select using (true);

-- pvp_queue: mismo patrón que game_sessions (0002) — cada uno ve la suya; las anónimas (`user_id`
-- null) quedan visibles como el resto de datos de invitado en este proyecto (protección
-- "best-effort" ya documentada, nada sensible se guarda aquí más que un alias). Sin
-- insert/update/delete directo: todo pasa por `enqueue_pvp_match`/`cancel_pvp_search` (0021).
create policy "pvp_queue_own_read" on pvp_queue for select
  using (user_id = auth.uid() or user_id is null or is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Realtime: el proyecto no usaba Supabase Realtime en ningún lado hasta este módulo. Solo se
-- habilita en las tablas SIN datos sensibles (nunca en pvp_match_game_results, que no tiene ni
-- policy de SELECT — ver arriba): el cliente escucha estos cambios para saber CUÁNDO refrescar el
-- estado completo vía `get_pvp_match_state` (security definer, aplica la regla anti-espionaje),
-- nunca reconstruye el estado a partir del payload de Realtime directamente.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table pvp_queue, pvp_matches, pvp_match_games, pvp_match_players;
