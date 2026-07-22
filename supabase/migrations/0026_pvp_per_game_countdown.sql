-- Football Timeline — 0026: cuenta regresiva visible por juego, con el máximo dependiendo de la
-- dificultad real del timeline elegido (antes era un único valor fijo de 60s para los 3 juegos del
-- duelo, tomado de `pvp_matches.time_limit_seconds`). Si el tiempo se agota, el jugador que no
-- terminó sigue recibiendo 0 puntos en ese juego — ese comportamiento ya existía (vía
-- `finish_session_internal(p_abandon=true)`, que nunca inserta en `scores`) y no cambia aquí.

alter table pvp_match_games add column time_limit_seconds int not null default 60;

-- ---------------------------------------------------------------------------
-- create_pvp_match_for_pair: ahora calcula el plazo de CADA juego según la dificultad real del
-- timeline elegido (evento_count vía la tabla `difficulties`), en vez de un valor fijo por match.
-- ---------------------------------------------------------------------------
create or replace function create_pvp_match_for_pair(p_row1 pvp_queue, p_row2 pvp_queue)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
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
  v_timeline_difficulty text;
  v_game_time_limit int;
  v_first_game_time_limit int;
begin
  select id into v_season_id from pvp_seasons where is_current;
  v_is_official := p_row1.user_id is not null and p_row2.user_id is not null;

  insert into pvp_matches (status, is_official, season_id)
  values ('countdown', v_is_official, v_season_id)
  returning id into v_match_id;

  insert into pvp_match_players (match_id, seat, user_id, anon_id, guest_alias)
  values (v_match_id, 1, p_row1.user_id, p_row1.anon_id, p_row1.guest_alias);
  insert into pvp_match_players (match_id, seat, user_id, anon_id, guest_alias)
  values (v_match_id, 2, p_row2.user_id, p_row2.anon_id, p_row2.guest_alias);

  update pvp_queue set status = 'matched', matched_match_id = v_match_id where id in (p_row1.id, p_row2.id);

  select array_agg(id) into v_mode_ids from game_modes where is_active and pvp_enabled;
  if v_mode_ids is null or array_length(v_mode_ids, 1) < 3 then
    raise exception 'No hay suficientes modos habilitados para PvP (se necesitan al menos 3)';
  end if;
  v_remaining_ids := v_mode_ids;

  for v_game_index in 0..2 loop
    v_timeline_id := null;

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

    select difficulty into v_timeline_difficulty from timelines where id = v_timeline_id;
    v_game_time_limit := case v_timeline_difficulty
      when 'easy' then 45
      when 'medium' then 60
      when 'hard' then 75
      when 'expert' then 90
      when 'single' then 60
      else 60
    end;
    if v_game_index = 0 then
      v_first_game_time_limit := v_game_time_limit;
    end if;

    insert into pvp_match_games (match_id, game_index, mode_id, timeline_id, status, time_limit_seconds)
    values (v_match_id, v_game_index, v_chosen_mode, v_timeline_id, case when v_game_index = 0 then 'active' else 'pending' end, v_game_time_limit);
  end loop;

  update pvp_match_games
  set started_at = now(), ends_at = now() + (v_first_game_time_limit * interval '1 second')
  where pvp_match_games.match_id = v_match_id and game_index = 0;

  update pvp_matches set status = 'in_progress', started_at = now() where id = v_match_id;

  return v_match_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_pvp_match_state: expone el plazo real de cada juego (ya no es un único valor de partida)
-- para que el cliente pueda pintar la cuenta regresiva. Resto de la función sin cambios.
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
    'timeLimitSeconds', g.time_limit_seconds,
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
-- advance_pvp_game: al activar el siguiente juego, usa SU PROPIO time_limit_seconds (ya calculado
-- por dificultad al crear el match) en vez del valor único que traía `pvp_matches`.
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
  v_next_game pvp_match_games;
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
          select v_game.id, v_player.id, gs.id, coalesce(sc.points, 0), coalesce(sc.stars, 1), coalesce(gs.duration_ms, v_game.time_limit_seconds * 1000)
          from game_sessions gs
          left join scores sc on sc.session_id = gs.id
          where gs.id = v_session.id
          on conflict (match_game_id, match_player_id) do nothing;
        else
          insert into pvp_match_game_results (match_game_id, match_player_id, session_id, points, stars, time_ms)
          values (v_game.id, v_player.id, null, 0, 1, v_game.time_limit_seconds * 1000)
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
      select * into v_next_game from pvp_match_games where match_id = p_match_id and game_index = p_game_index + 1;
      update pvp_match_games
      set status = 'active', started_at = now(), ends_at = now() + (v_next_game.time_limit_seconds * interval '1 second')
      where id = v_next_game.id;
      update pvp_matches set current_game_index = p_game_index + 1 where id = p_match_id;
    end if;
  end if;

  return get_pvp_match_state(p_match_id, p_anon_id);
end;
$$;
