-- Football Timeline — 0007: corrige un bug real en submit_attempt (Fase 2).
--
-- La comparación de arrays vía doble `unnest(...) WITH ORDINALITY ... JOIN ... USING (idx)`
-- devolvía `correct_positions` NULL en algunos casos (violando el NOT NULL de game_attempts).
-- Se reemplaza por una comparación directa por índice con `generate_subscripts`, más simple y robusta.
--
-- CREATE OR REPLACE FUNCTION reemplaza la función existente sin necesidad de DROP (mismo nombre y firma).

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
