-- Football Timeline — seed: Ballon d'Or Timeline pasa al modo "emparejar" invertido (balón con el
-- año → casillero con el nombre/avatar del jugador). Ver docs/architecture.md.
--
-- El timeline "ballon-dor-2015-2023" (ganadores 2015-2023) NO sirve para este mecanismo: Messi y
-- Ronaldo ganan varias veces en ese rango, así que habría varios casilleros con el mismo nombre
-- de jugador — ambiguo para el jugador humano (¿cuál "Messi" es cuál?). Se archiva y se reemplaza
-- por un rango real con 4 ganadores DISTINTOS, uno por año, sin repetidos.

update timelines
set status = 'archived', is_daily_eligible = false
where slug = 'ballon-dor-2015-2023';

insert into subjects (subject_type, name, slug)
select 'player', v.name, v.slug
from (
  values
    ('Andriy Shevchenko', 'andriy-shevchenko'),
    ('Ronaldinho', 'ronaldinho'),
    ('Fabio Cannavaro', 'fabio-cannavaro'),
    ('Kaká', 'kaka')
) as v(name, slug)
where not exists (select 1 from subjects where subjects.slug = v.slug);

insert into events (title, description, event_date, date_precision, display_date, subject_id, metadata)
select v.title, v.description, v.event_date::date, 'year', v.display_date,
       (select id from subjects where slug = v.subject_slug), '{}'::jsonb
from (
  values
    ('Andriy Shevchenko gana el Balón de Oro', 'Delantero del AC Milan, máximo goleador de la Serie A esa temporada.', '2004-12-31', '2004', 'andriy-shevchenko'),
    ('Ronaldinho gana el Balón de Oro', 'Extremo brasileño del FC Barcelona, elegido mejor jugador del mundo.', '2005-12-31', '2005', 'ronaldinho'),
    ('Fabio Cannavaro gana el Balón de Oro', 'Defensa italiano, capitán de la selección campeona del Mundial ese año.', '2006-12-31', '2006', 'fabio-cannavaro'),
    ('Kaká gana el Balón de Oro', 'Mediapunta brasileño del AC Milan, tras ganar la Champions League.', '2007-12-31', '2007', 'kaka')
) as v(title, description, event_date, display_date, subject_slug)
where not exists (
  select 1 from events e
  where e.title = v.title and e.subject_id = (select id from subjects where slug = v.subject_slug)
);

insert into timelines (mode_id, subject_id, difficulty, title, slug, description, status, is_daily_eligible)
select 'ballon_dor', null, 'easy',
       'Ganadores del Balón de Oro (2004-2007)', 'ballon-dor-2004-2007',
       'Arrastra cada balón al jugador que ganó el Balón de Oro ese año.', 'draft', true
where not exists (select 1 from timelines where slug = 'ballon-dor-2004-2007');

-- `correct_order` aquí NO es el orden cronológico (2004→2007): es el rango alfabético por nombre
-- de jugador, porque así es como `get_timeline_match_slots_by_name` numera los casilleros en
-- pantalla (slot_index = row_number() over (order by s.name)) — correct_order tiene que coincidir
-- exactamente con ese slot_index para que `submit_attempt` verifique la pareja evento↔casillero
-- correcta. El significado de esta columna es "índice de casillero", no "posición temporal" — eso
-- es una decisión de contenido específica de este modo, no un cambio de esquema.
insert into timeline_events (timeline_id, event_id, correct_order)
select t.id, e.id, o.correct_order
from timelines t
join (
  values
    ('Andriy Shevchenko gana el Balón de Oro', 1),
    ('Fabio Cannavaro gana el Balón de Oro', 2),
    ('Kaká gana el Balón de Oro', 3),
    ('Ronaldinho gana el Balón de Oro', 4)
) as o(title, correct_order) on true
join events e on e.title = o.title
where t.slug = 'ballon-dor-2004-2007'
  and not exists (select 1 from timeline_events te where te.timeline_id = t.id and te.event_id = e.id);

update timelines
set status = 'published', published_at = now()
where slug = 'ballon-dor-2004-2007' and status = 'draft';
