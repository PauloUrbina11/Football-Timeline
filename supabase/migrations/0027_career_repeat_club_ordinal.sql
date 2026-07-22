-- Football Timeline — 0027: cuando un jugador pasó dos veces por el mismo club (ej. Cristiano
-- Ronaldo en Manchester United, 2003 y 2021), las dos camisetas de Career Timeline se veían
-- idénticas ("Manchester United" x2) — mismo problema que ya se resolvió para los casilleros
-- repetidos de Ballon d'Or (ver 0016_ballon_dor_allow_repeat_winners.sql), pero del lado de los
-- ELEMENTOS arrastrables en vez de los casilleros, porque Career Timeline usa la variante
-- "year-slots" (el casillero revela el año; el elemento revela el club).
--
-- Mismo criterio que Ballon d'Or: se etiqueta con la etapa REAL en la carrera del jugador
-- ("Manchester United (1)", "Manchester United (2)") — un dato real y verificable, no una posición
-- arbitraria dentro del rompecabezas — solo cuando ese club se repite DENTRO de este mismo
-- timeline (para no añadir sufijos a timelines sin repetidos).

create or replace function get_timeline_match_cards(p_timeline_id uuid)
returns table (
  event_id uuid,
  title text,
  metadata jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  with base as (
    select
      e.id,
      e.title,
      e.metadata,
      e.subject_id,
      e.event_date,
      e.metadata->>'club' as club_name
    from timeline_events te
    join events e on e.id = te.event_id
    join timelines t on t.id = te.timeline_id
    where te.timeline_id = p_timeline_id
      and t.status = 'published'
      and t.deleted_at is null
      and e.deleted_at is null
  ),
  ranked as (
    select
      b.*,
      count(*) over (partition by b.club_name) as repeats_in_window,
      (
        select count(*) from events e2
        where e2.subject_id = b.subject_id
          and e2.deleted_at is null
          and e2.metadata->>'club' = b.club_name
          and e2.event_date <= b.event_date
      ) as stint_number
    from base b
  )
  select
    r.id,
    r.title,
    case
      when r.club_name is not null and r.repeats_in_window > 1
        then jsonb_set(r.metadata, '{club}', to_jsonb(r.club_name || ' (' || r.stint_number || ')'))
      else r.metadata
    end
  from ranked r
  order by random();
$$;
