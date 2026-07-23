-- Football Timeline — 0028: get_pvp_match_state ahora incluye el título y la descripción reales
-- del timeline de cada juego ("la pregunta"/contexto). El juego individual y el Daily Challenge
-- siempre muestran esto (ver PlayTimelineClient/DailyChallengeClient) — el PvP montaba el board
-- correspondiente pero nunca mostraba ese contexto, dejando el tablero "sin pregunta". Resto de la
-- función sin cambios.

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
    'title', tl.title,
    'description', tl.description,
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
  join timelines tl on tl.id = g.timeline_id
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
