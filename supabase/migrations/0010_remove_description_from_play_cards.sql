-- Football Timeline — 0010: quita `description` de las tarjetas de juego (espóiler de contenido).
--
-- Descripciones narrativas como "Cambia de equipo dentro de la propia Serie A" filtran pistas de
-- orden relativo entre tarjetas (si la anterior fue "Juventus", el jugador deduce que esta también
-- es de la Serie A, sin necesitar saber nada de fútbol). El tablero de juego ahora solo recibe el
-- hecho puro (título). Las descripciones siguen existiendo en `events.description` para un futuro
-- panel admin, solo se deja de exponerlas en el flujo de juego.

drop function if exists get_timeline_play_cards(uuid);

create or replace function get_timeline_play_cards(p_timeline_id uuid)
returns table (
  event_id uuid,
  title text,
  display_date text,
  image_url text,
  metadata jsonb
)
language sql
security definer
stable
set search_path = public
as $$
  select e.id, e.title, e.display_date, e.image_url, e.metadata
  from timeline_events te
  join events e on e.id = te.event_id
  join timelines t on t.id = te.timeline_id
  where te.timeline_id = p_timeline_id
    and t.status = 'published'
    and t.deleted_at is null
    and e.deleted_at is null
  order by random();
$$;
