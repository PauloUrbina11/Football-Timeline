-- Football Timeline — 0018: extrae el núcleo de `finish_session` / `finish_guess_session` a
-- funciones "_internal" SIN el chequeo de propiedad (`v_session.user_id <> auth.uid()`).
--
-- Por qué es necesario para PvP (ver docs de arquitectura del módulo): cuando el tiempo de un
-- juego expira, el Match Engine (`advance_pvp_game`, 0021) necesita poder cerrar la sesión del
-- jugador que NO respondió a tiempo, aunque quien dispare la llamada sea el OTRO jugador (o nadie,
-- si ambos siguen conectados y su propio cliente lo hace por sí mismo). `security definer` cambia
-- el ROL con el que se ejecutan las consultas (bypass de RLS), pero NO cambia `auth.uid()` — sigue
-- siendo el JWT de quien hizo la llamada original, así que `finish_session` tal como estaba jamás
-- permitiría esto: seguiría comparando `auth.uid()` (el rival) contra `session.user_id` (el jugador
-- que expiró) y fallaría con "No autorizado".
--
-- La solución NO es duplicar la fórmula de puntuación ni la lógica de cierre: es extraer ese cuerpo
-- una sola vez a `finish_session_internal`/`finish_guess_session_internal` (sin chequeo de dueño) y
-- que `finish_session`/`finish_guess_session` (las RPCs públicas de siempre, que NO cambian su
-- comportamiento ni firma) sigan haciendo su chequeo de propiedad y luego deleguen. `advance_pvp_game`
-- usa su PROPIA autorización — server-verificada contra `pvp_match_games.ends_at`, nunca contra lo
-- que un cliente afirme — para invocar la versión "_internal" directamente.
--
-- Las funciones "_internal" se revocan explícitamente de `anon`/`authenticated`: a diferencia de
-- todo el resto de RPCs de este proyecto, estas SÍ omiten el chequeo de dueño a propósito, así que
-- llamarlas directo desde un cliente permitiría forzar el cierre de la sesión de cualquiera. Solo
-- pueden invocarse desde otra función `security definer` (que corre con los privilegios de su
-- dueño, no del rol que hizo la petición original).

create or replace function finish_session_internal(p_session_id uuid, p_abandon boolean default false)
returns table (points int, stars smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session game_sessions;
  v_duration_ms int;
  v_score record;
begin
  select * into v_session from game_sessions where id = p_session_id for update;

  if v_session is null then
    raise exception 'Sesión % no existe', p_session_id;
  end if;

  if v_session.status <> 'in_progress' then
    raise exception 'La sesión % ya ha finalizado', p_session_id;
  end if;

  v_duration_ms := greatest(0, extract(epoch from (now() - v_session.started_at)) * 1000)::int;

  if p_abandon then
    update game_sessions set status = 'abandoned', finished_at = now(), duration_ms = v_duration_ms
    where id = p_session_id;
    return next;
    return;
  end if;

  if v_session.correct_count is distinct from v_session.total_events then
    raise exception 'La sesión % no está resuelta correctamente todavía', p_session_id;
  end if;

  select * into v_score
  from calculate_score_v1(v_session.total_events, v_duration_ms, v_session.attempts_count, v_session.solved_on_first_attempt, v_session.difficulty);

  update game_sessions
  set status = 'completed', finished_at = now(), duration_ms = v_duration_ms
  where id = p_session_id;

  insert into scores (session_id, user_id, timeline_id, points, stars, time_ms, attempts, first_try, scoring_version)
  values (p_session_id, v_session.user_id, v_session.timeline_id, v_score.points, v_score.stars, v_duration_ms, v_session.attempts_count, v_session.solved_on_first_attempt, 1);

  points := v_score.points;
  stars := v_score.stars;
  return next;
end;
$$;

revoke all on function finish_session_internal(uuid, boolean) from public, anon, authenticated;

create or replace function finish_session(p_session_id uuid, p_abandon boolean default false)
returns table (points int, stars smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session game_sessions;
begin
  select * into v_session from game_sessions where id = p_session_id;

  if v_session is null then
    raise exception 'Sesión % no existe', p_session_id;
  end if;

  if v_session.user_id is not null and v_session.user_id <> auth.uid() and not is_admin(auth.uid()) then
    raise exception 'No autorizado para esta sesión';
  end if;

  return query select * from finish_session_internal(p_session_id, p_abandon);
end;
$$;

-- ---------------------------------------------------------------------------
-- Mismo tratamiento para el modo "guess".
-- ---------------------------------------------------------------------------

create or replace function finish_guess_session_internal(p_session_id uuid, p_abandon boolean default false)
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

revoke all on function finish_guess_session_internal(uuid, boolean) from public, anon, authenticated;

create or replace function finish_guess_session(p_session_id uuid, p_abandon boolean default false)
returns table (points int, stars smallint, actual_value_eur bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session game_sessions;
begin
  select * into v_session from game_sessions where id = p_session_id;

  if v_session is null then
    raise exception 'Sesión % no existe', p_session_id;
  end if;

  if v_session.user_id is not null and v_session.user_id <> auth.uid() and not is_admin(auth.uid()) then
    raise exception 'No autorizado para esta sesión';
  end if;

  return query select * from finish_guess_session_internal(p_session_id, p_abandon);
end;
$$;
