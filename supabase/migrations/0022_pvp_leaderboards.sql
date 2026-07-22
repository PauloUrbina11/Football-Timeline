-- Football Timeline — 0022: rankings PvP de solo lectura. Deliberadamente NO hay una tabla
-- `Leaderboards`: estas RPCs solo leen pvp_ratings/pvp_rating_history/profiles (ya públicas por
-- RLS, ver 0019) — se exponen como función para poder cambiar el criterio de orden/paginación sin
-- tocar el cliente, no porque hagan falta privilegios especiales.

create or replace function get_pvp_leaderboard_world(p_limit int default 50)
returns table (user_id uuid, display_name text, country text, current_rating int, peak_rating int)
language sql
security definer
stable
set search_path = public
as $$
  select r.user_id, coalesce(p.display_name, p.username, 'Jugador') as display_name, p.country, r.current_rating, r.peak_rating
  from pvp_ratings r
  join profiles p on p.id = r.user_id
  order by r.current_rating desc
  limit p_limit;
$$;

create or replace function get_pvp_leaderboard_country(p_country text, p_limit int default 50)
returns table (user_id uuid, display_name text, current_rating int, peak_rating int)
language sql
security definer
stable
set search_path = public
as $$
  select r.user_id, coalesce(p.display_name, p.username, 'Jugador') as display_name, r.current_rating, r.peak_rating
  from pvp_ratings r
  join profiles p on p.id = r.user_id
  where p.country = p_country
  order by r.current_rating desc
  limit p_limit;
$$;

-- Semanal/mensual: no hay reset ni job — la "ventana" simplemente se calcula sobre el rango de
-- fechas que pase el llamante (p.ej. inicio de la semana/mes en curso), agregando la ganancia neta
-- de Rating del ledger append-only. Ver pvp_rating_history en 0019.
create or replace function get_pvp_leaderboard_period(p_start timestamptz, p_end timestamptz, p_limit int default 50)
returns table (user_id uuid, display_name text, net_delta int, matches_count int)
language sql
security definer
stable
set search_path = public
as $$
  select h.user_id, coalesce(p.display_name, p.username, 'Jugador') as display_name, sum(h.delta)::int, count(*)::int
  from pvp_rating_history h
  join profiles p on p.id = h.user_id
  where h.created_at >= p_start and h.created_at < p_end
  group by h.user_id, p.display_name, p.username
  order by sum(h.delta) desc
  limit p_limit;
$$;

-- Histórico: temporada vigente → snapshot en vivo de pvp_ratings; temporada cerrada → última
-- entrada de pvp_rating_history de esa temporada por usuario (el histórico permanece consultable
-- para siempre, nunca se borra al empezar una temporada nueva).
create or replace function get_pvp_leaderboard_historical(p_season_id uuid default null, p_limit int default 50)
returns table (user_id uuid, display_name text, rating int)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_season pvp_seasons;
begin
  if p_season_id is null then
    select * into v_season from pvp_seasons where is_current;
  else
    select * into v_season from pvp_seasons where id = p_season_id;
  end if;

  if v_season is null then
    return;
  end if;

  if v_season.is_current then
    return query
      select r.user_id, coalesce(p.display_name, p.username, 'Jugador') as display_name, r.current_rating
      from pvp_ratings r
      join profiles p on p.id = r.user_id
      where r.season_id = v_season.id
      order by r.current_rating desc
      limit p_limit;
  else
    return query
      select h.user_id, coalesce(p.display_name, p.username, 'Jugador') as display_name, h.rating_after
      from pvp_rating_history h
      join profiles p on p.id = h.user_id
      where h.season_id = v_season.id
        and h.created_at = (
          select max(h2.created_at) from pvp_rating_history h2
          where h2.user_id = h.user_id and h2.season_id = v_season.id
        )
      order by h.rating_after desc
      limit p_limit;
  end if;
end;
$$;
