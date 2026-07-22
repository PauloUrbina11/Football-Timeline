-- Football Timeline — 0020: Rating (ELO/MMR) y estadísticas PvP.
-- Se define ANTES del Match Engine (0021) para que `finalize_pvp_match` pueda llamarla sin
-- referencias hacia adelante entre migraciones.

-- ---------------------------------------------------------------------------
-- Fórmula ELO estándar — espejo exacto de calculateEloChange en
-- src/features/pvp/domain/elo.ts (esa es la especificación ejecutable vía sus tests; esta es la
-- versión autoritativa que de verdad se persiste, mismo patrón que calculate_score_v1 ↔ scoring.ts).
-- k=32 por defecto: NO es una cantidad fija de puntos, es el "learning rate" del propio algoritmo —
-- la cantidad real que sube/baja cada jugador depende de la diferencia de Rating entre ambos.
-- ---------------------------------------------------------------------------
create or replace function calculate_elo_delta(p_rating_a int, p_rating_b int, p_outcome_a numeric, p_k int default 32)
returns int
language sql
immutable
as $$
  select round(
    p_k * (p_outcome_a - (1.0 / (1.0 + power(10.0, (p_rating_b - p_rating_a)::numeric / 400.0))))
  )::int;
$$;

-- ---------------------------------------------------------------------------
-- apply_pvp_rating_change: solo se invoca para partidas OFICIALES (ambos jugadores registrados),
-- nunca para amistosas. Interna — revocada de anon/authenticated, solo la llama
-- `finalize_pvp_match` (0021) tras decidir ganador/empate.
-- ---------------------------------------------------------------------------
create or replace function apply_pvp_rating_change(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match pvp_matches;
  v_season_id uuid;
  v_p1 pvp_match_players;
  v_p2 pvp_match_players;
  v_rating1 int;
  v_rating2 int;
  v_outcome1 numeric;
  v_outcome2 numeric;
  v_delta1 int;
  v_delta2 int;
begin
  select * into v_match from pvp_matches where id = p_match_id for update;

  if v_match is null or not v_match.is_official then
    return;
  end if;

  select id from pvp_seasons where is_current into v_season_id;

  select * into v_p1 from pvp_match_players where match_id = p_match_id and seat = 1;
  select * into v_p2 from pvp_match_players where match_id = p_match_id and seat = 2;

  if v_p1.user_id is null or v_p2.user_id is null then
    raise exception 'Una partida oficial requiere que ambos jugadores estén autenticados';
  end if;

  insert into pvp_ratings (user_id, season_id) values (v_p1.user_id, v_season_id) on conflict (user_id) do nothing;
  insert into pvp_ratings (user_id, season_id) values (v_p2.user_id, v_season_id) on conflict (user_id) do nothing;

  select current_rating into v_rating1 from pvp_ratings where user_id = v_p1.user_id for update;
  select current_rating into v_rating2 from pvp_ratings where user_id = v_p2.user_id for update;

  v_outcome1 := case
    when v_match.winner_match_player_id is null then 0.5
    when v_match.winner_match_player_id = v_p1.id then 1
    else 0
  end;
  v_outcome2 := 1 - v_outcome1;

  v_delta1 := calculate_elo_delta(v_rating1, v_rating2, v_outcome1);
  v_delta2 := -v_delta1;

  update pvp_ratings
  set current_rating = v_rating1 + v_delta1, peak_rating = greatest(peak_rating, v_rating1 + v_delta1)
  where user_id = v_p1.user_id;
  update pvp_ratings
  set current_rating = v_rating2 + v_delta2, peak_rating = greatest(peak_rating, v_rating2 + v_delta2)
  where user_id = v_p2.user_id;

  insert into pvp_rating_history (user_id, match_id, season_id, rating_before, rating_after, delta)
  values
    (v_p1.user_id, p_match_id, v_season_id, v_rating1, v_rating1 + v_delta1, v_delta1),
    (v_p2.user_id, p_match_id, v_season_id, v_rating2, v_rating2 + v_delta2, v_delta2);

  update pvp_match_players set rating_before = v_rating1, rating_after = v_rating1 + v_delta1, rating_delta = v_delta1
  where id = v_p1.id;
  update pvp_match_players set rating_before = v_rating2, rating_after = v_rating2 + v_delta2, rating_delta = v_delta2
  where id = v_p2.id;
end;
$$;

revoke all on function apply_pvp_rating_change(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- update_pvp_player_stats: acumula estadísticas de POR VIDA para cada usuario REGISTRADO
-- participante (los invitados no tienen fila en profiles, así que no se les puede llevar
-- estadística persistente — regla explícita del proyecto: el registro solo agrega persistencia).
-- Se actualiza para partidas oficiales Y amistosas (victorias/derrotas/racha/puntos/tiempo
-- reflejan el desempeño real jugado, aunque solo lo oficial mueva el Rating) — pero
-- `official_matches`/`friendly_matches` quedan contados aparte para poder distinguirlas.
-- Interna — revocada de anon/authenticated, solo la llama `finalize_pvp_match` (0021).
-- ---------------------------------------------------------------------------
create or replace function update_pvp_player_stats(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match pvp_matches;
  v_player pvp_match_players;
  v_is_winner boolean;
  v_is_draw boolean;
  v_game record;
  v_mode_id text;
  v_points int;
  v_time_ms int;
begin
  select * into v_match from pvp_matches where id = p_match_id;
  if v_match is null then
    return;
  end if;
  v_is_draw := v_match.winner_match_player_id is null;

  for v_player in select * from pvp_match_players where match_id = p_match_id and user_id is not null loop
    v_is_winner := v_match.winner_match_player_id = v_player.id;

    insert into pvp_player_stats (user_id) values (v_player.user_id) on conflict (user_id) do nothing;

    update pvp_player_stats
    set
      matches_played = matches_played + 1,
      official_matches = official_matches + (case when v_match.is_official then 1 else 0 end),
      friendly_matches = friendly_matches + (case when v_match.is_official then 0 else 1 end),
      wins = wins + (case when not v_is_draw and v_is_winner then 1 else 0 end),
      losses = losses + (case when not v_is_draw and not v_is_winner then 1 else 0 end),
      draws = draws + (case when v_is_draw then 1 else 0 end),
      current_streak = case when not v_is_draw and v_is_winner then current_streak + 1 else 0 end,
      best_streak = greatest(best_streak, case when not v_is_draw and v_is_winner then current_streak + 1 else 0 end),
      total_points = total_points + v_player.total_points
    where user_id = v_player.user_id;

    for v_game in
      select mg.mode_id, r.points, r.time_ms
      from pvp_match_game_results r
      join pvp_match_games mg on mg.id = r.match_game_id
      where mg.match_id = p_match_id and r.match_player_id = v_player.id
    loop
      insert into pvp_player_mode_stats (user_id, mode_id, games_played, total_points)
      values (v_player.user_id, v_game.mode_id, 1, v_game.points)
      on conflict (user_id, mode_id) do update
        set games_played = pvp_player_mode_stats.games_played + 1,
            total_points = pvp_player_mode_stats.total_points + v_game.points;

      update pvp_player_stats set total_time_ms = total_time_ms + coalesce(v_game.time_ms, 0)
      where user_id = v_player.user_id;
    end loop;
  end loop;
end;
$$;

revoke all on function update_pvp_player_stats(uuid) from public, anon, authenticated;
