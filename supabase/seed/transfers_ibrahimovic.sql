-- Football Timeline — seed: Transfer Timeline de Zlatan Ibrahimović (dificultad "medium", 6 eventos).

insert into subjects (subject_type, name, slug, metadata)
select 'player', 'Zlatan Ibrahimović', 'zlatan-ibrahimovic', '{"nationality": "Suecia"}'
where not exists (select 1 from subjects where slug = 'zlatan-ibrahimovic');

insert into events (title, description, event_date, date_precision, display_date, subject_id, metadata)
select v.title, v.description, v.event_date::date, 'year', null,
       (select id from subjects where slug = 'zlatan-ibrahimovic'), v.metadata::jsonb
from (
  values
    ('Fichaje por la Juventus', 'Llega a la Serie A procedente del Ajax.', '2004-08-01', '{"club": "Juventus"}'),
    ('Fichaje por el Inter de Milán', 'Cambia de equipo dentro de la propia Serie A.', '2006-08-01', '{"club": "Inter de Milán"}'),
    ('Fichaje por el FC Barcelona', 'Ficha por el Barcelona a cambio de Samuel Eto''o más una importante cantidad económica.', '2009-07-01', '{"club": "FC Barcelona"}'),
    ('Fichaje por el AC Milan', 'Vuelve a Italia tras una sola temporada en España.', '2010-08-01', '{"club": "AC Milan"}'),
    ('Fichaje por el Paris Saint-Germain', 'Se convierte en una de las estrellas del proyecto del PSG en Francia.', '2012-07-01', '{"club": "Paris Saint-Germain"}'),
    ('Fichaje por el Manchester United', 'Firma como agente libre por el club inglés.', '2016-07-01', '{"club": "Manchester United"}')
) as v(title, description, event_date, metadata)
where not exists (
  select 1 from events e
  where e.title = v.title and e.subject_id = (select id from subjects where slug = 'zlatan-ibrahimovic')
);

insert into timelines (mode_id, subject_id, difficulty, title, slug, description, status, is_daily_eligible)
select 'transfer', (select id from subjects where slug = 'zlatan-ibrahimovic'), 'medium',
       'Los fichajes de Zlatan Ibrahimović', 'zlatan-ibrahimovic-transfers',
       'Ordena cronológicamente los traspasos de Zlatan Ibrahimović.', 'draft', true
where not exists (select 1 from timelines where slug = 'zlatan-ibrahimovic-transfers');

insert into timeline_events (timeline_id, event_id, correct_order)
select t.id, e.id, o.correct_order
from timelines t
join (
  values
    ('Fichaje por la Juventus', 1),
    ('Fichaje por el Inter de Milán', 2),
    ('Fichaje por el FC Barcelona', 3),
    ('Fichaje por el AC Milan', 4),
    ('Fichaje por el Paris Saint-Germain', 5),
    ('Fichaje por el Manchester United', 6)
) as o(title, correct_order) on true
join events e on e.title = o.title and e.subject_id = (select id from subjects where slug = 'zlatan-ibrahimovic')
where t.slug = 'zlatan-ibrahimovic-transfers'
  and not exists (select 1 from timeline_events te where te.timeline_id = t.id and te.event_id = e.id);

update timelines
set status = 'published', published_at = now()
where slug = 'zlatan-ibrahimovic-transfers' and status = 'draft';
