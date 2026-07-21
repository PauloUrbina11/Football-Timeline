-- Football Timeline — seed: Career Timeline de Cristiano Ronaldo (dificultad "medium", 6 eventos).
-- Datos reales y verificables (fechas de fichaje/debut oficiales). Seguro de re-ejecutar: usa
-- `where not exists` para no duplicar filas si se corre más de una vez sobre la misma base.

insert into subjects (subject_type, name, slug, metadata)
select 'player', 'Cristiano Ronaldo', 'cristiano-ronaldo', '{"nationality": "Portugal"}'
where not exists (select 1 from subjects where slug = 'cristiano-ronaldo');

insert into events (title, description, event_date, date_precision, display_date, subject_id, metadata)
select v.title, v.description, v.event_date::date, v.date_precision, v.display_date,
       (select id from subjects where slug = 'cristiano-ronaldo'), v.metadata::jsonb
from (
  values
    ('Debut en el primer equipo del Sporting CP',
     'Cristiano Ronaldo debuta con el primer equipo del Sporting Clube de Portugal, el club que lo formó.',
     '2002-10-07', 'year', '2002', '{"club": "Sporting CP"}'),
    ('Fichaje por el Manchester United',
     'El Manchester United lo ficha del Sporting CP por unos 12,24 millones de libras, entonces récord para un jugador de 18 años.',
     '2003-08-06', 'year', '2003', '{"club": "Manchester United"}'),
    ('Fichaje por el Real Madrid',
     'El Real Madrid lo ficha del Manchester United por una cifra que en su momento fue récord mundial.',
     '2009-06-11', 'year', '2009', '{"club": "Real Madrid"}'),
    ('Fichaje por la Juventus',
     'Tras nueve temporadas en el Real Madrid, ficha por la Juventus.',
     '2018-07-10', 'year', '2018', '{"club": "Juventus"}'),
    ('Regreso al Manchester United',
     'Vuelve al Manchester United trece años después de su primera etapa en el club.',
     '2021-08-27', 'year', '2021', '{"club": "Manchester United"}'),
    ('Fichaje por el Al-Nassr',
     'Ficha por el Al-Nassr saudí, su primera experiencia fuera del fútbol europeo.',
     '2023-01-03', 'year', '2023', '{"club": "Al-Nassr"}')
) as v(title, description, event_date, date_precision, display_date, metadata)
where not exists (
  select 1 from events e
  where e.title = v.title
    and e.subject_id = (select id from subjects where slug = 'cristiano-ronaldo')
);

insert into timelines (mode_id, subject_id, difficulty, title, slug, description, status, is_daily_eligible)
select 'career', (select id from subjects where slug = 'cristiano-ronaldo'), 'medium',
       'La carrera de Cristiano Ronaldo', 'cristiano-ronaldo-career',
       'Ordena cronológicamente los clubes por los que pasó Cristiano Ronaldo.', 'draft', true
where not exists (select 1 from timelines where slug = 'cristiano-ronaldo-career');

insert into timeline_events (timeline_id, event_id, correct_order)
select t.id, e.id, o.correct_order
from timelines t
join (
  values
    ('Debut en el primer equipo del Sporting CP', 1),
    ('Fichaje por el Manchester United', 2),
    ('Fichaje por el Real Madrid', 3),
    ('Fichaje por la Juventus', 4),
    ('Regreso al Manchester United', 5),
    ('Fichaje por el Al-Nassr', 6)
) as o(title, correct_order) on true
join events e on e.title = o.title and e.subject_id = (select id from subjects where slug = 'cristiano-ronaldo')
where t.slug = 'cristiano-ronaldo-career'
  and not exists (select 1 from timeline_events te where te.timeline_id = t.id and te.event_id = e.id);

update timelines
set status = 'published', published_at = now()
where slug = 'cristiano-ronaldo-career' and status = 'draft';
