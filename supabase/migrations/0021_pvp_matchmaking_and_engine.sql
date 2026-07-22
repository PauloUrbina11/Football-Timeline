-- Football Timeline — 0021: Match Engine del módulo PvP (matchmaking + sincronización de los 3
-- juegos de un duelo). Ninguna de estas funciones implementa reglas/puntuación de ningún modo de
-- juego: solo orquestan qué RPCs/tablas ya existentes usar. Ver el plan de arquitectura del módulo
-- para el detalle de cada problema de concurrencia resuelto aquí.

-- ---------------------------------------------------------------------------
-- try_match_players: empareja hasta 2 jugadores en espera. `for update skip locked` evita que dos
-- llamadas concurrentes tomen la misma fila (ver "doble emparejamiento" en el plan). Elige 3 modos
-- distintos (ponderados por pvp_weight, sin reemplazo, excluyendo pvp_enabled=false) y, para cada
-- uno, reutiliza exactamente la misma selección de contenido que ya usa el juego individual:
-- `generate_random_ballon_dor_window()` para Ballon d'Or, o un timeline publicado al azar para el
-- resto — cero lógica nueva de selección de contenido.
-- ---------------------------------------------------------------------------
create or replace function try_match_players()
returns table (match_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row1 pvp_queue;
  v_row2 pvp_queue;
  v_match_id uuid;
  v_season_id uuid;
  v_is_official boolean;
  v_mode_ids text[];
  v_remaining_ids text[];
  v_mode_row record;
  v_total_weight numeric;
  v_pick numeric;
  v_running numeric;
  v_chosen_mode text;
  v_game_index smallint;
  v_timeline_id uuid;
  v_time_limit int;
begin
  select id into v_season_id from pvp_seasons where is_current;

  select * into v_row1 from pvp_queue where status = 'waiting'
    order by queued_at for update skip locked limit 1;
  if v_row1 is null then
    return;
  end if;

  select * into v_row2 from pvp_queue where status = 'waiting' and id <> v_row1.id
    order by queued_at for update skip locked limit 1;
  if v_row2 is null then
    return;
  end if;

  v_is_official := v_row1.user_id is not null and v_row2.user_id is not null;

  insert into pvp_matches (status, is_official, season_id)
  values ('countdown', v_is_official, v_season_id)
  returning id, time_limit_seconds into v_match_id, v_time_limit;

  insert into pvp_match_players (match_id, seat, user_id, anon_id, guest_alias)
  values (v_match_id, 1, v_row1.user_id, v_row1.anon_id, v_row1.guest_alias);
  insert into pvp_match_players (match_id, seat, user_id, anon_id, guest_alias)
  values (v_match_id, 2, v_row2.user_id, v_row2.anon_id, v_row2.guest_alias);

  update pvp_queue set status = 'matched', matched_match_id = v_match_id where id in (v_row1.id, v_row2.id);

  select array_agg(id) into v_mode_ids from game_modes where is_active and pvp_enabled;
  if v_mode_ids is null or array_length(v_mode_ids, 1) < 3 then
    raise exception 'No hay suficientes modos habilitados para PvP (se necesitan al menos 3)';
  end if;
  v_remaining_ids := v_mode_ids;

  for v_game_index in 0..2 loop
    select coalesce(sum(pvp_weight), 0) into v_total_weight
    from game_modes where id = any(v_remaining_ids);

    v_pick := random() * v_total_weight;
    v_running := 0;
    v_chosen_mode := null;

    for v_mode_row in select id, pvp_weight from game_modes where id = any(v_remaining_ids) order by id loop
      v_running := v_running + v_mode_row.pvp_weight;
      if v_chosen_mode is null and v_pick <= v_running then
        v_chosen_mode := v_mode_row.id;
      end if;
    end loop;
    v_chosen_mode := coalesce(v_chosen_mode, v_remaining_ids[1]);
    v_remaining_ids := array_remove(v_remaining_ids, v_chosen_mode);

    if v_chosen_mode = 'ballon_dor' then
      select bw.timeline_id into v_timeline_id from generate_random_ballon_dor_window() bw;
    else
      select id into v_timeline_id from timelines
      where mode_id = v_chosen_mode and status = 'published' and deleted_at is null
      order by random() limit 1;
    end if;

    if v_timeline_id is null then
      raise exception 'No hay timelines publicados para el modo %', v_chosen_mode;
    end if;

    insert into pvp_match_games (match_id, game_index, mode_id, timeline_id, status)
    values (v_match_id, v_game_index, v_chosen_mode, v_timeline_id, case when v_game_index = 0 then 'active' else 'pending' end);
  end loop;

  update pvp_match_games
  set started_at = now(), ends_at = now() + (v_time_limit * interval '1 second')
  where match_id = v_match_id and game_index = 0;

  update pvp_matches set status = 'in_progress', started_at = now() where id = v_match_id;

  match_id := v_match_id;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- enqueue_pvp_match: entra a la cola (o devuelve la fila propia ya existente, idempotente ante
-- doble clic) y trata de emparejar de inmediato drenando la cola (repite try_match_players
-- mientras siga encontrando pares, para no dejar a nadie esperando de más si ya hay suficiente
-- gente en cola).
-- ---------------------------------------------------------------------------
create or replace function enqueue_pvp_match(p_guest_alias text default null, p_anon_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_rating int;
  v_row pvp_queue;
begin
  if v_user_id is null and p_anon_id is null then
    raise exception 'Se requiere identidad de invitado o sesión iniciada';
  end if;
  if v_user_id is null and (p_guest_alias is null or length(trim(p_guest_alias)) = 0) then
    raise exception 'Los invitados deben indicar un alias';
  end if;

  select * into v_row from pvp_queue
  where status = 'waiting'
    and ((v_user_id is not null and user_id = v_user_id) or (v_user_id is null and anon_id = p_anon_id));

  if v_row is null then
    v_rating := 1000;
    if v_user_id is not null then
      select current_rating into v_rating from pvp_ratings where user_id = v_user_id;
      v_rating := coalesce(v_rating, 1000);
    end if;

    insert into pvp_queue (user_id, anon_id, guest_alias, rating)
    values (v_user_id, case when v_user_id is null then p_anon_id else null end, p_guest_alias, v_rating)
    returning * into v_row;
  end if;

  loop
    perform try_match_players();
    exit when not found;
  end loop;

  select * into v_row from pvp_queue where id = v_row.id;

  if v_row.status = 'matched' then
    return jsonb_build_object('status', 'matched', 'matchId', v_row.matched_match_id);
  end if;

  return jsonb_build_object('status', 'waiting', 'queueId', v_row.id);
end;
$$;

create or replace function cancel_pvp_search(p_anon_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  delete from pvp_queue
  where status = 'waiting'
    and ((v_user_id is not null and user_id = v_user_id) or (v_user_id is null and anon_id = p_anon_id));
end;
$$;

-- Para reconexión: ¿participo en un match activo? (el estado de "esperando en cola" se lee
-- directo de `pvp_queue`, ya legible por RLS — ver 0019 — sin necesidad de una RPC aparte).
create or replace function get_my_active_pvp_match(p_anon_id uuid default null)
returns table (match_id uuid)
language sql
security definer
stable
set search_path = public
as $$
  select mp.match_id
  from pvp_match_players mp
  join pvp_matches m on m.id = mp.match_id
  where m.status in ('countdown', 'in_progress')
    and ((auth.uid() is not null and mp.user_id = auth.uid()) or (auth.uid() is null and mp.anon_id = p_anon_id))
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- get_pvp_match_state: única forma de leer el estado completo de un match (incluye resultados de
-- pvp_match_game_results, que no tiene policy de SELECT pública — ver 0019). Aplica la regla
-- anti-espionaje: `opponentResult` de un juego solo se incluye si mi propio resultado para ese
-- mismo juego ya existe.
-- ---------------------------------------------------------------------------
create or replace function get_pvp_match_state(p_match_id uuid, p_anon_id uuid default null)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_match pvp_matches;
  v_my_seat smallint;
  v_players jsonb;
  v_games jsonb;
begin
  select * into v_match from pvp_matches where id = p_match_id;
  if v_match is null then
    raise exception 'Partida % no existe', p_match_id;
  end if;

  select seat into v_my_seat from pvp_match_players
  where match_id = p_match_id
    and ((v_user_id is not null and user_id = v_user_id) or (v_user_id is null and anon_id = p_anon_id));

  if v_my_seat is null and not is_admin(v_user_id) then
    raise exception 'No participas en esta partida';
  end if;

  select jsonb_agg(jsonb_build_object(
    'matchPlayerId', mp.id,
    'seat', mp.seat,
    'isMe', mp.seat = v_my_seat,
    'displayName', coalesce(mp.guest_alias, p.username, p.display_name, 'Jugador'),
    'isGuest', mp.user_id is null,
    'ratingBefore', mp.rating_before,
    'ratingAfter', mp.rating_after,
    'ratingDelta', mp.rating_delta,
    'totalPoints', mp.total_points,
    'isConnected', mp.is_connected,
    'leftAt', mp.left_at
  ) order by mp.seat)
  into v_players
  from pvp_match_players mp
  left join profiles p on p.id = mp.user_id
  where mp.match_id = p_match_id;

  select jsonb_agg(jsonb_build_object(
    'id', g.id,
    'gameIndex', g.game_index,
    'modeId', g.mode_id,
    'timelineId', g.timeline_id,
    'status', g.status,
    'startedAt', g.started_at,
    'endsAt', g.ends_at,
    'myResult', (
      select jsonb_build_object('points', r.points, 'stars', r.stars, 'timeMs', r.time_ms)
      from pvp_match_game_results r
      join pvp_match_players mp on mp.id = r.match_player_id
      where r.match_game_id = g.id and mp.seat = v_my_seat
    ),
    'opponentResult', case
      when exists (
        select 1 from pvp_match_game_results r
        join pvp_match_players mp on mp.id = r.match_player_id
        where r.match_game_id = g.id and mp.seat = v_my_seat
      ) then (
        select jsonb_build_object('points', r.points, 'stars', r.stars, 'timeMs', r.time_ms)
        from pvp_match_game_results r
        join pvp_match_players mp on mp.id = r.match_player_id
        where r.match_game_id = g.id and mp.seat <> v_my_seat
      )
      else null
    end
  ) order by g.game_index)
  into v_games
  from pvp_match_games g
  where g.match_id = p_match_id;

  return jsonb_build_object(
    'id', v_match.id,
    'status', v_match.status,
    'isOfficial', v_match.is_official,
    'currentGameIndex', v_match.current_game_index,
    'totalGames', v_match.total_games,
    'timeLimitSeconds', v_match.time_limit_seconds,
    'winnerMatchPlayerId', v_match.winner_match_player_id,
    'mySeat', v_my_seat,
    'players', coalesce(v_players, '[]'::jsonb),
    'games', coalesce(v_games, '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- finalize_pvp_match: decide ganador/empate por suma de puntos, actualiza estadísticas siempre y
-- Rating solo si `is_official`. Interna — revocada de anon/authenticated (solo la llama
-- advance_pvp_game/leave_pvp_match; llamarla directo permitiría cerrar un match ajeno a mitad de
-- partida).
-- ---------------------------------------------------------------------------
create or replace function finalize_pvp_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match pvp_matches;
  v_p1 pvp_match_players;
  v_p2 pvp_match_players;
  v_winner_id uuid;
begin
  select * into v_match from pvp_matches where id = p_match_id for update;
  if v_match is null or v_match.status <> 'in_progress' then
    return;
  end if;

  select * into v_p1 from pvp_match_players where match_id = p_match_id and seat = 1;
  select * into v_p2 from pvp_match_players where match_id = p_match_id and seat = 2;

  v_winner_id := case
    when v_p1.total_points > v_p2.total_points then v_p1.id
    when v_p2.total_points > v_p1.total_points then v_p2.id
    else null
  end;

  update pvp_matches set status = 'completed', winner_match_player_id = v_winner_id, finished_at = now()
  where id = p_match_id;

  perform update_pvp_player_stats(p_match_id);
  if v_match.is_official then
    perform apply_pvp_rating_change(p_match_id);
  end if;
end;
$$;

revoke all on function finalize_pvp_match(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- advance_pvp_game: idempotente, invocable por cualquiera de los 2 participantes (o repetidamente
-- por el mismo cliente vía un `setTimeout` sincronizado a `ends_at`). Fuerza el cierre (0 puntos,
-- exactamente el mismo comportamiento que ya tiene `finish_session`/`finish_guess_session` al
-- abandonar — no se reimplementa nada) de cualquier jugador que no haya terminado cuando el plazo
-- YA expiró según el reloj del propio servidor. Cuando ambos tienen resultado, cierra el juego y
-- activa el siguiente o finaliza el match.
-- ---------------------------------------------------------------------------
create or replace function advance_pvp_game(p_match_id uuid, p_game_index smallint, p_anon_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_match pvp_matches;
  v_game pvp_match_games;
  v_my_seat smallint;
  v_player pvp_match_players;
  v_session game_sessions;
begin
  select * into v_match from pvp_matches where id = p_match_id for update;
  if v_match is null then
    raise exception 'Partida % no existe', p_match_id;
  end if;

  select seat into v_my_seat from pvp_match_players
  where match_id = p_match_id
    and ((v_user_id is not null and user_id = v_user_id) or (v_user_id is null and anon_id = p_anon_id));
  if v_my_seat is null then
    raise exception 'No participas en esta partida';
  end if;

  select * into v_game from pvp_match_games where match_id = p_match_id and game_index = p_game_index for update;

  if v_game is null or v_game.status <> 'active' or v_match.status <> 'in_progress' or v_match.current_game_index <> p_game_index then
    return get_pvp_match_state(p_match_id, p_anon_id);
  end if;

  if now() >= v_game.ends_at then
    for v_player in select * from pvp_match_players where match_id = p_match_id loop
      if not exists (select 1 from pvp_match_game_results r where r.match_game_id = v_game.id and r.match_player_id = v_player.id) then
        select * into v_session from game_sessions
        where pvp_match_game_id = v_game.id
          and ((v_player.user_id is not null and user_id = v_player.user_id) or (v_player.user_id is null and anon_id = v_player.anon_id))
        order by started_at desc limit 1;

        if v_session is not null and v_session.status = 'in_progress' then
          if v_game.mode_id = 'transfer' then
            perform finish_guess_session_internal(v_session.id, true);
          else
            perform finish_session_internal(v_session.id, true);
          end if;
        end if;

        if v_session is not null then
          insert into pvp_match_game_results (match_game_id, match_player_id, session_id, points, stars, time_ms)
          select v_game.id, v_player.id, gs.id, coalesce(sc.points, 0), coalesce(sc.stars, 1), coalesce(gs.duration_ms, v_match.time_limit_seconds * 1000)
          from game_sessions gs
          left join scores sc on sc.session_id = gs.id
          where gs.id = v_session.id
          on conflict (match_game_id, match_player_id) do nothing;
        else
          insert into pvp_match_game_results (match_game_id, match_player_id, session_id, points, stars, time_ms)
          values (v_game.id, v_player.id, null, 0, 1, v_match.time_limit_seconds * 1000)
          on conflict (match_game_id, match_player_id) do nothing;
        end if;
      end if;
    end loop;
  end if;

  if (select count(*) from pvp_match_game_results where match_game_id = v_game.id) >= 2 then
    update pvp_match_games set status = 'completed' where id = v_game.id;

    update pvp_match_players mp
    set total_points = mp.total_points + coalesce(
      (select r.points from pvp_match_game_results r where r.match_game_id = v_game.id and r.match_player_id = mp.id),
      0
    )
    where mp.match_id = p_match_id;

    if p_game_index + 1 >= v_match.total_games then
      perform finalize_pvp_match(p_match_id);
    else
      update pvp_match_games
      set status = 'active', started_at = now(), ends_at = now() + (v_match.time_limit_seconds * interval '1 second')
      where match_id = p_match_id and game_index = p_game_index + 1;
      update pvp_matches set current_game_index = p_game_index + 1 where id = p_match_id;
    end if;
  end if;

  return get_pvp_match_state(p_match_id, p_anon_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- report_pvp_game_result: se llama justo cuando `finishSession`/`finishGuessSession` (RPC del
-- propio modo, sin cambios) ya resolvió — solo COPIA lo que `scores` ya calculó, nunca recalcula.
-- ---------------------------------------------------------------------------
create or replace function report_pvp_game_result(p_session_id uuid, p_anon_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session game_sessions;
  v_score scores;
  v_game pvp_match_games;
  v_player pvp_match_players;
begin
  select * into v_session from game_sessions where id = p_session_id;
  if v_session is null or v_session.pvp_match_game_id is null then
    raise exception 'La sesión % no corresponde a un juego de PvP', p_session_id;
  end if;

  if v_session.user_id is not null and v_session.user_id <> v_user_id then
    raise exception 'No autorizado para esta sesión';
  end if;
  if v_session.user_id is null and (p_anon_id is null or v_session.anon_id <> p_anon_id) then
    raise exception 'No autorizado para esta sesión';
  end if;

  -- 'abandoned' incluido a propósito: rendirse en el modo "guess" (`giveUp`) cierra la sesión sin
  -- insertar en `scores` (mismo comportamiento que ya tenía `finish_guess_session` antes de este
  -- módulo) — cuenta como 0 puntos en este juego, no como un error.
  if v_session.status not in ('completed', 'abandoned') then
    raise exception 'La sesión % todavía no ha finalizado', p_session_id;
  end if;

  select * into v_score from scores where session_id = p_session_id;

  select * into v_game from pvp_match_games where id = v_session.pvp_match_game_id;

  select * into v_player from pvp_match_players
  where match_id = v_game.match_id
    and ((v_user_id is not null and user_id = v_user_id) or (v_user_id is null and anon_id = p_anon_id));
  if v_player is null then
    raise exception 'No participas en esta partida';
  end if;

  insert into pvp_match_game_results (match_game_id, match_player_id, session_id, points, stars, time_ms)
  values (v_game.id, v_player.id, v_session.id, coalesce(v_score.points, 0), coalesce(v_score.stars, 1), coalesce(v_session.duration_ms, 0))
  on conflict (match_game_id, match_player_id) do nothing;

  update pvp_match_players set last_seen_at = now(), is_connected = true where id = v_player.id;

  return advance_pvp_game(v_game.match_id, v_game.game_index, p_anon_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- leave_pvp_match: abandono voluntario. Oficial → Rating se aplica como derrota por abandono para
-- quien se va. Amistosa → solo termina la partida. Si el rival ya se había ido antes, se anula sin
-- ganador (regla explícita: "si ambos abandonan, la partida queda anulada").
-- ---------------------------------------------------------------------------
create or replace function leave_pvp_match(p_match_id uuid, p_anon_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_match pvp_matches;
  v_me pvp_match_players;
  v_opponent pvp_match_players;
begin
  select * into v_match from pvp_matches where id = p_match_id for update;
  if v_match is null then
    raise exception 'Partida % no existe', p_match_id;
  end if;
  if v_match.status not in ('countdown', 'in_progress') then
    return get_pvp_match_state(p_match_id, p_anon_id);
  end if;

  select * into v_me from pvp_match_players
  where match_id = p_match_id
    and ((v_user_id is not null and user_id = v_user_id) or (v_user_id is null and anon_id = p_anon_id));
  if v_me is null then
    raise exception 'No participas en esta partida';
  end if;

  update pvp_match_players set left_at = now(), is_connected = false where id = v_me.id;

  select * into v_opponent from pvp_match_players where match_id = p_match_id and id <> v_me.id;

  if v_opponent.left_at is not null then
    update pvp_matches set status = 'cancelled', finished_at = now() where id = p_match_id;
  else
    update pvp_matches set status = 'abandoned', winner_match_player_id = v_opponent.id, finished_at = now()
    where id = p_match_id;
    perform update_pvp_player_stats(p_match_id);
    if v_match.is_official then
      perform apply_pvp_rating_change(p_match_id);
    end if;
  end if;

  return get_pvp_match_state(p_match_id, p_anon_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- heartbeat: usado por el hook de presencia del cliente cada ~15s mientras hay un match activo.
-- ---------------------------------------------------------------------------
create or replace function pvp_heartbeat(p_match_id uuid, p_anon_id uuid default null)
returns void
language sql
security definer
set search_path = public
as $$
  update pvp_match_players
  set last_seen_at = now(), is_connected = true
  where match_id = p_match_id
    and ((auth.uid() is not null and user_id = auth.uid()) or (auth.uid() is null and anon_id = p_anon_id));
$$;
