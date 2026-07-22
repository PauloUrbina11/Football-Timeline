-- Football Timeline — seed: Tournament Timeline del Mundial de Catar (dificultad "easy", 4 eventos).
--
-- La tarjeta de este modo muestra solo bandera vs bandera (ver EventCard con cardVariant="flags"):
-- ni título ni descripción, para no revelar quién ganó ni la fase del torneo. Las banderas van en
-- `events.metadata.flags` — emoji Unicode estándar, sin ningún problema de derechos (a diferencia
-- de escudos de clubes, que sí necesitarían tratamiento genérico si se agrega una Champions League).

insert into subjects (subject_type, name, slug, metadata)
select 'tournament', 'Copa Mundial de la FIFA Catar', 'copa-mundial-catar', '{}'::jsonb
where not exists (select 1 from subjects where slug = 'copa-mundial-catar');

insert into events (title, description, event_date, date_precision, display_date, subject_id, metadata)
select v.title, v.description, v.event_date::date, 'day', v.display_date,
       (select id from subjects where slug = 'copa-mundial-catar'), v.metadata::jsonb
from (
  values
    ('Arabia Saudita vence a Argentina', 'Una de las mayores sorpresas de la fase de grupos de la historia de los mundiales.', '2022-11-22', null, '{"flags": ["🇸🇦", "🇦🇷"]}'),
    ('Marruecos elimina a Portugal', 'Marruecos se convierte en el primer equipo africano en llegar a semifinales de un Mundial.', '2022-12-10', null, '{"flags": ["🇲🇦", "🇵🇹"]}'),
    ('Francia elimina a Inglaterra', 'Francia se impone en un cruce de cuartos de final muy disputado.', '2022-12-10', null, '{"flags": ["🇫🇷", "🏴󠁧󠁢󠁥󠁮󠁧󠁿"]}'),
    ('Argentina vence a Francia en la final', 'Argentina se corona campeona del mundo tras una final decidida en la tanda de penaltis.', '2022-12-18', null, '{"flags": ["🇦🇷", "🇫🇷"]}')
) as v(title, description, event_date, display_date, metadata)
where not exists (
  select 1 from events e
  where e.title = v.title and e.subject_id = (select id from subjects where slug = 'copa-mundial-catar')
);

insert into timelines (mode_id, subject_id, difficulty, title, slug, description, status, is_daily_eligible)
select 'tournament', (select id from subjects where slug = 'copa-mundial-catar'), 'easy',
       'Mundial de Catar: momentos clave', 'mundial-catar-momentos-clave',
       'Ordena qué partido fue primero en el Mundial de Catar 2022.', 'draft', true
where not exists (select 1 from timelines where slug = 'mundial-catar-momentos-clave');

insert into timeline_events (timeline_id, event_id, correct_order)
select t.id, e.id, o.correct_order
from timelines t
join (
  values
    ('Arabia Saudita vence a Argentina', 1),
    ('Marruecos elimina a Portugal', 2),
    ('Francia elimina a Inglaterra', 3),
    ('Argentina vence a Francia en la final', 4)
) as o(title, correct_order) on true
join events e on e.title = o.title and e.subject_id = (select id from subjects where slug = 'copa-mundial-catar')
where t.slug = 'mundial-catar-momentos-clave'
  and not exists (select 1 from timeline_events te where te.timeline_id = t.id and te.event_id = e.id);

update timelines
set status = 'published', published_at = now()
where slug = 'mundial-catar-momentos-clave' and status = 'draft';
