-- Football Timeline — 0001: esquema base
-- Tablas de referencia (data-driven, no enums) + contenido + usuarios + sesiones/puntuación.
-- RLS y policies viven en 0002; datos de las tablas de referencia en 0003; daily challenge en 0004;
-- funciones RPC de mutación en 0005.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Utilidad compartida: mantiene `updated_at` al día en cualquier tabla que la use.
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tablas de referencia: son DATOS, no tipos/enums. Añadir un modo de juego,
-- una dificultad o un logro nuevo es un INSERT, nunca una migración de esquema.
-- ---------------------------------------------------------------------------

create table subject_types (
  id text primary key,
  label text not null
);

create table game_modes (
  id text primary key,
  name text not null,
  description text,
  icon text,
  sort_order smallint not null default 0,
  is_active boolean not null default true
);

create table difficulties (
  id text primary key,
  label text not null,
  event_count smallint not null check (event_count > 0),
  sort_order smallint not null default 0
);

create table achievements (
  id text primary key,
  title text not null,
  description text,
  icon text,
  criteria jsonb not null default '{}',
  sort_order smallint not null default 0,
  is_active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Contenido
-- ---------------------------------------------------------------------------

create table subjects (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null references subject_types(id),
  name text not null,
  slug text not null unique,
  metadata jsonb not null default '{}',
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_subjects_type on subjects(subject_type);
create index idx_subjects_name_trgm on subjects using gin (name gin_trgm_ops);

create trigger trg_subjects_updated_at
  before update on subjects
  for each row execute function set_updated_at();

create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date not null,
  date_precision text not null default 'day' check (date_precision in ('day', 'month', 'year')),
  display_date text,
  image_url text,
  subject_id uuid references subjects(id),
  metadata jsonb not null default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_events_subject on events(subject_id);
create index idx_events_date on events(event_date);
create index idx_events_deleted on events(deleted_at) where deleted_at is null;
create index idx_events_search on events using gin (to_tsvector('spanish', title || ' ' || coalesce(description, '')));

create trigger trg_events_updated_at
  before update on events
  for each row execute function set_updated_at();

create table timelines (
  id uuid primary key default gen_random_uuid(),
  mode_id text not null references game_modes(id),
  subject_id uuid references subjects(id),
  difficulty text not null references difficulties(id),
  title text not null,
  slug text not null unique,
  description text,
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_daily_eligible boolean not null default true,
  metadata jsonb not null default '{}',
  created_by uuid references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_timelines_mode on timelines(mode_id);
create index idx_timelines_status on timelines(status) where deleted_at is null;
create index idx_timelines_daily_eligible on timelines(is_daily_eligible) where status = 'published' and deleted_at is null;

create trigger trg_timelines_updated_at
  before update on timelines
  for each row execute function set_updated_at();

create table timeline_events (
  timeline_id uuid not null references timelines(id) on delete cascade,
  event_id uuid not null references events(id) on delete restrict,
  correct_order smallint not null check (correct_order > 0),
  primary key (timeline_id, event_id),
  unique (timeline_id, correct_order)
);

create index idx_timeline_events_event on timeline_events(event_id);

-- Evita publicar un timeline cuyo número de eventos no coincide con el de su dificultad.
create or replace function enforce_timeline_publish_integrity()
returns trigger
language plpgsql
as $$
declare
  v_count int;
  v_expected int;
begin
  if new.status = 'published' then
    select count(*) into v_count from timeline_events where timeline_id = new.id;
    select event_count into v_expected from difficulties where id = new.difficulty;

    if v_expected is null then
      raise exception 'Dificultad "%" no existe', new.difficulty;
    end if;

    if v_count <> v_expected then
      raise exception 'El timeline % no puede publicarse: tiene % eventos, se esperaban % para la dificultad "%"',
        new.id, v_count, v_expected, new.difficulty;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_timelines_publish_integrity
  before insert or update on timelines
  for each row
  when (new.status = 'published')
  execute function enforce_timeline_publish_integrity();

-- ---------------------------------------------------------------------------
-- Usuarios
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  locale text not null default 'es',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Sesiones de juego, intentos y puntuación — separados deliberadamente:
--   game_sessions = una partida; game_attempts = auditoría de cada "comprobar";
--   scores = agregado final 1:1 con la sesión, versionado por `scoring_version`.
-- ---------------------------------------------------------------------------

create table game_sessions (
  id uuid primary key default gen_random_uuid(),
  timeline_id uuid not null references timelines(id),
  user_id uuid references auth.users(id),
  anon_id uuid,
  daily_challenge_id uuid,
  difficulty text not null references difficulties(id),
  total_events smallint not null check (total_events > 0),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  attempts_count smallint not null default 0,
  correct_count smallint,
  solved_on_first_attempt boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms int,
  constraint game_sessions_owner_check check (user_id is not null or anon_id is not null)
);

create index idx_sessions_user on game_sessions(user_id);
create index idx_sessions_timeline on game_sessions(timeline_id);
create index idx_sessions_daily on game_sessions(daily_challenge_id);

create table game_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references game_sessions(id) on delete cascade,
  attempt_number smallint not null check (attempt_number > 0),
  submitted_order uuid[] not null,
  correct_positions boolean[] not null,
  correct_count smallint not null,
  created_at timestamptz not null default now(),
  unique (session_id, attempt_number)
);

create table scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references game_sessions(id) on delete cascade,
  user_id uuid references auth.users(id),
  timeline_id uuid not null references timelines(id),
  points int not null check (points >= 0),
  stars smallint not null check (stars between 1 and 5),
  time_ms int not null check (time_ms >= 0),
  attempts smallint not null check (attempts > 0),
  first_try boolean not null,
  scoring_version smallint not null default 1,
  created_at timestamptz not null default now()
);

create index idx_scores_leaderboard on scores(timeline_id, points desc);
create index idx_scores_user on scores(user_id);

-- ---------------------------------------------------------------------------
-- Streaks y logros de usuario
-- ---------------------------------------------------------------------------

create table user_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_played_date date,
  updated_at timestamptz not null default now()
);

create trigger trg_user_streaks_updated_at
  before update on user_streaks
  for each row execute function set_updated_at();

create table user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null references achievements(id),
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
