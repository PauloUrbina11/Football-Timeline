-- Football Timeline — 0023: corrige un bug real de `try_match_players` (0021) que rompía TODO
-- emparejamiento en cuanto había 2 jugadores esperando a la vez.
--
-- Causa: la función declara `returns table (match_id uuid)` — es decir, `match_id` es también el
-- nombre de su propio parámetro de salida (una variable PL/pgSQL), que choca con la columna
-- `pvp_match_games.match_id` en la única línea donde se usaba sin calificar
-- (`where match_id = v_match_id`). Postgres no puede decidir si "match_id" ahí es la variable o la
-- columna, y aborta con el error 42702 "column reference match_id is ambiguous" — reproducido
-- directamente contra la base real: con un solo jugador en la cola nunca se llega a esa línea (se
-- corta antes por falta de rival), así que el bug solo aparecía justo al emparejar a dos personas,
-- que es exactamente lo que reportó el usuario.
--
-- Fix: calificar la columna con el nombre de la tabla. De paso, se reinicia `v_timeline_id` al
-- principio de cada vuelta del bucle de selección de modos — sin eso, si algún día un modo se
-- queda sin timelines publicados, la vuelta siguiente podía reutilizar por error el
-- `timeline_id` de la vuelta anterior en lugar de fallar con el mensaje claro que ya existe.

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

    insert into pvp_match_games (match_id, game_index, mode_id, timeline_id, status)
    values (v_match_id, v_game_index, v_chosen_mode, v_timeline_id, case when v_game_index = 0 then 'active' else 'pending' end);
  end loop;

  -- Fix: calificado con el nombre de tabla (antes: `where match_id = v_match_id`, ambiguo con el
  -- parámetro de salida `match_id` de esta misma función).
  update pvp_match_games
  set started_at = now(), ends_at = now() + (v_time_limit * interval '1 second')
  where pvp_match_games.match_id = v_match_id and game_index = 0;

  update pvp_matches set status = 'in_progress', started_at = now() where id = v_match_id;

  match_id := v_match_id;
  return next;
end;
$$;
