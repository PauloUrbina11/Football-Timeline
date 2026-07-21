-- Football Timeline — 0005: RPCs de mutación del juego.
-- Todas usan `security definer` porque necesitan leer `timeline_events.correct_order`
-- (nadie puede leerlo directamente, ver policy en 0002) para verificar la respuesta o
-- calcular la puntuación, sin devolverlo jamás en su resultado.
--
-- `import_timeline_batch` queda como stub: su forma exacta depende del diseño del CSV (Fase 5).

-- ---------------------------------------------------------------------------
-- Lectura segura de las tarjetas de un timeline para jugar: sin `correct_order`, mezcladas.
-- ---------------------------------------------------------------------------
-- Deliberadamente SIN `description`: cualquier texto narrativo ("cambia de equipo dentro de la
-- misma liga...") puede filtrar pistas de orden relativo entre tarjetas aunque no mencione fechas.
-- Ver docs/architecture.md — el tablero de juego solo muestra el hecho puro (título).
create or replace function get_timeline_play_cards(p_timeline_id uuid)
returns table (
  event_id uuid,
  title text,
  display_date text,
  image_url text,
  metadata jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  select e.id, e.title, e.display_date, e.image_url, e.metadata
  from timeline_events te
  join events e on e.id = te.event_id
  join timelines t on t.id = te.timeline_id
  where te.timeline_id = p_timeline_id
    and t.status = 'published'
    and t.deleted_at is null
    and e.deleted_at is null
  order by random();
$$;

-- Fija total_events/difficulty desde el propio timeline al crear la sesión, para que un
-- cliente no pueda declarar un total_events distinto al real e inflar el techo de puntos.
create or replace function set_session_fields_from_timeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_difficulty text;
  v_total_events int;
  v_status text;
begin
  select t.difficulty, t.status, count(te.event_id)
    into v_difficulty, v_status, v_total_events
  from timelines t
  left join timeline_events te on te.timeline_id = t.id
  where t.id = new.timeline_id
  group by t.difficulty, t.status;

  if v_difficulty is null then
    raise exception 'Timeline % no existe', new.timeline_id;
  end if;

  if v_status <> 'published' and not is_admin(auth.uid()) then
    raise exception 'Timeline % no está publicado', new.timeline_id;
  end if;

  new.difficulty := v_difficulty;
  new.total_events := v_total_events;
  return new;
end;
$$;

create trigger trg_sessions_fields_from_timeline
  before insert on game_sessions
  for each row execute function set_session_fields_from_timeline();

-- ---------------------------------------------------------------------------
-- Fórmula de puntuación (debe coincidir con scoringConfigV1 en
-- src/features/game-engine/domain/scoring.ts — esa es la especificación ejecutable
-- vía sus tests; esta es la versión autoritativa que de verdad se persiste).
-- ---------------------------------------------------------------------------
create or replace function calculate_score_v1(
  p_total_events int,
  p_time_ms int,
  p_attempts int,
  p_first_try boolean,
  p_difficulty text
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

  v_max_base := p_total_events * v_base_per_event;
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

-- ---------------------------------------------------------------------------
-- submit_attempt: verifica un intento sin exponer nunca el orden correcto.
-- ---------------------------------------------------------------------------
create or replace function submit_attempt(p_session_id uuid, p_submitted_order uuid[])
returns table (correct_positions boolean[], correct_count int, is_fully_correct boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session game_sessions;
  v_correct_order uuid[];
  v_positions boolean[];
  v_correct_count int;
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

  if array_length(p_submitted_order, 1) <> v_session.total_events then
    raise exception 'El orden enviado no tiene % eventos', v_session.total_events;
  end if;

  select array_agg(event_id order by correct_order) into v_correct_order
  from timeline_events where timeline_id = v_session.timeline_id;

  select array_agg(p_submitted_order[i] = v_correct_order[i] order by i)
    into v_positions
  from generate_subscripts(p_submitted_order, 1) as i;

  v_correct_count := (select count(*) from unnest(v_positions) p where p);
  v_attempt_number := v_session.attempts_count + 1;

  insert into game_attempts (session_id, attempt_number, submitted_order, correct_positions, correct_count)
  values (p_session_id, v_attempt_number, p_submitted_order, v_positions, v_correct_count);

  update game_sessions
  set attempts_count = v_attempt_number,
      correct_count = v_correct_count,
      solved_on_first_attempt = (v_attempt_number = 1 and v_correct_count = total_events)
  where id = p_session_id;

  return query select v_positions, v_correct_count, v_correct_count = v_session.total_events;
end;
$$;

-- ---------------------------------------------------------------------------
-- finish_session: cierra la sesión (resuelta o abandonada) y persiste la puntuación.
-- ---------------------------------------------------------------------------
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
    -- `return next` (no `points`/`stars` asignados) para seguir devolviendo exactamente una fila:
    -- el cliente llama a este RPC con `.single()`, que falla si la respuesta tiene 0 filas.
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

-- ---------------------------------------------------------------------------
-- submit_daily_result: idempotente a nivel de DB (ver índices únicos parciales en 0004).
-- La UI de /daily (Fase 3) llama primero a finish_session y con su resultado invoca esta función.
-- ---------------------------------------------------------------------------
create or replace function submit_daily_result(p_session_id uuid)
returns table (share_code text, result_grid text, points int, stars smallint, already_played boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session game_sessions;
  v_score scores;
  v_last_attempt game_attempts;
  v_grid text;
  v_code text;
  v_inserted daily_results;
begin
  select * into v_session from game_sessions where id = p_session_id;

  if v_session is null or v_session.daily_challenge_id is null then
    raise exception 'La sesión % no corresponde a un daily challenge', p_session_id;
  end if;

  if v_session.user_id is not null and v_session.user_id <> auth.uid() then
    raise exception 'No autorizado para esta sesión';
  end if;

  if v_session.status <> 'completed' then
    raise exception 'La sesión % todavía no ha finalizado', p_session_id;
  end if;

  select * into v_score from scores where session_id = p_session_id;
  select * into v_last_attempt from game_attempts where session_id = p_session_id order by attempt_number desc limit 1;

  v_grid := (
    select string_agg(case when p then '🟩' else '⬜' end, '')
    from unnest(v_last_attempt.correct_positions) p
  );
  v_code := substr(md5(random()::text || clock_timestamp()::text), 1, 8);

  insert into daily_results (daily_challenge_id, user_id, anon_id, session_id, result_grid, points, stars, time_ms, attempts, share_code)
  values (v_session.daily_challenge_id, v_session.user_id, v_session.anon_id, p_session_id, v_grid, v_score.points, v_score.stars, v_session.duration_ms, v_session.attempts_count, v_code)
  on conflict do nothing
  returning * into v_inserted;

  if v_inserted is null then
    -- Ya existía un resultado para este (daily_challenge_id, user_id | anon_id): se devuelve el guardado.
    select * into v_inserted from daily_results
    where daily_challenge_id = v_session.daily_challenge_id
      and (user_id = v_session.user_id or anon_id = v_session.anon_id)
    limit 1;
    return query select v_inserted.share_code, v_inserted.result_grid, v_inserted.points, v_inserted.stars, true;
    return;
  end if;

  return query select v_inserted.share_code, v_inserted.result_grid, v_inserted.points, v_inserted.stars, false;
end;
$$;

-- ---------------------------------------------------------------------------
-- import_timeline_batch: pendiente de diseño de formato CSV (Fase 5, ver src/features/admin/domain/csv-import.ts).
-- ---------------------------------------------------------------------------
create or replace function import_timeline_batch(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'Solo un admin puede importar timelines';
  end if;
  raise exception 'import_timeline_batch todavía no está implementada (llega en la Fase 5)';
end;
$$;
