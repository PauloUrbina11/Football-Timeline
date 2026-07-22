-- Football Timeline — 0013: modo "guess" (adivinar un valor numérico con pistas de "más alto" /
-- "más bajo", ej. el valor de un fichaje en euros). Nuevo ModeInteraction, distinto de "sort" y
-- "match": aquí no hay una lista de eventos que ordenar ni un pool de elementos que emparejar —
-- es un único reto con un valor numérico secreto, y el jugador itera hasta acertarlo.
--
-- Reutiliza game_sessions/scores sin cambios (total_events=1 vía la nueva dificultad "single",
-- attempts_count = número de intentos de adivinar). NO reutiliza game_attempts (su forma asume
-- un array de posiciones de una lista, no aplica a un único valor numérico) — se añade
-- `guess_attempts`, análoga pero para este modo.

insert into difficulties (id, label, event_count, sort_order)
select 'single', 'Único', 1, 5
where not exists (select 1 from difficulties where id = 'single');

-- ---------------------------------------------------------------------------
-- El valor secreto NUNCA vive en `events.metadata`: esa columna es de lectura pública
-- (policy "events_public_read"), así que cualquiera podría consultarlo directo vía la API de
-- Supabase sin jugar. Se guarda en una tabla aparte, solo accesible por admin/RPCs con
-- `security definer` — mismo criterio que ya protege `timeline_events.correct_order`.
-- ---------------------------------------------------------------------------
create table event_secret_values (
  event_id uuid primary key references events(id) on delete cascade,
  value_eur bigint not null check (value_eur >= 0)
);

alter table event_secret_values enable row level security;
create policy "event_secret_values_admin_all" on event_secret_values for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create table guess_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references game_sessions(id) on delete cascade,
  attempt_number smallint not null check (attempt_number > 0),
  guess_value_eur bigint not null check (guess_value_eur >= 0),
  result text not null check (result in ('higher', 'lower', 'correct')),
  created_at timestamptz not null default now(),
  unique (session_id, attempt_number)
);

alter table guess_attempts enable row level security;
create policy "guess_attempts_own_read" on guess_attempts for select
  using (exists (
    select 1 from game_sessions s
    where s.id = session_id and (s.user_id = auth.uid() or s.user_id is null or is_admin(auth.uid()))
  ));

-- ---------------------------------------------------------------------------
-- get_guess_target: solo el event_id (para poder llamar a check_guess_attempt); nunca el valor.
-- ---------------------------------------------------------------------------
create or replace function get_guess_target(p_timeline_id uuid)
returns table (event_id uuid)
language sql
security definer
stable
set search_path = public
as $$
  select e.id
  from timeline_events te
  join events e on e.id = te.event_id
  join timelines t on t.id = te.timeline_id
  where te.timeline_id = p_timeline_id
    and t.status = 'published'
    and t.deleted_at is null
    and e.deleted_at is null
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- check_guess_attempt: compara el intento contra el valor real (nunca lo devuelve, salvo que
-- el intento sea exacto). Mismas guardas que submit_attempt (sesión propia, en curso, tope de
-- intentos) pero sobre guess_attempts en vez de game_attempts.
-- ---------------------------------------------------------------------------
create or replace function check_guess_attempt(p_session_id uuid, p_guess_eur bigint)
returns table (result text, attempt_number int, is_correct boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session game_sessions;
  v_event_id uuid;
  v_real_value bigint;
  v_result text;
  v_attempt_number int;
  v_max_attempts constant int := 10;
begin
  select * into v_session from game_sessions where id = p_session_id for update;

  if v_session is null then
    raise exception 'Sesión % no existe', p_session_id;
  end if;

  if v_session.user_id is not null and v_session.user_id <> auth.uid() and not is_admin(auth.uid()) then
    raise exception 'No autorizado para esta sesión';
  end if;

  if v_session.status <> 'in_progress' then
    raise exception 'La sesión % ya ha finalizado', p_session_id;
  end if;

  if v_session.attempts_count >= v_max_attempts then
    raise exception 'Se alcanzó el número máximo de intentos (%) para esta sesión', v_max_attempts;
  end if;

  if p_guess_eur < 0 then
    raise exception 'El valor debe ser mayor o igual a cero';
  end if;

  select te.event_id into v_event_id
  from timeline_events te where te.timeline_id = v_session.timeline_id limit 1;

  select value_eur into v_real_value from event_secret_values where event_id = v_event_id;

  if v_real_value is null then
    raise exception 'Este timeline no tiene un valor configurado';
  end if;

  v_result := case
    when p_guess_eur = v_real_value then 'correct'
    when p_guess_eur < v_real_value then 'higher'
    else 'lower'
  end;
  v_attempt_number := v_session.attempts_count + 1;

  insert into guess_attempts (session_id, attempt_number, guess_value_eur, result)
  values (p_session_id, v_attempt_number, p_guess_eur, v_result);

  update game_sessions
  set attempts_count = v_attempt_number,
      correct_count = case when v_result = 'correct' then 1 else 0 end,
      solved_on_first_attempt = (v_attempt_number = 1 and v_result = 'correct')
  where id = p_session_id;

  return query select v_result, v_attempt_number, v_result = 'correct';
end;
$$;

-- ---------------------------------------------------------------------------
-- finish_guess_session: mismo rol que finish_session, pero puntúa por número de intentos hasta
-- acertar (fórmula específica, ver src/features/game-engine/domain/guess-scoring.ts) y siempre
-- revela el valor real al terminar (acertado o abandonado) para el resumen final.
-- ---------------------------------------------------------------------------
create or replace function finish_guess_session(p_session_id uuid, p_abandon boolean default false)
returns table (points int, stars smallint, actual_value_eur bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session game_sessions;
  v_event_id uuid;
  v_real_value bigint;
  v_duration_ms int;
  v_attempt_penalty_rate constant numeric := 0.12;
  v_ideal_attempts constant numeric := 6;
  v_base_points constant numeric := 600;
  v_time_penalty_rate constant numeric := 0.08;
  v_time_penalty_cap constant numeric := 0.4;
  v_ideal_seconds constant numeric := 45;
  v_first_try_bonus_rate constant numeric := 0.5;
  v_attempt_penalty numeric;
  v_time_ratio numeric;
  v_time_penalty numeric;
  v_raw numeric;
  v_bonus numeric;
  v_points numeric;
  v_max_possible numeric;
  v_ratio numeric;
  v_stars smallint;
begin
  select * into v_session from game_sessions where id = p_session_id for update;

  if v_session is null then
    raise exception 'Sesión % no existe', p_session_id;
  end if;

  if v_session.user_id is not null and v_session.user_id <> auth.uid() and not is_admin(auth.uid()) then
    raise exception 'No autorizado para esta sesión';
  end if;

  if v_session.status <> 'in_progress' then
    raise exception 'La sesión % ya ha finalizado', p_session_id;
  end if;

  select te.event_id into v_event_id
  from timeline_events te where te.timeline_id = v_session.timeline_id limit 1;
  select value_eur into v_real_value from event_secret_values where event_id = v_event_id;

  v_duration_ms := greatest(0, extract(epoch from (now() - v_session.started_at)) * 1000)::int;

  if p_abandon then
    update game_sessions set status = 'abandoned', finished_at = now(), duration_ms = v_duration_ms
    where id = p_session_id;
    actual_value_eur := v_real_value;
    return next;
    return;
  end if;

  if v_session.correct_count is distinct from 1 then
    raise exception 'La sesión % no está resuelta correctamente todavía', p_session_id;
  end if;

  v_attempt_penalty := least(1, greatest(0, v_session.attempts_count - 1) * v_attempt_penalty_rate);

  v_time_ratio := least(3, v_duration_ms::numeric / (v_ideal_seconds * 1000));
  v_time_penalty := least(v_time_penalty_cap, greatest(0, (v_time_ratio - 1) * v_time_penalty_rate));

  v_raw := v_base_points * (1 - v_attempt_penalty) * (1 - v_time_penalty);
  v_bonus := case when v_session.solved_on_first_attempt then v_base_points * v_first_try_bonus_rate else 0 end;
  v_points := round(greatest(0, v_raw + v_bonus));

  v_max_possible := v_base_points * (1 + v_first_try_bonus_rate);
  v_ratio := case when v_max_possible > 0 then v_points / v_max_possible else 0 end;

  v_stars := case
    when v_ratio >= 0.90 then 5
    when v_ratio >= 0.75 then 4
    when v_ratio >= 0.55 then 3
    when v_ratio >= 0.35 then 2
    else 1
  end;

  update game_sessions
  set status = 'completed', finished_at = now(), duration_ms = v_duration_ms
  where id = p_session_id;

  insert into scores (session_id, user_id, timeline_id, points, stars, time_ms, attempts, first_try, scoring_version)
  values (p_session_id, v_session.user_id, v_session.timeline_id, v_points::int, v_stars, v_duration_ms, v_session.attempts_count, v_session.solved_on_first_attempt, 1);

  points := v_points::int;
  stars := v_stars;
  actual_value_eur := v_real_value;
  return next;
end;
$$;
