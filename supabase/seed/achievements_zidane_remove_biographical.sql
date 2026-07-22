-- Football Timeline — patch: Achievement Timeline de Zidane pasa a mostrar solo premios y logros
-- individuales/colectivos (se quitan "debut" y "retiro", que son hechos biográficos, no premios,
-- y además revelaban trivialmente los dos extremos del orden). Ver docs/architecture.md.

-- 1) Desvincula y borra los dos eventos biográficos (nadie más los referencia).
delete from timeline_events te
using events e
where te.event_id = e.id
  and e.subject_id = (select id from subjects where slug = 'zinedine-zidane')
  and e.title in ('Debut profesional con el Cannes', 'Se retira del fútbol profesional')
  and te.timeline_id = (select id from timelines where slug = 'zinedine-zidane-achievements');

delete from events
where subject_id = (select id from subjects where slug = 'zinedine-zidane')
  and title in ('Debut profesional con el Cannes', 'Se retira del fútbol profesional');

-- 2) Añade dos premios/logros reales que faltaban para volver a completar los 6 eventos de "medium".
insert into events (title, description, event_date, date_precision, display_date, subject_id, metadata)
select v.title, v.description, v.event_date::date, 'year', v.display_date,
       (select id from subjects where slug = 'zinedine-zidane'), '{}'::jsonb
from (
  values
    (
      'Campeón de la Serie A con la Juventus',
      'Gana el título de la liga italiana en su primera temporada en el club.',
      '1997-06-01', '1997'
    ),
    (
      'Campeón de la Copa Intercontinental con el Real Madrid',
      'Gana el título mundial de clubes meses después de conseguir la Champions League.',
      '2002-12-08', '2002'
    )
) as v(title, description, event_date, display_date)
where not exists (
  select 1 from events e
  where e.title = v.title and e.subject_id = (select id from subjects where slug = 'zinedine-zidane')
);

-- 3) Reasigna correct_order para los 6 eventos finales (todos premios/logros, orden cronológico real).
delete from timeline_events
where timeline_id = (select id from timelines where slug = 'zinedine-zidane-achievements');

insert into timeline_events (timeline_id, event_id, correct_order)
select t.id, e.id, o.correct_order
from timelines t
join (
  values
    ('Campeón de la Serie A con la Juventus', 1),
    ('Campeón del Mundo con Francia', 2),
    ('Gana el Balón de Oro', 3),
    ('Campeón de Europa con Francia', 4),
    ('Campeón de la Champions League con el Real Madrid', 5),
    ('Campeón de la Copa Intercontinental con el Real Madrid', 6)
) as o(title, correct_order) on true
join events e on e.title = o.title and e.subject_id = (select id from subjects where slug = 'zinedine-zidane')
where t.slug = 'zinedine-zidane-achievements';

update timelines
set description = 'Ordena cronológicamente los premios y logros individuales y colectivos de Zinedine Zidane.'
where slug = 'zinedine-zidane-achievements';
