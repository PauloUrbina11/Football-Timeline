-- Football Timeline — 0004: daily challenge.
-- Idempotencia garantizada a nivel de DB (no solo UX) vía los índices únicos parciales de abajo.

create table daily_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge_date date not null unique,
  timeline_id uuid not null references timelines(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table game_sessions
  add constraint game_sessions_daily_challenge_fk
  foreign key (daily_challenge_id) references daily_challenges(id);

create table daily_results (
  id uuid primary key default gen_random_uuid(),
  daily_challenge_id uuid not null references daily_challenges(id),
  user_id uuid references auth.users(id),
  anon_id uuid,
  session_id uuid not null unique references game_sessions(id),
  result_grid text not null,
  points int not null check (points >= 0),
  stars smallint not null check (stars between 1 and 5),
  time_ms int not null check (time_ms >= 0),
  attempts smallint not null check (attempts > 0),
  share_code text not null unique,
  created_at timestamptz not null default now(),
  constraint daily_results_owner_check check (user_id is not null or anon_id is not null)
);

-- Garantía real de "no se puede jugar dos veces": ni siquiera el RPC (0005) puede insertar
-- un segundo resultado para el mismo (daily_challenge_id, user_id | anon_id).
create unique index uq_daily_result_user on daily_results(daily_challenge_id, user_id) where user_id is not null;
create unique index uq_daily_result_anon on daily_results(daily_challenge_id, anon_id) where anon_id is not null;

alter table daily_challenges enable row level security;
alter table daily_results enable row level security;

-- No expone retos con fecha futura (evita espóilers del timeline de mañana).
create policy "daily_challenges_public_read" on daily_challenges
  for select using (challenge_date <= (now() at time zone 'utc')::date);
create policy "daily_challenges_admin_all" on daily_challenges
  for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- Cada uno ve solo su propio resultado (o el anónimo sin user_id, mismo motivo que en game_sessions
-- — ver 0002); el resumen público para compartir usa la vista de abajo.
create policy "daily_results_own_read" on daily_results
  for select using (user_id = auth.uid() or user_id is null or is_admin(auth.uid()));

-- Vista pública sin user_id/anon_id, para la página /s/[code].
create view shared_results_public as
  select share_code, result_grid, points, stars, time_ms, attempts, created_at
  from daily_results;
