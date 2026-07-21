-- Football Timeline — seed: Ballon d'Or Timeline reciente (dificultad "hard", 8 eventos).
-- Ganadores reales 2015-2023. 2020 se omite a propósito: France Football canceló el Balón de Oro
-- ese año por la disrupción de la temporada debido al COVID-19 (no hubo ganador).
-- `event_date`/`display_date` guardan el año internamente (útil para el futuro panel admin), pero
-- NUNCA se muestran al jugador durante la partida — por eso el título y la descripción de cada
-- evento tampoco deben mencionar ningún año: hacerlo revelaría el orden sin necesitar saber de fútbol.
-- (Bug real detectado por el test e2e de la Fase 2: los títulos originales sí llevaban el año.)

insert into subjects (subject_type, name, slug)
select 'player', v.name, v.slug
from (
  values
    ('Lionel Messi', 'lionel-messi'),
    ('Cristiano Ronaldo', 'cristiano-ronaldo'),
    ('Luka Modrić', 'luka-modric'),
    ('Karim Benzema', 'karim-benzema')
) as v(name, slug)
where not exists (select 1 from subjects where subjects.slug = v.slug);

insert into events (title, description, event_date, date_precision, display_date, subject_id, metadata)
select v.title, v.description, v.event_date::date, 'year', v.display_date,
       (select id from subjects where slug = v.subject_slug), '{}'::jsonb
from (
  values
    ('Lionel Messi gana su quinto Balón de Oro', 'Empata en ese momento con Cristiano Ronaldo como máximo ganador del premio.', '2015-12-31', '2015', 'lionel-messi'),
    ('Cristiano Ronaldo gana el Balón de Oro tras la Champions y la Eurocopa', 'Balón de Oro tras ganar la Champions League con el Real Madrid y la Eurocopa con Portugal.', '2016-12-31', '2016', 'cristiano-ronaldo'),
    ('Cristiano Ronaldo gana su quinto Balón de Oro', 'Iguala a Lionel Messi en el número total de premios.', '2017-12-31', '2017', 'cristiano-ronaldo'),
    ('Luka Modrić gana el Balón de Oro', 'Tras ganar la Champions con el Real Madrid y llegar a la final del Mundial con Croacia.', '2018-12-31', '2018', 'luka-modric'),
    ('Lionel Messi gana su sexto Balón de Oro', 'Se convierte en el máximo ganador en solitario del premio.', '2019-12-31', '2019', 'lionel-messi'),
    ('Lionel Messi gana el Balón de Oro tras la Copa América', 'Su séptimo Balón de Oro, tras ganar por fin un título con la selección argentina. La edición anterior del premio no se había entregado.', '2021-12-31', '2021', 'lionel-messi'),
    ('Karim Benzema gana el Balón de Oro', 'Tras una temporada decisiva en la Champions League con el Real Madrid.', '2022-12-31', '2022', 'karim-benzema'),
    ('Lionel Messi gana su octavo Balón de Oro', 'Llega tras ganar el Mundial con la selección argentina.', '2023-12-31', '2023', 'lionel-messi')
) as v(title, description, event_date, display_date, subject_slug)
where not exists (
  select 1 from events e
  where e.title = v.title and e.subject_id = (select id from subjects where slug = v.subject_slug)
);

insert into timelines (mode_id, subject_id, difficulty, title, slug, description, status, is_daily_eligible)
select 'ballon_dor', null, 'hard',
       'Ganadores recientes del Balón de Oro', 'ballon-dor-2015-2023',
       'Ordena cronológicamente a los últimos ganadores del Balón de Oro.', 'draft', true
where not exists (select 1 from timelines where slug = 'ballon-dor-2015-2023');

insert into timeline_events (timeline_id, event_id, correct_order)
select t.id, e.id, o.correct_order
from timelines t
join (
  values
    ('Lionel Messi gana su quinto Balón de Oro', 1),
    ('Cristiano Ronaldo gana el Balón de Oro tras la Champions y la Eurocopa', 2),
    ('Cristiano Ronaldo gana su quinto Balón de Oro', 3),
    ('Luka Modrić gana el Balón de Oro', 4),
    ('Lionel Messi gana su sexto Balón de Oro', 5),
    ('Lionel Messi gana el Balón de Oro tras la Copa América', 6),
    ('Karim Benzema gana el Balón de Oro', 7),
    ('Lionel Messi gana su octavo Balón de Oro', 8)
) as o(title, correct_order) on true
join events e on e.title = o.title
where t.slug = 'ballon-dor-2015-2023'
  and not exists (select 1 from timeline_events te where te.timeline_id = t.id and te.event_id = e.id);

update timelines
set status = 'published', published_at = now()
where slug = 'ballon-dor-2015-2023' and status = 'draft';
