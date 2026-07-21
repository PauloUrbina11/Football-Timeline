-- Football Timeline — 0009: corrige dos bugs reales de cardinalidad en RPCs (Fase 3).
--
-- `RETURN QUERY` en PL/pgSQL NO termina la función (a diferencia de `RETURN` a secas): solo agrega
-- filas al resultado y sigue ejecutando lo que venga después. Ambas funciones tenían código después
-- de un `RETURN QUERY` sin un `RETURN;` explícito detrás, lo que producía más filas de las esperadas
-- (o, en el caso de `finish_session` con `p_abandon`, cero filas). El cliente llama a ambos RPCs con
-- `.single()`, que exige exactamente una fila — con 0 o 2+ filas falla con
-- "Cannot coerce the result to a single JSON object".
--
-- Detectado por un test e2e real: React vuelve a invocar el efecto que llama a
-- `submit_daily_result` en desarrollo (StrictMode), y la segunda llamada concurrente entraba
-- en la rama de "ya jugado" con el bug.

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
