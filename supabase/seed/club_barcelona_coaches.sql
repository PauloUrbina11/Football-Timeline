-- Football Timeline — seed: Club Timeline de entrenadores del FC Barcelona (dificultad "medium", 6 eventos).
-- Subconjunto real y verificable de entrenadores del club, en orden cronológico correcto
-- (se omiten deliberadamente algunos intermedios: eso no afecta el orden relativo de los incluidos).

insert into subjects (subject_type, name, slug, metadata)
select 'club', 'FC Barcelona', 'fc-barcelona', '{"country": "España"}'
where not exists (select 1 from subjects where slug = 'fc-barcelona');

insert into events (title, description, event_date, date_precision, display_date, subject_id, metadata)
select v.title, v.description, v.event_date::date, 'year', v.display_date,
       (select id from subjects where slug = 'fc-barcelona'), '{}'::jsonb
from (
  values
    ('Frank Rijkaard', 'Entrenador neerlandés que devolvió al Barcelona a lo más alto de Europa.', '2003-06-01', null),
    ('Pep Guardiola', 'Exjugador del club que se convirtió en su entrenador, con uno de los mejores equipos de la historia.', '2008-06-01', null),
    ('Tito Vilanova', 'Exayudante de Guardiola que tomó las riendas del primer equipo.', '2012-06-01', null),
    ('Luis Enrique', 'Exjugador del club que ganó un triplete (Liga, Copa y Champions) en su primera temporada.', '2014-06-01', null),
    ('Ernesto Valverde', 'Entrenador vasco que encadenó dos títulos de Liga consecutivos.', '2017-06-01', null),
    ('Xavi Hernández', 'Leyenda del club que regresó como entrenador tras retirarse como jugador.', '2021-11-01', null)
) as v(title, description, event_date, display_date)
where not exists (
  select 1 from events e
  where e.title = v.title and e.subject_id = (select id from subjects where slug = 'fc-barcelona')
);

insert into timelines (mode_id, subject_id, difficulty, title, slug, description, status, is_daily_eligible)
select 'club_coach', (select id from subjects where slug = 'fc-barcelona'), 'medium',
       'Entrenadores del FC Barcelona', 'fc-barcelona-coaches',
       'Ordena cronológicamente a estos entrenadores del FC Barcelona.', 'draft', true
where not exists (select 1 from timelines where slug = 'fc-barcelona-coaches');

insert into timeline_events (timeline_id, event_id, correct_order)
select t.id, e.id, o.correct_order
from timelines t
join (
  values
    ('Frank Rijkaard', 1),
    ('Pep Guardiola', 2),
    ('Tito Vilanova', 3),
    ('Luis Enrique', 4),
    ('Ernesto Valverde', 5),
    ('Xavi Hernández', 6)
) as o(title, correct_order) on true
join events e on e.title = o.title and e.subject_id = (select id from subjects where slug = 'fc-barcelona')
where t.slug = 'fc-barcelona-coaches'
  and not exists (select 1 from timeline_events te where te.timeline_id = t.id and te.event_id = e.id);

update timelines
set status = 'published', published_at = now()
where slug = 'fc-barcelona-coaches' and status = 'draft';
