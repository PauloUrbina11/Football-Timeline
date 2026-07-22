-- Football Timeline — 0011: RPCs para el modo "emparejar" (Transfer Timeline, y luego Ballon d'Or).
--
-- En vez de ordenar una lista, el jugador arrastra cada elemento (ej. una camiseta) a un casillero
-- fijo que muestra el año real. Esto es una decisión de diseño explícita para este modo: el año SÍ
-- se revela (a diferencia del resto de modos), porque el reto pasa a ser "sabes en qué año exacto
-- fue este fichaje", no "sabes el orden relativo". Ver docs/architecture.md.
--
-- Importante: estas funciones NUNCA devuelven qué evento corresponde a qué casillero (eso sigue
-- siendo `correct_order`, que el cliente nunca recibe). Son dos consultas independientes:
--   - get_timeline_match_cards: los elementos arrastrables, mezclados, SIN año.
--   - get_timeline_slot_labels: los años, ya ordenados por casillero, SIN decir de qué evento son.
-- La verificación de la pareja evento-casillero sigue pasando por `submit_attempt` (sin cambios):
-- el array que se envía es "para cada casillero (en orden), qué event_id se colocó ahí" — misma
-- forma que un `submitted_order` de los modos de lista.

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
  select e.id, e.title, e.metadata
  from timeline_events te
  join events e on e.id = te.event_id
  join timelines t on t.id = te.timeline_id
  where te.timeline_id = p_timeline_id
    and t.status = 'published'
    and t.deleted_at is null
    and e.deleted_at is null
  order by random();
$$;

create or replace function get_timeline_slot_labels(p_timeline_id uuid)
returns table (
  slot_index smallint,
  label text
)
language sql
security definer
stable
set search_path = public
as $$
  select row_number() over (order by te.correct_order)::smallint as slot_index,
         to_char(e.event_date, 'YYYY') as label
  from timeline_events te
  join events e on e.id = te.event_id
  join timelines t on t.id = te.timeline_id
  where te.timeline_id = p_timeline_id
    and t.status = 'published'
    and t.deleted_at is null
    and e.deleted_at is null
  order by te.correct_order;
$$;
