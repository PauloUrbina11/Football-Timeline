-- Football Timeline — 0024: salas privadas por código para PvP, alternativa a la búsqueda
-- aleatoria (FIFO) que ya existía. Reutiliza `pvp_queue` (columna nueva `room_code`) en vez de
-- crear una tabla aparte: una sala ES una fila de cola esperando, solo que identificada por un
-- código en vez de por orden de llegada — y el cliente ya sabe escuchar en tiempo real cuándo su
-- propia fila de `pvp_queue` pasa a "matched" (ver use-pvp-queue.ts), así que no hace falta ningún
-- mecanismo nuevo de esa parte.
--
-- Se extrae `create_pvp_match_for_pair` (todo lo que try_match_players ya hacía a partir de 2
-- filas de cola decididas) para que el emparejamiento FIFO y el de código comparta exactamente la
-- misma selección de modos/timelines — cero duplicación.

alter table pvp_queue add column room_code text;
create unique index uq_pvp_queue_room_code_waiting on pvp_queue(room_code) where status = 'waiting' and room_code is not null;

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
  v_time_limit int;
begin
  select id into v_season_id from pvp_seasons where is_current;
  v_is_official := p_row1.user_id is not null and p_row2.user_id is not null;

  insert into pvp_matches (status, is_official, season_id)
  values ('countdown', v_is_official, v_season_id)
  returning id, time_limit_seconds into v_match_id, v_time_limit;

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

    insert into pvp_match_games (match_id, game_index, mode_id, timeline_id, status)
    values (v_match_id, v_game_index, v_chosen_mode, v_timeline_id, case when v_game_index = 0 then 'active' else 'pending' end);
  end loop;

  update pvp_match_games
  set started_at = now(), ends_at = now() + (v_time_limit * interval '1 second')
  where pvp_match_games.match_id = v_match_id and game_index = 0;

  update pvp_matches set status = 'in_progress', started_at = now() where id = v_match_id;

  return v_match_id;
end;
$$;

revoke all on function create_pvp_match_for_pair(pvp_queue, pvp_queue) from public, anon, authenticated;

-- try_match_players ahora ignora las filas con `room_code` (esas solo se emparejan explícitamente
-- por join_pvp_room, nunca por FIFO al azar) y delega la creación del match a la función de arriba.
create or replace function try_match_players()
returns table (match_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row1 pvp_queue;
  v_row2 pvp_queue;
  v_new_match_id uuid;
begin
  select * into v_row1 from pvp_queue where status = 'waiting' and room_code is null
    order by queued_at for update skip locked limit 1;
  if v_row1 is null then
    return;
  end if;

  select * into v_row2 from pvp_queue where status = 'waiting' and room_code is null and id <> v_row1.id
    order by queued_at for update skip locked limit 1;
  if v_row2 is null then
    return;
  end if;

  v_new_match_id := create_pvp_match_for_pair(v_row1, v_row2);
  match_id := v_new_match_id;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_pvp_room: como enqueue_pvp_match, pero genera un código corto para compartir en vez de
-- entrar a la cola pública. Si ya estaba en la cola pública o en otra sala, se reemplaza (evita
-- que alguien quede esperando en dos lados a la vez).
-- ---------------------------------------------------------------------------
create or replace function create_pvp_room(p_guest_alias text default null, p_anon_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
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

  if v_row is not null and v_row.room_code is not null then
    return jsonb_build_object('status', 'waiting', 'queueId', v_row.id, 'roomCode', v_row.room_code);
  end if;
  if v_row is not null then
    delete from pvp_queue where id = v_row.id;
  end if;

  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from pvp_queue where room_code = v_code and status = 'waiting');
  end loop;

  insert into pvp_queue (user_id, anon_id, guest_alias, room_code)
  values (v_user_id, case when v_user_id is null then p_anon_id else null end, p_guest_alias, v_code)
  returning * into v_row;

  return jsonb_build_object('status', 'waiting', 'queueId', v_row.id, 'roomCode', v_row.room_code);
end;
$$;

-- ---------------------------------------------------------------------------
-- join_pvp_room: empareja de inmediato con quien creó la sala de ese código.
-- ---------------------------------------------------------------------------
create or replace function join_pvp_room(p_code text, p_guest_alias text default null, p_anon_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room pvp_queue;
  v_me pvp_queue;
  v_match_id uuid;
begin
  if v_user_id is null and p_anon_id is null then
    raise exception 'Se requiere identidad de invitado o sesión iniciada';
  end if;
  if v_user_id is null and (p_guest_alias is null or length(trim(p_guest_alias)) = 0) then
    raise exception 'Los invitados deben indicar un alias';
  end if;

  select * into v_room from pvp_queue
  where room_code = upper(trim(p_code)) and status = 'waiting'
  for update skip locked;

  if v_room is null then
    raise exception 'No existe una sala esperando con ese código, o ya se llenó';
  end if;

  if (v_room.user_id is not null and v_room.user_id = v_user_id) or (v_room.user_id is null and v_room.anon_id = p_anon_id) then
    raise exception 'No puedes unirte a tu propia sala';
  end if;

  delete from pvp_queue
  where status = 'waiting' and id <> v_room.id
    and ((v_user_id is not null and user_id = v_user_id) or (v_user_id is null and anon_id = p_anon_id));

  insert into pvp_queue (user_id, anon_id, guest_alias, status)
  values (v_user_id, case when v_user_id is null then p_anon_id else null end, p_guest_alias, 'matched')
  returning * into v_me;

  v_match_id := create_pvp_match_for_pair(v_room, v_me);

  return jsonb_build_object('status', 'matched', 'matchId', v_match_id);
end;
$$;
