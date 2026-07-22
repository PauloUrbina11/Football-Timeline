-- Football Timeline — 0012: RPCs para la variante "name-slots" del modo "emparejar" (Ballon d'Or
-- Timeline). Ver 0011_match_mode_rpcs.sql para la variante original ("year-slots", Transfer).
--
-- En Transfer los casilleros revelan el AÑO y los elementos ocultan la identidad (camiseta genérica);
-- en Ballon d'Or es al revés: el jugador arrastra un balón que YA muestra el año (revelado a
-- propósito, mismo criterio de diseño que en 0011) hacia el casillero del jugador que lo ganó ese año.
--
-- Importante para evitar espóiler: los casilleros NO se ordenan por `correct_order` (eso revelaría
-- el orden cronológico real de los ganadores, que es justo el conocimiento que se está evaluando).
-- Se ordenan alfabéticamente por nombre — un orden que no aporta ninguna pista cronológica. La
-- pareja evento-casillero sigue sin exponerse nunca: son dos consultas independientes, igual que en
-- 0011, y `submit_attempt` sigue funcionando sin cambios porque solo compara "para cada casillero,
-- en su índice actual, qué event_id se colocó" contra `correct_order` — el significado de
-- `correct_order` (cronológico vs. alfabético) es una decisión de contenido, no de esquema ni RPC.

create or replace function get_timeline_match_items_by_year(p_timeline_id uuid)
returns table (
  event_id uuid,
  label text
)
language sql
security definer
stable
set search_path = public
as $$
  select e.id, to_char(e.event_date, 'YYYY') as label
  from timeline_events te
  join events e on e.id = te.event_id
  join timelines t on t.id = te.timeline_id
  where te.timeline_id = p_timeline_id
    and t.status = 'published'
    and t.deleted_at is null
    and e.deleted_at is null
  order by random();
$$;

create or replace function get_timeline_match_slots_by_name(p_timeline_id uuid)
returns table (
  slot_index smallint,
  label text
)
language sql
security definer
stable
set search_path = public
as $$
  select row_number() over (order by s.name)::smallint as slot_index,
         s.name as label
  from timeline_events te
  join events e on e.id = te.event_id
  join timelines t on t.id = te.timeline_id
  join subjects s on s.id = e.subject_id
  where te.timeline_id = p_timeline_id
    and t.status = 'published'
    and t.deleted_at is null
    and e.deleted_at is null
  order by s.name;
$$;
