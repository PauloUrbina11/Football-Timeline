-- Football Timeline — 0014: Ballon d'Or Timeline deja de ser una lista de timelines curados a mano
-- y pasa a generar, en cada partida, una ventana de 4 ediciones CONSECUTIVAS elegidas al azar entre
-- TODO el historial real (1956-2025, ver ballon_dor_full_history.sql) — filtrando a propósito
-- cualquier ventana con un ganador repetido (produciría casilleros con el mismo nombre, ambiguos
-- para el jugador — el motivo por el que antes había que curar rangos a mano).
--
-- La dificultad ya no es un campo fijo elegido por el diseñador: se deriva de qué tan antigua es la
-- ventana (nombres más antiguos = menos reconocibles = más difícil), y se traduce en un multiplicador
-- de puntos (`timelines.metadata->>'difficulty_multiplier'`), no en la columna `difficulty` — esa
-- columna sigue atada a `event_count` (siempre 4 aquí, por eso siempre es "easy") por el trigger de
-- integridad de publicación; difficulty_multiplier es un eje independiente, de época, no de tamaño.

create or replace function generate_random_ballon_dor_window()
returns table (timeline_id uuid, slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_ids uuid[];
  v_subject_ids uuid[];
  v_editions int[];
  v_n int;
  v_start int;
  v_tries int := 0;
  v_max_tries constant int := 300;
  v_ok boolean := false;
  v_start_edition int;
  v_end_edition int;
  v_era text;
  v_multiplier numeric;
  v_slug text;
  v_title text;
  v_description text;
  v_new_timeline_id uuid;
  v_name_order uuid[];
  v_i int;
begin
  select array_agg(e.id order by (e.metadata->>'ballon_dor_edition')::int),
         array_agg(e.subject_id order by (e.metadata->>'ballon_dor_edition')::int),
         array_agg((e.metadata->>'ballon_dor_edition')::int order by (e.metadata->>'ballon_dor_edition')::int)
    into v_event_ids, v_subject_ids, v_editions
  from events e
  where e.metadata ? 'ballon_dor_edition' and e.deleted_at is null;

  v_n := coalesce(array_length(v_event_ids, 1), 0);
  if v_n < 4 then
    raise exception 'No hay suficiente historial de Balón de Oro cargado (% ediciones)', v_n;
  end if;

  loop
    v_tries := v_tries + 1;
    v_start := 1 + floor(random() * (v_n - 3))::int;
    v_ok := v_subject_ids[v_start] <> v_subject_ids[v_start + 1]
      and v_subject_ids[v_start] <> v_subject_ids[v_start + 2]
      and v_subject_ids[v_start] <> v_subject_ids[v_start + 3]
      and v_subject_ids[v_start + 1] <> v_subject_ids[v_start + 2]
      and v_subject_ids[v_start + 1] <> v_subject_ids[v_start + 3]
      and v_subject_ids[v_start + 2] <> v_subject_ids[v_start + 3];
    exit when v_ok or v_tries >= v_max_tries;
  end loop;

  if not v_ok then
    raise exception 'No se encontró una ventana de 4 ediciones con ganadores distintos tras % intentos', v_max_tries;
  end if;

  v_start_edition := v_editions[v_start];
  v_end_edition := v_editions[v_start + 3];

  v_era := case
    when v_start_edition < 1980 then 'clásica'
    when v_start_edition < 2000 then 'dorada'
    when v_start_edition < 2014 then 'moderna'
    else 'reciente'
  end;
  v_multiplier := case
    when v_start_edition < 1980 then 1.5
    when v_start_edition < 2000 then 1.3
    when v_start_edition < 2014 then 1.15
    else 1.0
  end;

  v_slug := 'ballon-dor-' || v_start_edition || '-' || v_end_edition || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
  v_title := 'Balón de Oro ' || v_start_edition || '-' || v_end_edition;
  v_description := 'Arrastra cada balón al jugador que ganó el Balón de Oro ese año. Época ' || v_era || '.';

  insert into timelines (mode_id, subject_id, difficulty, title, slug, description, status, is_daily_eligible, metadata, published_at)
  values (
    'ballon_dor', null, 'easy', v_title, v_slug, v_description, 'published', false,
    jsonb_build_object('era', v_era, 'difficulty_multiplier', v_multiplier, 'edition_start', v_start_edition, 'edition_end', v_end_edition),
    now()
  )
  returning id into v_new_timeline_id;

  -- correct_order = rango alfabético por nombre entre estos 4 jugadores (ver 0012, mismo criterio:
  -- nunca por edición/año, eso revelaría quién ganó antes que quién).
  select array_agg(ranked.event_id order by ranked.subject_name)
    into v_name_order
  from (
    select v_event_ids[v_start + offset_i] as event_id, s.name as subject_name
    from generate_series(0, 3) as offset_i
    join subjects s on s.id = v_subject_ids[v_start + offset_i]
  ) as ranked;

  for v_i in 1..4 loop
    insert into timeline_events (timeline_id, event_id, correct_order)
    values (v_new_timeline_id, v_name_order[v_i], v_i);
  end loop;

  return query select v_new_timeline_id, v_slug;
end;
$$;

-- ---------------------------------------------------------------------------
-- calculate_score_v1 gana un multiplicador de dificultad adicional, independiente del ya existente
-- por `difficulty` (que sigue reflejando el TAMAÑO de la lista). Por defecto 1.0: ningún timeline
-- existente cambia de puntuación. Solo Ballon d'Or Timeline lo usa por ahora, vía
-- `timelines.metadata->>'difficulty_multiplier'`, pero queda disponible para cualquier timeline
-- futuro que quiera una dificultad editorial independiente del número de eventos.
-- ---------------------------------------------------------------------------
create or replace function calculate_score_v1(
  p_total_events int,
  p_time_ms int,
  p_attempts int,
  p_first_try boolean,
  p_difficulty text,
  p_difficulty_multiplier numeric default 1.0
)
returns table (points int, stars smallint)
language plpgsql
immutable
as $$
declare
  v_base_per_event constant numeric := 100;
  v_attempt_penalty_rate constant numeric := 0.15;
  v_ideal_seconds_per_event constant numeric := 6;
  v_time_penalty_rate constant numeric := 0.10;
  v_time_penalty_cap constant numeric := 0.5;
  v_first_try_bonus_rate constant numeric := 0.20;
  v_difficulty_multiplier numeric;
  v_max_base numeric;
  v_attempt_penalty numeric;
  v_ideal_ms numeric;
  v_time_ratio numeric;
  v_time_penalty numeric;
  v_raw numeric;
  v_bonus numeric;
  v_points numeric;
  v_max_possible numeric;
  v_ratio numeric;
begin
  v_difficulty_multiplier := case p_difficulty
    when 'easy' then 1.0
    when 'medium' then 1.15
    when 'hard' then 1.3
    when 'expert' then 1.5
    else 1.0
  end;

  v_max_base := p_total_events * v_base_per_event * coalesce(p_difficulty_multiplier, 1.0);
  v_attempt_penalty := least(1, greatest(0, p_attempts - 1) * v_attempt_penalty_rate);

  v_ideal_ms := p_total_events * v_ideal_seconds_per_event * 1000;
  v_time_ratio := case when v_ideal_ms > 0 then least(3, p_time_ms::numeric / v_ideal_ms) else 1 end;
  v_time_penalty := least(v_time_penalty_cap, greatest(0, (v_time_ratio - 1) * v_time_penalty_rate));

  v_raw := v_max_base * v_difficulty_multiplier * (1 - v_attempt_penalty) * (1 - v_time_penalty);
  v_bonus := case when p_first_try then v_max_base * v_first_try_bonus_rate else 0 end;
  v_points := round(greatest(0, v_raw + v_bonus));

  v_max_possible := v_max_base * v_difficulty_multiplier * (1 + v_first_try_bonus_rate);
  v_ratio := case when v_max_possible > 0 then v_points / v_max_possible else 0 end;

  points := v_points::int;
  stars := case
    when v_ratio >= 0.90 then 5
    when v_ratio >= 0.75 then 4
    when v_ratio >= 0.55 then 3
    when v_ratio >= 0.35 then 2
    else 1
  end;
  return next;
end;
$$;

create or replace function finish_session(p_session_id uuid, p_abandon boolean default false)
returns table (points int, stars smallint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session game_sessions;
  v_duration_ms int;
  v_score record;
  v_multiplier numeric;
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

  select coalesce((t.metadata->>'difficulty_multiplier')::numeric, 1.0) into v_multiplier
  from timelines t where t.id = v_session.timeline_id;

  select * into v_score
  from calculate_score_v1(v_session.total_events, v_duration_ms, v_session.attempts_count, v_session.solved_on_first_attempt, v_session.difficulty, coalesce(v_multiplier, 1.0));

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
