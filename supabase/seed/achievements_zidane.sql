-- Football Timeline — seed: Achievement Timeline de Zinedine Zidane (dificultad "medium", 6 eventos).
-- Datos reales. Sin años en título/descripción (regla de contenido, ver docs/architecture.md):
-- las referencias son a hechos que exigen conocimiento real, no fechas absolutas.

insert into subjects (subject_type, name, slug, metadata)
select 'player', 'Zinedine Zidane', 'zinedine-zidane', '{"nationality": "Francia"}'
where not exists (select 1 from subjects where slug = 'zinedine-zidane');

insert into events (title, description, event_date, date_precision, display_date, subject_id, metadata)
select v.title, v.description, v.event_date::date, 'year', v.display_date,
       (select id from subjects where slug = 'zinedine-zidane'), '{}'::jsonb
from (
  values
    ('Debut profesional con el Cannes', 'Debuta como futbolista profesional en la Ligue 1 francesa.', '1989-05-15', '1989'),
    ('Campeón del Mundo con Francia', 'Marca dos goles en la final y consigue el primer Mundial de la historia de Francia.', '1998-07-12', '1998'),
    ('Gana el Balón de Oro', 'Se convierte en el mejor futbolista del mundo tras su gran Mundial.', '1998-12-01', '1998'),
    ('Campeón de Europa con Francia', 'Gana la Eurocopa con la selección francesa.', '2000-07-02', '2000'),
    ('Campeón de la Champions League con el Real Madrid', 'Marca un gol de volea recordado como uno de los mejores de la historia de la competición.', '2002-05-15', '2002'),
    ('Se retira del fútbol profesional', 'Anuncia el final de su carrera como jugador tras disputar la final de un Mundial con Francia.', '2006-07-09', '2006')
) as v(title, description, event_date, display_date)
where not exists (
  select 1 from events e
  where e.title = v.title and e.subject_id = (select id from subjects where slug = 'zinedine-zidane')
);

insert into timelines (mode_id, subject_id, difficulty, title, slug, description, status, is_daily_eligible)
select 'achievement', (select id from subjects where slug = 'zinedine-zidane'), 'medium',
       'Los logros de Zinedine Zidane', 'zinedine-zidane-achievements',
       'Ordena cronológicamente los grandes hitos de la carrera de Zinedine Zidane.', 'draft', true
where not exists (select 1 from timelines where slug = 'zinedine-zidane-achievements');

insert into timeline_events (timeline_id, event_id, correct_order)
select t.id, e.id, o.correct_order
from timelines t
join (
  values
    ('Debut profesional con el Cannes', 1),
    ('Campeón del Mundo con Francia', 2),
    ('Gana el Balón de Oro', 3),
    ('Campeón de Europa con Francia', 4),
    ('Campeón de la Champions League con el Real Madrid', 5),
    ('Se retira del fútbol profesional', 6)
) as o(title, correct_order) on true
join events e on e.title = o.title and e.subject_id = (select id from subjects where slug = 'zinedine-zidane')
where t.slug = 'zinedine-zidane-achievements'
  and not exists (select 1 from timeline_events te where te.timeline_id = t.id and te.event_id = e.id);

update timelines
set status = 'published', published_at = now()
where slug = 'zinedine-zidane-achievements' and status = 'draft';
